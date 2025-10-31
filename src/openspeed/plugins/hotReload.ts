import { watch, FSWatcher } from 'chokidar';
import { build, BuildResult, Plugin as EsbuildPlugin } from 'esbuild';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createHttpServer } from 'http';
import { readFileSync, statSync, existsSync, readdirSync } from 'fs';
import { join, extname, relative, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Context } from '../context.js';
import type { Plugin } from '../index.js';

// Extend the NodeJS Module interface for hot reload
declare module 'module' {
  interface Module {
    hot?: {
      accept: (path: string, callback: () => void) => void;
      dispose: (callback: () => void) => void;
    };
  }
}

interface HotReloadConfig {
  watchPaths?: string[];
  ignoredPaths?: string[];
  port?: number;
  host?: string;
  debounceMs?: number;
  maxMemoryMB?: number;
  enableTypeScript?: boolean;
  enableSourceMaps?: boolean;
  runtime?: 'node' | 'bun' | 'deno';
  buildOptions?: {
    target?: string;
    minify?: boolean;
    define?: Record<string, string>;
  };
}

interface ModuleInfo {
  id: string;
  path: string;
  dependencies: Set<string>;
  dependents: Set<string>;
  lastModified: number;
  exports: string[];
  hotAccept: boolean;
}

interface HotUpdate {
  type: 'add' | 'change' | 'unlink';
  path: string;
  content?: string;
  dependencies?: string[];
  timestamp: number;
}

class HotReloadManager {
  private watcher: FSWatcher | null = null;
  private wss: WebSocketServer | null = null;
  private modules = new Map<string, ModuleInfo>();
  private pendingUpdates = new Map<string, HotUpdate>();
  private debounceTimer: NodeJS.Timeout | null = null;
  private config: HotReloadConfig;
  private dependencyGraph = new Map<string, Set<string>>();
  private reverseDependencyGraph = new Map<string, Set<string>>();
  private memoryUsage = new Map<string, number>();

  constructor(config: HotReloadConfig) {
    this.config = {
      watchPaths: config.watchPaths || ['src', 'tests', 'examples'],
      ignoredPaths: ['node_modules', '.git', 'dist', 'build'],
      port: 24678,
      host: 'localhost',
      debounceMs: 100,
      maxMemoryMB: 512,
      enableTypeScript: true,
      enableSourceMaps: true,
      runtime: 'node',
      ...config
    };
  }

  async start(): Promise<void> {
    await this.initializeDependencyGraph();
    this.startFileWatcher();
    this.startWebSocketServer();
    this.startMemoryMonitor();

    console.log(`🔥 Hot Reload active on ws://${this.config.host}:${this.config.port}`);
  }

  private async initializeDependencyGraph(): Promise<void> {
    console.log('📊 Building dependency graph...');

    const manager = this;
    const esbuildPlugin: EsbuildPlugin = {
      name: 'dependency-analyzer',
      setup(build) {
        build.onLoad({ filter: /\.(ts|tsx|js|jsx|mjs)$/ }, async (args) => {
          const content = readFileSync(args.path, 'utf-8');
          const dependencies = manager.extractDependencies(content, args.path);

          manager.modules.set(args.path, {
            id: args.path,
            path: args.path,
            dependencies: new Set(dependencies),
            dependents: new Set(),
            lastModified: statSync(args.path).mtime.getTime(),
            exports: manager.extractExports(content),
            hotAccept: content.includes('module.hot.accept')
          });

          return { contents: content, loader: extname(args.path).slice(1) as any };
        });
      }
    };

    try {
      await build({
        entryPoints: this.findEntryPoints(),
        bundle: false,
        write: false,
        plugins: [esbuildPlugin],
        platform: 'node',
        format: 'esm',
        target: this.config.buildOptions?.target || 'node18',
        sourcemap: this.config.enableSourceMaps,
        minify: false,
        define: this.config.buildOptions?.define
      });

      this.buildDependencyGraphs();
      console.log(`📈 Analyzed ${this.modules.size} modules`);
    } catch (error) {
      console.warn('⚠️ Dependency analysis failed, falling back to basic watching');
    }
  }

