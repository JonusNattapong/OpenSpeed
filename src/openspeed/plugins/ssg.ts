/**
 * Static Site Generation (SSG) Plugin for OpenSpeed
 * Pre-render routes to static HTML files
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Context } from '../context.js';

export interface SSGRoute {
  path: string;
  outputPath?: string;
  data?: any;
}

export interface SSGOptions {
  outputDir?: string;
  routes: SSGRoute[];
  baseUrl?: string;
  pretty?: boolean;
  cleanOutputDir?: boolean;
  onGenerate?: (route: SSGRoute, html: string) => void;
  onComplete?: (stats: SSGStats) => void;
}

export interface SSGStats {
  totalRoutes: number;
  generatedFiles: number;
  failedRoutes: string[];
  outputDir: string;
  duration: number;
}

export interface SSGContext {
  generate: (options?: Partial<SSGOptions>) => Promise<SSGStats>;
  addRoute: (route: SSGRoute) => void;
  routes: SSGRoute[];
}

/**
 * SSG Plugin - generates static HTML from routes
 */
export function ssg(options: SSGOptions) {
  const {
    outputDir = './dist',
    routes = [],
    baseUrl = '',
    pretty = true,
    cleanOutputDir = false,
    onGenerate,
    onComplete,
  } = options;

  const ssgRoutes: SSGRoute[] = [...routes];

  return async (ctx: Context, next: () => Promise<any>) => {
    // Attach SSG context
    const ssgContext: SSGContext = {
      generate: async (overrideOptions?: Partial<SSGOptions>) => {
        return await generateStaticSite({
          outputDir,
          routes: ssgRoutes,
          baseUrl,
          pretty,
          cleanOutputDir,
          onGenerate,
          onComplete,
          ...overrideOptions,
        });
      },
      addRoute: (route: SSGRoute) => {
        ssgRoutes.push(route);
      },
      routes: ssgRoutes,
    };

    (ctx as any).ssg = ssgContext;

    await next();
  };
}

/**
 * Generate static site from routes
 */
async function generateStaticSite(options: SSGOptions): Promise<SSGStats> {
  const startTime = Date.now();
  const {
    outputDir = './dist',
    routes,
    baseUrl = '',
    pretty = true,
    cleanOutputDir = false,
    onGenerate,
    onComplete,
  } = options;

  const stats: SSGStats = {
    totalRoutes: routes.length,
    generatedFiles: 0,
    failedRoutes: [],
    outputDir,
    duration: 0,
  };

  try {
    // Clean output directory if requested
    if (cleanOutputDir && fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }

    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate each route
    for (const route of routes) {
      try {
        const html = await renderRoute(route, baseUrl);

        // Determine output path
        const outputPath = route.outputPath || getOutputPath(route.path);
        const fullPath = path.join(outputDir, outputPath);

        // Create directory if needed
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Write file
        const formattedHtml = pretty ? prettifyHtml(html) : html;
        fs.writeFileSync(fullPath, formattedHtml, 'utf-8');

        stats.generatedFiles++;

        // Callback
        if (onGenerate) {
          onGenerate(route, formattedHtml);
        }

        console.log(`✓ Generated: ${route.path} -> ${outputPath}`);
      } catch (error) {
        stats.failedRoutes.push(route.path);
        console.error(`✗ Failed to generate ${route.path}:`, error);
      }
    }

    stats.duration = Date.now() - startTime;

    // Completion callback
    if (onComplete) {
      onComplete(stats);
    }

    console.log(`\n📊 SSG Complete:`);
    console.log(`   Total Routes: ${stats.totalRoutes}`);
    console.log(`   Generated: ${stats.generatedFiles}`);
    console.log(`   Failed: ${stats.failedRoutes.length}`);
    console.log(`   Duration: ${stats.duration}ms`);
    console.log(`   Output: ${outputDir}\n`);
  } catch (error) {
    console.error('SSG generation failed:', error);
    throw error;
  }

  return stats;
}

/**
 * Render a route to HTML
 */
async function renderRoute(route: SSGRoute, baseUrl: string): Promise<string> {
  // Mock fetch to the route
  const url = `${baseUrl}${route.path}`;

  try {
    // Try to fetch from local server
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    // If server not running, return a placeholder or error
    console.warn(`Could not fetch ${url}, generating placeholder`);
    return generatePlaceholderHtml(route);
  }
}

