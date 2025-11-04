import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createHttpServer } from 'http';

import { randomBytes } from 'crypto';
import type { Context } from '../context.js';
import type { Plugin } from '../index.js';

interface PlaygroundConfig {
  port?: number;
  host?: string;
  enableAI?: boolean;
  enableCollaboration?: boolean;
  maxConnections?: number;
  sessionTimeout?: number;
  allowedOrigins?: string[];
  enableMetrics?: boolean;
}

interface PlaygroundSession {
  id: string;
  clients: Set<WebSocket>;
  requests: PlaygroundRequest[];
  responses: PlaygroundResponse[];
  collaborators: Map<string, Collaborator>;
  createdAt: number;
  lastActivity: number;
}

interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursor?: { line: number; column: number; file: string };
  selection?: { start: number; end: number; file: string };
}

interface PlaygroundRequest {
  id: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
  timestamp: number;
  author: string;
  aiGenerated?: boolean;
  tags?: string[];
}

interface PlaygroundResponse {
  id: string;
  requestId: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: any;
  duration: number;
  timestamp: number;
  size: number;
}

class PlaygroundManager {
  private wss: WebSocketServer | null = null;
  private sessions = new Map<string, PlaygroundSession>();
  private config: PlaygroundConfig;
  private aiClient: AIAssistant;
  private metrics: Map<string, any> = new Map();

  constructor(config: PlaygroundConfig) {
    this.config = {
      port: 3001,
      host: 'localhost',
      enableAI: true,
      enableCollaboration: true,
      maxConnections: 100,
      sessionTimeout: 3600000, // 1 hour
      allowedOrigins: ['*'],
      enableMetrics: true,
      ...config,
    };

    this.aiClient = new AIAssistant();
  }

  async start(): Promise<void> {
    await this.startWebSocketServer();
    this.startSessionCleanup();
    this.startMetricsCollection();

    console.log(`🎮 API Playground active on ws://${this.config.host}:${this.config.port}`);
  }

  private async startWebSocketServer(): Promise<void> {
    const server = createHttpServer((req, res) => {
      // Serve playground HTML
      if (req.url === '/' || req.url === '/playground') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(this.getPlaygroundHTML());
      } else if (req.url?.startsWith('/api/')) {
        this.handleAPIRequest(req, res);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    this.wss = new WebSocketServer({
      server,
      maxPayload: 1024 * 1024, // 1MB
      perMessageDeflate: true,
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      this.handleConnection(ws, req);
    });

    server.listen(this.config.port, this.config.host, () => {
      console.log(
        `🌐 Playground server listening on http://${this.config.host}:${this.config.port}`
      );
    });
  }

  private handleConnection(ws: WebSocket, req: any): void {
    const origin = req.headers.origin;
    if (!this.isOriginAllowed(origin)) {
      ws.close(1008, 'Origin not allowed');
      return;
    }

    const clientId = this.generateId();
    let sessionId = req.url?.split('?session=')[1] || this.createSession();

    if (!this.sessions.has(sessionId)) {
      sessionId = this.createSession();
    }

    const session = this.sessions.get(sessionId)!;
    session.clients.add(ws);

    const collaborator: Collaborator = {
      id: clientId,
      name: `User ${session.collaborators.size + 1}`,
      color: this.getRandomColor(),
    };

    session.collaborators.set(clientId, collaborator);
    session.lastActivity = Date.now();

    console.log(`👤 Client ${clientId} joined session ${sessionId}`);

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: 'welcome',
        sessionId,
        clientId,
        collaborator,
        session: this.getSessionData(session),
      })
    );

    // Broadcast new collaborator
    this.broadcastToSession(
      sessionId,
      {
        type: 'collaborator-joined',
        collaborator,
      },
      ws
    );