  private findEntryPoints(): string[] {
    const entries: string[] = [];

    for (const watchPath of this.config.watchPaths!) {
      const packageJson = join(process.cwd(), watchPath, 'package.json');
      if (existsSync(packageJson)) {
        const pkg = JSON.parse(readFileSync(packageJson, 'utf-8'));
        if (pkg.main) entries.push(join(watchPath, pkg.main));
      }

      // Find TypeScript/JavaScript files
      this.findFilesRecursively(watchPath, entries);
    }

    return entries.length > 0 ? entries : ['src/index.ts'];
  }

  private findFilesRecursively(dir: string, entries: string[], maxDepth = 3, currentDepth = 0): void {
    if (currentDepth >= maxDepth) return;

    try {
      const files = readdirSync(dir);
      for (const file of files) {
        const fullPath = join(dir, file);
        const stat = statSync(fullPath);

        if (stat.isDirectory() && !this.config.ignoredPaths?.includes(file)) {
          this.findFilesRecursively(fullPath, entries, maxDepth, currentDepth + 1);
        } else if (stat.isFile() && /\.(ts|tsx|js|jsx|mjs)$/.test(file)) {
          entries.push(fullPath);
        }
      }
    } catch (error) {
      // Ignore permission errors
    }
  }

  private extractDependencies(content: string, filePath: string): string[] {
    const dependencies: string[] = [];
    const dir = dirname(filePath);

    // Extract ES6 imports
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const dep = this.resolveImport(match[1], dir);
      if (dep) dependencies.push(dep);
    }