/**
 * Generate placeholder HTML if route can't be rendered
 */
function generatePlaceholderHtml(route: SSGRoute): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${route.path}</title>
</head>
<body>
  <h1>Route: ${route.path}</h1>
  <p>This page will be generated when the server is running.</p>
</body>
</html>`;
}

/**
 * Convert route path to output file path
 */
function getOutputPath(routePath: string): string {
  // Remove leading slash
  let path = routePath.replace(/^\//, '');

  // Handle root
  if (!path || path === '') {
    return 'index.html';
  }

  // Handle trailing slash
  if (path.endsWith('/')) {
    return `${path}index.html`;
  }

  // Add .html if no extension
  if (!path.includes('.')) {
    return `${path}.html`;
  }

  return path;
}

/**
 * Prettify HTML output
 */
function prettifyHtml(html: string): string {
  let formatted = html;
  let indent = 0;
  const lines: string[] = [];

  // Simple prettifier (basic indentation)
  const tokens = html.split(/(<[^>]+>)/g).filter(Boolean);

  for (const token of tokens) {
    if (token.match(/^<\/\w+>/)) {
      // Closing tag
      indent = Math.max(0, indent - 1);
      lines.push('  '.repeat(indent) + token);
    } else if (token.match(/^<\w+[^>]*\/>/)) {
      // Self-closing tag
      lines.push('  '.repeat(indent) + token);
    } else if (token.match(/^<\w+[^>]*>/)) {
      // Opening tag
      lines.push('  '.repeat(indent) + token);
      indent++;
    } else if (token.trim()) {
      // Text content
      lines.push('  '.repeat(indent) + token.trim());
    }
  }

  return lines.join('\n');
}

/**
 * Generate static site CLI command
 */
export async function generateStatic(
  app: any,
  routes: SSGRoute[],
  options: Partial<SSGOptions> = {}
): Promise<SSGStats> {
  const fullOptions: SSGOptions = {
    routes,
    outputDir: './dist',
    cleanOutputDir: true,
    pretty: true,
    ...options,
  };

  return await generateStaticSite(fullOptions);
}

/**
 * Helper to define SSG routes with parameters
 */
export function defineRoutes(routes: Array<string | SSGRoute>): SSGRoute[] {
  return routes.map(route => {
    if (typeof route === 'string') {
      return { path: route };
    }
    return route;
  });
}

/**
 * Generate sitemap.xml
 */
export function generateSitemap(
  routes: SSGRoute[],
  baseUrl: string,
  options: {
    changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    priority?: number;
  } = {}
): string {
  const { changefreq = 'weekly', priority = 0.5 } = options;

  const urls = routes
    .map(route => {
      const url = `${baseUrl}${route.path}`;
      const lastmod = new Date().toISOString().split('T')[0];

      return `  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

/**
 * Generate robots.txt
 */
export function generateRobots(
  sitemapUrl: string,
  options: {
    userAgent?: string;
    allow?: string[];
    disallow?: string[];
  } = {}
): string {
  const { userAgent = '*', allow = ['/'], disallow = [] } = options;

  let robots = `User-agent: ${userAgent}\n`;

  for (const path of allow) {
    robots += `Allow: ${path}\n`;
  }

  for (const path of disallow) {
    robots += `Disallow: ${path}\n`;
  }

  robots += `\nSitemap: ${sitemapUrl}\n`;

  return robots;
}

/**
 * Example usage:
 *
 * import { ssg, generateStatic, defineRoutes, generateSitemap } from 'openspeed/plugins/ssg';
 *
 * // In your app
 * app.use(ssg({
 *   outputDir: './dist',
 *   routes: defineRoutes([
 *     '/',
 *     '/about',
 *     '/blog/post-1',
 *     { path: '/products', outputPath: 'products/index.html' }
 *   ])
 * }));
 *
 * // Generate static site
 * await generateStatic(app, defineRoutes([
 *   '/',
 *   '/about',
 *   '/contact'
 * ]), {
 *   outputDir: './build',
 *   cleanOutputDir: true,
 *   onGenerate: (route, html) => {
 *     console.log(`Generated ${route.path}`);
 *   }
 * });
 *
 * // Generate sitemap
 * const sitemap = generateSitemap(routes, 'https://example.com');
 * fs.writeFileSync('./dist/sitemap.xml', sitemap);
 */