    ws.on('message', (data: any) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, sessionId, clientId, message);
      } catch (error) {
        console.warn('⚠️ Invalid message from client:', error);
        ws.send(
          JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
          })
        );
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(sessionId, clientId, ws);
    });

    ws.on('error', (error: any) => {
      console.warn(`⚠️ WebSocket error for client ${clientId}:`, error);
    });
  }

  private handleMessage(ws: WebSocket, sessionId: string, clientId: string, message: any): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lastActivity = Date.now();

    switch (message.type) {
      case 'send-request':
        this.handleSendRequest(sessionId, clientId, message.request);
        break;

      case 'cursor-update':
        this.handleCursorUpdate(sessionId, clientId, message.cursor);
        break;

      case 'selection-update':
        this.handleSelectionUpdate(sessionId, clientId, message.selection);
        break;

      case 'ai-query':
        this.handleAIQuery(sessionId, clientId, message.query);
        break;

      case 'generate-request':
        this.handleGenerateRequest(sessionId, clientId, message.prompt);
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
    }
  }

  private async handleSendRequest(
    sessionId: string,
    clientId: string,
    requestData: any
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const request: PlaygroundRequest = {
      id: this.generateId(),
      method: requestData.method || 'GET',
      url: requestData.url,
      headers: requestData.headers || {},
      body: requestData.body,
      timestamp: Date.now(),
      author: clientId,
      tags: requestData.tags || [],
    };

    session.requests.push(request);

    // Broadcast request to all clients
    this.broadcastToSession(sessionId, {
      type: 'request-sent',
      request,
    });

    try {
      // Execute the request
      const startTime = Date.now();
      const response = await this.executeRequest(request);
      const duration = Date.now() - startTime;

      const responseData: PlaygroundResponse = {
        id: this.generateId(),
        requestId: request.id,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        body: response.body,
        duration,
        timestamp: Date.now(),
        size: JSON.stringify(response.body || '').length,
      };

      session.responses.push(responseData);

      // Broadcast response
      this.broadcastToSession(sessionId, {
        type: 'response-received',
        response: responseData,
      });

      // Update metrics
      this.updateMetrics(sessionId, request, responseData);
    } catch (error) {
      console.warn(`⚠️ Request failed:`, error);

      const errorResponse: PlaygroundResponse = {
        id: this.generateId(),
        requestId: request.id,
        status: 0,
        statusText: 'Network Error',
        headers: {},
        body: { error: error instanceof Error ? error.message : 'Unknown error' },
        duration: 0,
        timestamp: Date.now(),
        size: 0,
      };

      session.responses.push(errorResponse);

      this.broadcastToSession(sessionId, {
        type: 'response-received',
        response: errorResponse,
      });
    }
  }

  private async executeRequest(request: PlaygroundRequest): Promise<any> {
    const url = new URL(request.url);

    // For demo purposes, we'll simulate API calls
    // In a real implementation, this would make actual HTTP requests
    if (url.hostname === 'api.example.com') {
      return this.simulateAPIResponse(request);
    }

    // For local development, proxy to the actual server
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return this.proxyToLocalServer(request);
    }

    // Default simulation
    return this.simulateAPIResponse(request);
  }

  private simulateAPIResponse(request: PlaygroundRequest): any {
    const responses: Record<string, any> = {
      'GET /users': {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
        body: {
          users: [
            { id: 1, name: 'John Doe', email: 'john@example.com' },
            { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
          ],
        },
      },
      'POST /users': {
        status: 201,
        statusText: 'Created',
        headers: { 'Content-Type': 'application/json' },
        body: { id: 3, ...request.body, createdAt: new Date().toISOString() },
      },
      'GET /health': {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
        body: { status: 'healthy', timestamp: new Date().toISOString() },
      },
    };

    const key = `${request.method} ${new URL(request.url).pathname}`;
    return (
      responses[key] || {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Endpoint not found' },
      }
    );
  }

  private async proxyToLocalServer(request: PlaygroundRequest): Promise<any> {
    // This would proxy requests to the local development server
    // For now, return a mock response
    return {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
      body: { message: 'Proxied to local server', originalUrl: request.url },
    };
  }

  private handleCursorUpdate(sessionId: string, clientId: string, cursor: any): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const collaborator = session.collaborators.get(clientId);
    if (collaborator) {
      collaborator.cursor = cursor;

      this.broadcastToSession(sessionId, {
        type: 'cursor-update',
        clientId,
        cursor,
      });
    }
  }

  private handleSelectionUpdate(sessionId: string, clientId: string, selection: any): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const collaborator = session.collaborators.get(clientId);
    if (collaborator) {
      collaborator.selection = selection;

      this.broadcastToSession(sessionId, {
        type: 'selection-update',
        clientId,
        selection,
      });
    }
  }

  private async handleAIQuery(sessionId: string, clientId: string, query: string): Promise<void> {
    if (!this.config.enableAI) return;

    try {
      const response = await this.aiClient.query(query);

      this.sendToClient(sessionId, clientId, {
        type: 'ai-response',
        query,
        response,
      });
    } catch (error) {
      console.warn('⚠️ AI query failed:', error);

      this.sendToClient(sessionId, clientId, {
        type: 'ai-error',
        query,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleGenerateRequest(
    sessionId: string,
    clientId: string,
    prompt: string
  ): Promise<void> {
    if (!this.config.enableAI) return;

    try {
      const request = await this.aiClient.generateRequest(prompt);

      this.sendToClient(sessionId, clientId, {
        type: 'request-generated',
        prompt,
        request,
      });
    } catch (error) {
      console.warn('⚠️ Request generation failed:', error);

      this.sendToClient(sessionId, clientId, {
        type: 'generation-error',
        prompt,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private handleDisconnection(sessionId: string, clientId: string, ws: WebSocket): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.clients.delete(ws);
    session.collaborators.delete(clientId);

    console.log(`👤 Client ${clientId} left session ${sessionId}`);

    // Broadcast collaborator left
    this.broadcastToSession(sessionId, {
      type: 'collaborator-left',
      clientId,
    });

    // Clean up empty sessions
    if (session.clients.size === 0) {
      this.sessions.delete(sessionId);
    }
  }

  private createSession(): string {
    const sessionId = this.generateId();
    const session: PlaygroundSession = {
      id: sessionId,
      clients: new Set(),
      requests: [],
      responses: [],
      collaborators: new Map(),
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    this.sessions.set(sessionId, session);
    return sessionId;
  }

  private broadcastToSession(sessionId: string, message: any, exclude?: WebSocket): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const messageStr = JSON.stringify(message);

    for (const client of session.clients) {
      if (client !== exclude && client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    }
  }

  private sendToClient(sessionId: string, clientId: string, message: any): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Find the client's WebSocket
    for (const client of session.clients) {
      // In a real implementation, you'd need to track client IDs to WebSockets
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
        break;
      }
    }
  }

  private getSessionData(session: PlaygroundSession) {
    return {
      id: session.id,
      requests: session.requests.slice(-50), // Last 50 requests
      responses: session.responses.slice(-50), // Last 50 responses
      collaborators: Array.from(session.collaborators.values()),
      createdAt: session.createdAt,
    };
  }

  private startSessionCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const timeout = this.config.sessionTimeout!;

      for (const [sessionId, session] of this.sessions) {
        if (now - session.lastActivity > timeout) {
          console.log(`🧹 Cleaning up inactive session ${sessionId}`);
          this.sessions.delete(sessionId);
        }
      }
    }, 60000); // Check every minute
  }

  private startMetricsCollection(): void {
    if (!this.config.enableMetrics) return;

    setInterval(() => {
      for (const [sessionId, session] of this.sessions) {
        const metrics = {
          sessionId,
          clientCount: session.clients.size,
          requestCount: session.requests.length,
          responseCount: session.responses.length,
          collaboratorCount: session.collaborators.size,
          averageResponseTime: this.calculateAverageResponseTime(session),
          uptime: Date.now() - session.createdAt,
        };

        this.metrics.set(sessionId, metrics);
      }
    }, 10000); // Update every 10 seconds
  }

  private calculateAverageResponseTime(session: PlaygroundSession): number {
    if (session.responses.length === 0) return 0;

    const total = session.responses.reduce((sum, response) => sum + response.duration, 0);
    return Math.round(total / session.responses.length);
  }

  private updateMetrics(
    sessionId: string,
    request: PlaygroundRequest,
    response: PlaygroundResponse
  ): void {
    // Update session metrics
    const metrics = this.metrics.get(sessionId) || {};
    metrics.lastRequestAt = Date.now();
    metrics.totalRequests = (metrics.totalRequests || 0) + 1;
    metrics.totalResponseTime = (metrics.totalResponseTime || 0) + response.duration;

    if (response.status >= 200 && response.status < 300) {
      metrics.successCount = (metrics.successCount || 0) + 1;
    } else {
      metrics.errorCount = (metrics.errorCount || 0) + 1;
    }

    this.metrics.set(sessionId, metrics);
  }

  private generateId(): string {
    return randomBytes(8).toString('base64url') + Date.now().toString(36);
  }

  private getRandomColor(): string {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    const randomValue = randomBytes(4).readUInt32BE(0) / 0xffffffff;
    return colors[Math.floor(randomValue * colors.length)];
  }

  private isOriginAllowed(origin: string): boolean {
    return (
      this.config.allowedOrigins!.includes('*') || this.config.allowedOrigins!.includes(origin)
    );
  }

  private getPlaygroundHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenSpeed API Playground</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #1a1a1a; color: #fff; }
        .container { display: flex; height: 100vh; }
        .sidebar { width: 300px; background: #2d2d2d; padding: 20px; overflow-y: auto; }
        .main { flex: 1; display: flex; flex-direction: column; }
        .request-panel { background: #1a1a1a; padding: 20px; border-bottom: 1px solid #333; }
        .response-panel { flex: 1; background: #1a1a1a; padding: 20px; overflow-y: auto; }
        .input-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, select, textarea { width: 100%; padding: 8px; background: #333; border: 1px solid #555; color: #fff; border-radius: 4px; }
        button { background: #007acc; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; }
        button:hover { background: #005aa3; }
        .response { background: #2d2d2d; padding: 15px; border-radius: 4px; margin-top: 10px; }
        .status { font-weight: bold; }
        .status.success { color: #4CAF50; }
        .status.error { color: #f44336; }
        .collaborators { margin-top: 20px; }
        .collaborator { display: flex; align-items: center; margin-bottom: 10px; }
        .collaborator-color { width: 12px; height: 12px; border-radius: 50%; margin-right: 8px; }
        .ai-panel { background: #2d2d2d; padding: 15px; margin-top: 10px; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="sidebar">
            <h2>API Playground</h2>
            <div class="collaborators" id="collaborators"></div>
            <div class="ai-panel">
                <h3>AI Assistant</h3>
                <textarea id="ai-query" placeholder="Ask AI for help..." rows="3"></textarea>
                <button onclick="askAI()">Ask AI</button>
                <div id="ai-response"></div>
            </div>
        </div>
        <div class="main">
            <div class="request-panel">
                <div class="input-group">
                    <label>Method:</label>
                    <select id="method">
                        <option>GET</option>
                        <option>POST</option>
                        <option>PUT</option>
                        <option>DELETE</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>URL:</label>
                    <input type="text" id="url" value="/health" placeholder="e.g., /api/users or http://localhost:3000/health">
                </div>
                <div class="input-group">
                    <label>Headers (JSON):</label>
                    <textarea id="headers" rows="3">{"Content-Type": "application/json"}</textarea>
                </div>
                <div class="input-group">
                    <label>Body (JSON):</label>
                    <textarea id="body" rows="5"></textarea>
                </div>
                <button onclick="sendRequest()">Send Request</button>
                <button onclick="generateRequest()">Generate with AI</button>
            </div>
            <div class="response-panel">
                <h3>Response</h3>
                <div id="responses"></div>
            </div>
        </div>
    </div>

    <script>
        let ws;
        let sessionId;
        let clientId;

        function connect() {
            ws = new WebSocket('ws://localhost:3001');

            ws.onopen = function() {
                console.log('Connected to playground');
            };

            ws.onmessage = function(event) {
                const message = JSON.parse(event.data);
                handleMessage(message);
            };

            ws.onclose = function() {
                console.log('Disconnected from playground');
                setTimeout(connect, 1000);
            };
        }

        function handleMessage(message) {
            switch(message.type) {
                case 'welcome':
                    sessionId = message.sessionId;
                    clientId = message.clientId;
                    updateCollaborators(message.session.collaborators);
                    break;
                case 'collaborator-joined':
                case 'collaborator-left':
                    // Update collaborators list
                    break;
                case 'request-sent':
                    addRequest(message.request);
                    break;
                case 'response-received':
                    addResponse(message.response);
                    break;
                case 'ai-response':
                    showAIResponse(message.response);
                    break;
            }
        }

        function sendRequest() {
            const request = {
                method: document.getElementById('method').value,
                url: document.getElementById('url').value,
                headers: JSON.parse(document.getElementById('headers').value || '{}'),
                body: document.getElementById('body').value ? JSON.parse(document.getElementById('body').value) : undefined
            };

            ws.send(JSON.stringify({
                type: 'send-request',
                request
            }));
        }

        function generateRequest() {
            const prompt = 'Generate an API request for ' + document.getElementById('url').value;
            ws.send(JSON.stringify({
                type: 'generate-request',
                prompt
            }));
        }

        function askAI() {
            const query = document.getElementById('ai-query').value;
            if (query.trim()) {
                ws.send(JSON.stringify({
                    type: 'ai-query',
                    query
                }));
            }
        }

        function addRequest(request) {
            const div = document.createElement('div');
            div.className = 'response';
            div.textContent = request.method + ' ' + request.url + ' - Sent at ' + new Date(request.timestamp).toLocaleTimeString();
            document.getElementById('responses').appendChild(div);
        }

        function addResponse(response) {
            const div = document.createElement('div');
            div.className = 'response status ' + (response.status >= 200 && response.status < 300 ? 'success' : 'error');
            div.textContent = 'Status: ' + response.status + ' ' + response.statusText + '\n' +
                'Duration: ' + response.duration + 'ms | Size: ' + response.size + ' bytes\n' +
                JSON.stringify(response.body, null, 2);
            document.getElementById('responses').appendChild(div);
            document.getElementById('responses').scrollTop = document.getElementById('responses').scrollHeight;
        }

        function updateCollaborators(collaborators) {
            const container = document.getElementById('collaborators');
            container.textContent = 'Collaborators';
            const h3 = document.createElement('h3');
            h3.textContent = 'Collaborators';
            container.appendChild(h3);
            collaborators.forEach(collab => {
                const div = document.createElement('div');
                div.className = 'collaborator';
                div.textContent = collab.name;
                const colorDiv = document.createElement('div');
                colorDiv.className = 'collaborator-color';
                colorDiv.style.background = collab.color;
                div.insertBefore(colorDiv, div.firstChild);
                container.appendChild(div);
            });
        }

        function showAIResponse(response) {
            const div = document.getElementById('ai-response');
            div.textContent = 'AI: ' + response;
        }

        connect();
    </script>
</body>
</html>`;
  }

  private handleAPIRequest(req: any, res: any): void {
    // Handle API requests for metrics, etc.
    if (req.url === '/api/metrics') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(Object.fromEntries(this.metrics)));
    } else if (req.url === '/api/sessions') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(Array.from(this.sessions.keys())));
    } else {
      res.writeHead(404);
      res.end('API endpoint not found');
    }
  }

  async stop(): Promise<void> {
    if (this.wss) {
      this.wss.close();
    }

    console.log('🛑 API Playground stopped');
  }

  createNewSession(): string {
    return this.createSession();
  }

  getSessionById(id: string) {
    return this.sessions.get(id);
  }

  getPlaygroundInterface(): string {
    return this.getPlaygroundHTML();
  }

  getStats() {
    return {
      sessions: this.sessions.size,
      totalClients: Array.from(this.sessions.values()).reduce((sum, s) => sum + s.clients.size, 0),
      totalRequests: Array.from(this.sessions.values()).reduce(
        (sum, s) => sum + s.requests.length,
        0
      ),
      metrics: Object.fromEntries(this.metrics),
    };
  }
}

class AIAssistant {
  async query(question: string): Promise<string> {
    // Simulate AI response - in real implementation, this would call an AI service
    const responses: Record<string, string> = {
      'how to test an api':
        'To test an API, send requests with different methods (GET, POST, etc.) and verify the responses match your expectations.',
      'what is rest':
        'REST (Representational State Transfer) is an architectural style for designing networked applications.',
      authentication:
        'Common authentication methods include API keys, OAuth, JWT tokens, and Basic Auth.',
      'error handling':
        'Always check HTTP status codes and handle errors gracefully in your applications.',
    };

    const lowerQuestion = question.toLowerCase();
    return (
      responses[lowerQuestion] ||
      `I understand you're asking about "${question}". For API testing, focus on endpoints, request/response formats, and error scenarios.`
    );
  }

  async generateRequest(prompt: string): Promise<PlaygroundRequest> {
    // Simulate AI-generated request - in real implementation, this would use AI
    if (prompt.toLowerCase().includes('user')) {
      return {
        id: 'ai-generated-' + Date.now(),
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: { Authorization: 'Bearer your-token' },
        timestamp: Date.now(),
        author: 'ai-assistant',
        aiGenerated: true,
        tags: ['users', 'ai-generated'],
      };
    }

    return {
      id: 'ai-generated-' + Date.now(),
      method: 'GET',
      url: 'https://api.example.com/health',
      headers: { Accept: 'application/json' },
      timestamp: Date.now(),
      author: 'ai-assistant',
      aiGenerated: true,
      tags: ['health', 'ai-generated'],
    };
  }
}

export function playgroundPlugin(config: PlaygroundConfig = {}): Plugin {
  let manager: PlaygroundManager;

  return {
    name: 'playground',
    setup(app: any) {
      manager = new PlaygroundManager(config);

      // Add playground context
      app.use(async (ctx: Context, next: any) => {
        ctx.playground = {
          stats: () => manager.getStats(),
          createSession: () => manager.createNewSession(),
          getSession: (id: string) => manager.getSessionById(id),
        };
        await next();
      });

      // Start playground system
      manager.start().catch(console.error);

      // Add playground routes
      app.get('/playground', async (ctx: Context) => {
        ctx.res.body = manager.getPlaygroundInterface();
        ctx.res.headers = ctx.res.headers || {};
        ctx.res.headers['Content-Type'] = 'text/html';
      });

      app.get('/api/playground/metrics', async (ctx: Context) => {
        ctx.res.body = manager.getStats();
      });

      // Cleanup on app shutdown
      process.on('SIGINT', async () => {
        await manager.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        await manager.stop();
        process.exit(0);
      });
    },
  };
}