    // Extract require calls
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      const dep = this.resolveImport(match[1], dir);
      if (dep) dependencies.push(dep);
    }

    return dependencies;
  }

  private resolveImport(importPath: string, fromDir: string): string | null {
    if (importPath.startsWith('.')) {
      // Relative import
      const resolved = join(fromDir, importPath);
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'];

      for (const ext of extensions) {
        const fullPath = resolved + ext;
        if (existsSync(fullPath)) return fullPath;

        // Try index files
        const indexPath = join(resolved, 'index' + ext);
        if (existsSync(indexPath)) return indexPath;
      }
    }

    return null; // Skip node_modules and absolute imports for now
  }

  private extractExports(content: string): string[] {
    const exports: string[] = [];

    // Named exports
    const namedExportRegex = /export\s+(?:const|let|var|function|class)\s+(\w+)/g;
    let match;
    while ((match = namedExportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    // Default export
    if (/export\s+default/.test(content)) {
      exports.push('default');
    }

    return exports;
  }

  private buildDependencyGraphs(): void {
    for (const [path, module] of this.modules) {
      for (const dep of module.dependencies) {
        if (!this.dependencyGraph.has(path)) {
          this.dependencyGraph.set(path, new Set());
        }
        this.dependencyGraph.get(path)!.add(dep);

        if (!this.reverseDependencyGraph.has(dep)) {
          this.reverseDependencyGraph.set(dep, new Set());
        }
        this.reverseDependencyGraph.get(dep)!.add(path);
      }
    }
  }

  private startFileWatcher(): void {
    const watchOptions = {
      ignored: this.config.ignoredPaths?.map(p => `**/${p}/**`),
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    };

    this.watcher = watch(this.config.watchPaths!, watchOptions);

    this.watcher.on('add', (path) => this.handleFileChange('add', path));
    this.watcher.on('change', (path) => this.handleFileChange('change', path));
    this.watcher.on('unlink', (path) => this.handleFileChange('unlink', path));

    console.log(`👀 Watching ${this.config.watchPaths!.join(', ')} for changes`);
  }

  private handleFileChange(type: 'add' | 'change' | 'unlink', path: string): void {
    const update: HotUpdate = {
      type,
      path,
      timestamp: Date.now()
    };

    if (type !== 'unlink') {
      try {
        update.content = readFileSync(path, 'utf-8');
        update.dependencies = this.extractDependencies(update.content, path);
      } catch (error) {
        console.warn(`⚠️ Failed to read ${path}:`, error);
        return;
      }
    }

    this.pendingUpdates.set(path, update);

    // Debounce updates
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processUpdates();
    }, this.config.debounceMs);
  }

  private async processUpdates(): Promise<void> {
    if (this.pendingUpdates.size === 0) return;

    const updates = Array.from(this.pendingUpdates.values());
    this.pendingUpdates.clear();

    console.log(`🔄 Processing ${updates.length} file changes`);

    // Analyze impact and determine affected modules
    const affectedModules = new Set<string>();
    const hotUpdatableModules = new Set<string>();

    for (const update of updates) {
      affectedModules.add(update.path);

      // Find all modules that depend on this file
      const dependents = this.getAllDependents(update.path);
      dependents.forEach(dep => affectedModules.add(dep));

      // Check if module supports hot reload
      const module = this.modules.get(update.path);
      if (module?.hotAccept) {
        hotUpdatableModules.add(update.path);
      }
    }

    // Send updates to connected clients
    this.broadcastUpdates(updates, Array.from(affectedModules));

    // Trigger hot reload for supported modules
    if (hotUpdatableModules.size > 0) {
      await this.performHotReload(Array.from(hotUpdatableModules));
    }

    // Update dependency graph
    this.updateDependencyGraph(updates);
  }

  private getAllDependents(modulePath: string): Set<string> {
    const dependents = new Set<string>();
    const queue = [modulePath];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const deps = this.reverseDependencyGraph.get(current);

      if (deps) {
        for (const dep of deps) {
          if (!dependents.has(dep)) {
            dependents.add(dep);
            queue.push(dep);
          }
        }
      }
    }

    return dependents;
  }

  private broadcastUpdates(updates: HotUpdate[], affectedModules: string[]): void {
    if (!this.wss) return;

    const message = JSON.stringify({
      type: 'hot-update',
      updates,
      affectedModules,
      timestamp: Date.now()
    });

    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  private async performHotReload(modules: string[]): Promise<void> {
    console.log(`🔥 Hot reloading ${modules.length} modules`);

    for (const modulePath of modules) {
      try {
        // Invalidate module cache
        this.invalidateModule(modulePath);

        // Trigger hot accept
        if (typeof global !== 'undefined' && (global as any).module?.hot) {
          (global as any).module.hot.accept(modulePath, () => {
            console.log(`✅ Hot accepted: ${modulePath}`);
          });
        }
      } catch (error) {
        console.warn(`⚠️ Hot reload failed for ${modulePath}:`, error);
      }
    }
  }

  invalidateModule(modulePath: string): void {
    // Remove from require cache
    const cacheKey = require.resolve(modulePath);
    delete require.cache[cacheKey];

    // For ESM, we need different handling
    if (typeof import.meta !== 'undefined') {
      // This is a simplified approach - in practice, you'd need
      // more sophisticated module invalidation for ESM
    }
  }

  private updateDependencyGraph(updates: HotUpdate[]): void {
    for (const update of updates) {
      if (update.type === 'unlink') {
        this.modules.delete(update.path);
        this.dependencyGraph.delete(update.path);
        // Update reverse dependencies
        for (const [dep, dependents] of this.reverseDependencyGraph) {
          dependents.delete(update.path);
        }
      } else if (update.content && update.dependencies) {
        const module: ModuleInfo = {
          id: update.path,
          path: update.path,
          dependencies: new Set(update.dependencies),
          dependents: new Set(),
          lastModified: update.timestamp,
          exports: this.extractExports(update.content),
          hotAccept: update.content.includes('module.hot.accept')
        };

        this.modules.set(update.path, module);
        this.updateModuleDependencies(update.path, update.dependencies);
      }
    }
  }

  private updateModuleDependencies(modulePath: string, dependencies: string[]): void {
    // Remove old dependencies
    for (const [from, deps] of this.dependencyGraph) {
      deps.delete(modulePath);
    }

    // Add new dependencies
    for (const dep of dependencies) {
      if (!this.dependencyGraph.has(modulePath)) {
        this.dependencyGraph.set(modulePath, new Set());
      }
      this.dependencyGraph.get(modulePath)!.add(dep);

      if (!this.reverseDependencyGraph.has(dep)) {
        this.reverseDependencyGraph.set(dep, new Set());
      }
      this.reverseDependencyGraph.get(dep)!.add(modulePath);
    }
  }

  private startWebSocketServer(): void {
    const server = createHttpServer();
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('🔌 Hot reload client connected');

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (error) {
          console.warn('⚠️ Invalid message from client:', error);
        }
      });

      ws.on('close', () => {
        console.log('🔌 Hot reload client disconnected');
      });

      // Send initial state
      ws.send(JSON.stringify({
        type: 'init',
        modules: Array.from(this.modules.keys()),
        config: this.config
      }));
    });

    server.listen(this.config.port, this.config.host, () => {
      console.log(`🌐 WebSocket server listening on ws://${this.config.host}:${this.config.port}`);
    });
  }

  private handleClientMessage(ws: WebSocket, message: any): void {
    switch (message.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;

      case 'request-reload':
        this.performFullReload();
        break;

      case 'get-module-info':
        const moduleInfo = this.modules.get(message.path);
        ws.send(JSON.stringify({
          type: 'module-info',
          path: message.path,
          info: moduleInfo
        }));
        break;
    }
  }

  performFullReload(): void {
    console.log('🔄 Performing full reload');

    // Clear all caches
    for (const path of this.modules.keys()) {
      this.invalidateModule(path);
    }

    // Broadcast reload signal
    this.broadcastUpdates([], Array.from(this.modules.keys()));
  }

  private startMemoryMonitor(): void {
    setInterval(() => {
      const usage = process.memoryUsage();
      const totalMB = Math.round(usage.heapUsed / 1024 / 1024);

      if (totalMB > this.config.maxMemoryMB!) {
        console.warn(`⚠️ High memory usage: ${totalMB}MB, triggering cleanup`);
        this.performMemoryCleanup();
      }

      // Track per-module memory usage
      for (const [path, module] of this.modules) {
        this.memoryUsage.set(path, this.memoryUsage.get(path) || 0);
      }
    }, 30000); // Check every 30 seconds
  }

  private performMemoryCleanup(): void {
    // Clear old module cache entries
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [path, module] of this.modules) {
      if (now - module.lastModified > maxAge) {
        this.invalidateModule(path);
      }
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('🧹 Forced garbage collection');
    }
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
    }

    if (this.wss) {
      this.wss.close();
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    console.log('🛑 Hot reload stopped');
  }

  getStats() {
    return {
      modules: this.modules.size,
      dependencies: this.dependencyGraph.size,
      memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      clients: this.wss?.clients.size || 0,
      config: this.config
    };
  }
}

export function hotReloadPlugin(config: HotReloadConfig = {}): Plugin {
  let manager: HotReloadManager;

  return {
    name: 'hot-reload',
    setup(app) {
      manager = new HotReloadManager(config);

      // Add hot reload context
      app.use(async (ctx: Context, next: () => Promise<any>) => {
        ctx.hotReload = {
          stats: () => manager.getStats(),
          reload: () => manager.performFullReload(),
          invalidate: (path: string) => manager.invalidateModule(path)
        };
        await next();
      });

      // Start hot reload system
      manager.start().catch(console.error);

      // Cleanup on app shutdown
      process.on('SIGINT', async () => {
        await manager.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        await manager.stop();
        process.exit(0);
      });
    }
  };
}