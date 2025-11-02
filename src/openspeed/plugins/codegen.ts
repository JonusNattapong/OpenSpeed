import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import * as ts from 'typescript';
import type { Context } from '../context.js';
import type { Plugin } from '../index.js';

interface CodeGenConfig {
  outputDir: string;
  languages: ('typescript' | 'javascript' | 'python' | 'go' | 'rust')[];
  generateDocs: boolean;
  generateTests: boolean;
  baseUrl?: string;
  apiVersion?: string;
  author?: string;
  license?: string;
}

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, Record<string, OpenAPIOperation>>;
  components?: {
    schemas?: Record<string, OpenAPISchema>;
    parameters?: Record<string, OpenAPIParameter>;
    responses?: Record<string, OpenAPIResponse>;
  };
}

interface OpenAPIOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: {
    content: Record<string, { schema: OpenAPISchema }>;
  };
  responses: Record<string, OpenAPIResponse>;
  tags?: string[];
}

interface OpenAPISchema {
  type?: string;
  format?: string;
  properties?: Record<string, OpenAPISchema>;
  items?: OpenAPISchema;
  required?: string[];
  enum?: any[];
  $ref?: string;
  oneOf?: OpenAPISchema[];
  allOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
  additionalProperties?: boolean | OpenAPISchema;
}

interface OpenAPIParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  required?: boolean;
  schema: OpenAPISchema;
  description?: string;
}

interface OpenAPIResponse {
  description: string;
  content?: Record<string, { schema: OpenAPISchema }>;
}

class CodeGenerator {
  private spec: OpenAPISpec;
  private config: CodeGenConfig;
  private typeCache = new Map<string, string>();
  private schemaCache = new Map<string, OpenAPISchema>();

  constructor(spec: OpenAPISpec, config: CodeGenConfig) {
    this.spec = spec;
    this.config = config;
  }

  async generate(): Promise<void> {
    console.log('🚀 Generating code from OpenAPI spec...');

    // Ensure output directory exists
    mkdirSync(this.config.outputDir, { recursive: true });

    // Generate for each language
    for (const language of this.config.languages) {
      await this.generateForLanguage(language);
    }

    // Generate documentation
    if (this.config.generateDocs) {
      await this.generateDocumentation();
    }

    // Generate tests
    if (this.config.generateTests) {
      await this.generateTests();
    }

    console.log('✅ Code generation completed!');
  }

  private async generateForLanguage(language: string): Promise<void> {
    const outputDir = join(this.config.outputDir, language);
    mkdirSync(outputDir, { recursive: true });

    switch (language) {
      case 'typescript':
        await this.generateTypeScript(outputDir);
        break;
      case 'javascript':
        await this.generateJavaScript(outputDir);
        break;
      case 'python':
        await this.generatePython(outputDir);
        break;
      case 'go':
        await this.generateGo(outputDir);
        break;
      case 'rust':
        await this.generateRust(outputDir);
        break;
    }
  }

  private async generateTypeScript(outputDir: string): Promise<void> {
    const types = this.generateTypeScriptTypes();
    const client = this.generateTypeScriptClient();
    const index = this.generateTypeScriptIndex();

    writeFileSync(join(outputDir, 'types.ts'), types);
    writeFileSync(join(outputDir, 'client.ts'), client);
    writeFileSync(join(outputDir, 'index.ts'), index);

    console.log(`📝 Generated TypeScript SDK in ${outputDir}`);
  }

  private generateTypeScriptTypes(): string {
    let code = `// Auto-generated from OpenAPI spec: ${this.spec.info.title} v${this.spec.info.version}
// Generated at: ${new Date().toISOString()}
// Author: ${this.config.author || 'OpenSpeed Code Generator'}

`;

    // Generate type definitions for schemas
    if (this.spec.components?.schemas) {
      for (const [name, schema] of Object.entries(this.spec.components.schemas)) {
        code += this.generateTypeScriptType(name, schema) + '\n\n';
      }
    }

    // Generate operation types
    code += '// API Operation Types\n\n';

    for (const [path, methods] of Object.entries(this.spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        const operationName = this.getOperationName(operation, path, method);

        // Request type
        code += `export interface ${operationName}Request {\n`;
        if (operation.parameters) {
          for (const param of operation.parameters) {
            const optional = param.required ? '' : '?';
            const type = this.schemaToTypeScriptType(param.schema);
            code += `  ${param.name}${optional}: ${type};\n`;
          }
        }
        if (operation.requestBody?.content?.['application/json']) {
          const bodyType = this.schemaToTypeScriptType(operation.requestBody.content['application/json'].schema);
          code += `  body: ${bodyType};\n`;
        }
        code += '}\n\n';

        // Response types
        for (const [statusCode, response] of Object.entries(operation.responses)) {
          if (response.content?.['application/json']) {
            const responseType = this.schemaToTypeScriptType(response.content['application/json'].schema);
            code += `export interface ${operationName}${statusCode}Response {\n`;
            code += `  data: ${responseType};\n`;
            code += '}\n\n';
          }
        }
      }
    }

    return code;
  }

  private generateTypeScriptType(name: string, schema: OpenAPISchema): string {
    if (this.typeCache.has(name)) {
      return this.typeCache.get(name)!;
    }

    let typeDef = `export interface ${name} {\n`;

    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const required = schema.required?.includes(propName);
        const optional = required ? '' : '?';
        const propType = this.schemaToTypeScriptType(propSchema);
        typeDef += `  ${propName}${optional}: ${propType};\n`;
      }
    }

    typeDef += '}';

    this.typeCache.set(name, typeDef);
    return typeDef;
  }

  private schemaToTypeScriptType(schema: OpenAPISchema): string {
    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop()!;
      return refName;
    }

    switch (schema.type) {
      case 'string':
        if (schema.enum) {
          return schema.enum.map(v => `"${v}"`).join(' | ');
        }
        return 'string';

      case 'number':
      case 'integer':
        return schema.format === 'int64' ? 'bigint' : 'number';

      case 'boolean':
        return 'boolean';

      case 'array':
        const itemType = schema.items ? this.schemaToTypeScriptType(schema.items) : 'any';
        return `${itemType}[]`;

      case 'object':
        if (schema.additionalProperties) {
          const valueType = typeof schema.additionalProperties === 'boolean'
            ? 'any'
            : this.schemaToTypeScriptType(schema.additionalProperties);
          return `Record<string, ${valueType}>`;
        }
        return 'Record<string, any>';

      default:
        return 'any';
    }
  }

  private generateTypeScriptClient(): string {
    const baseUrl = this.config.baseUrl || this.spec.servers?.[0]?.url || '';

    let code = `// Auto-generated TypeScript client for ${this.spec.info.title}
// Generated at: ${new Date().toISOString()}

import type * as Types from './types.js';

export class ${this.spec.info.title.replace(/\s+/g, '')}Client {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string = '${baseUrl}', defaultHeaders: Record<string, string> = {}) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...defaultHeaders
    };
  }

  private async request<T>(
    method: string,
    path: string,
    options: {
      params?: Record<string, any>;
      body?: any;
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);

    // Add query parameters
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers = { ...this.defaultHeaders, ...options.headers };

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
    }

    return response.json();
  }

`;

    // Generate methods for each operation
    for (const [path, methods] of Object.entries(this.spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        const operationName = this.getOperationName(operation, path, method);
        const methodName = operationName.charAt(0).toLowerCase() + operationName.slice(1);

        code += `  async ${methodName}(request: Types.${operationName}Request): Promise<any> {\n`;

        // Build path with parameters
        let apiPath = path;
        const params: string[] = [];
        const queryParams: string[] = [];

        if (operation.parameters) {
          for (const param of operation.parameters) {
            if (param.in === 'path') {
              apiPath = apiPath.replace(`{${param.name}}`, `\${request.${param.name}}`);
            } else if (param.in === 'query') {
              queryParams.push(param.name);
            }
          }
        }

        code += `    return this.request('${method.toUpperCase()}', \`\${this.baseUrl}${apiPath}\`, {\n`;

        if (queryParams.length > 0) {
          code += `      params: {\n`;
          for (const param of queryParams) {
            code += `        ${param}: request.${param},\n`;
          }
          code += `      },\n`;
        }

        if (operation.requestBody?.content?.['application/json']) {
          code += `      body: request.body,\n`;
        }

        code += `    });\n`;
        code += `  }\n\n`;
      }
    }

    code += '}\n';
    return code;
  }

  private generateTypeScriptIndex(): string {
    return `// Main entry point for ${this.spec.info.title} SDK
export { ${this.spec.info.title.replace(/\s+/g, '')}Client } from './client.js';
export type * from './types.js';
`;
  }

  private async generateJavaScript(outputDir: string): Promise<void> {
    // Generate JavaScript version (similar to TypeScript but without types)
    const client = this.generateTypeScriptClient().replace(/import type .* from .*\n/g, '');
    const types = '// Type definitions available in types.d.ts\n';

    writeFileSync(join(outputDir, 'client.js'), client);
    writeFileSync(join(outputDir, 'types.d.ts'), this.generateTypeScriptTypes());
    writeFileSync(join(outputDir, 'index.js'), 'module.exports = require(\'./client.js\');');

    console.log(`📝 Generated JavaScript SDK in ${outputDir}`);
  }

  private async generatePython(outputDir: string): Promise<void> {
    let code = `"""
Auto-generated Python client for ${this.spec.info.title}
Generated at: ${new Date().toISOString()}
"""

import requests
import json
from typing import Dict, Any, Optional
from dataclasses import dataclass

@dataclass
class ${this.spec.info.title.replace(/\s+/g, '')}Client:
    base_url: str = "${this.config.baseUrl || this.spec.servers?.[0]?.url || ''}"
    timeout: int = 30

    def _request(self, method: str, path: str, **kwargs) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        response = requests.request(method, url, timeout=self.timeout, **kwargs)

        if not response.ok:
            raise Exception(f"HTTP {response.status_code}: {response.text}")

        return response.json()

`;

    // Generate Python methods
    for (const [path, methods] of Object.entries(this.spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        const operationName = this.getOperationName(operation, path, method);
        const methodName = operationName.charAt(0).toLowerCase() + operationName.slice(1);

        code += `    def ${methodName}(self, **kwargs) -> Dict[str, Any]:\n`;
        code += `        """${operation.summary || operation.description || ''}"""\n`;

        let apiPath = path;
        if (operation.parameters) {
          for (const param of operation.parameters) {
            if (param.in === 'path') {
              apiPath = apiPath.replace(`{${param.name}}`, `{${param.name}}`);
            }
          }
        }

        code += `        path = f"${apiPath}"\n`;
        code += `        return self._request("${method.toUpperCase()}", path, **kwargs)\n\n`;
      }
    }

    code += '\n# Type stubs would be generated here for full type safety';

    writeFileSync(join(outputDir, '__init__.py'), '');
    writeFileSync(join(outputDir, 'client.py'), code);

    console.log(`🐍 Generated Python SDK in ${outputDir}`);
  }

  private async generateGo(outputDir: string): Promise<void> {
    let code = `// Auto-generated Go client for ${this.spec.info.title}
// Generated at: ${new Date().toISOString()}

package ${this.spec.info.title.toLowerCase().replace(/\s+/g, '')}

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "time"
)

type Client struct {
    BaseURL    string
    HTTPClient *http.Client
}

func NewClient(baseURL string) *Client {
    return &Client{
        BaseURL: baseURL,
        HTTPClient: &http.Client{Timeout: 30 * time.Second},
    }
}

func (c *Client) doRequest(method, path string, body interface{}) (map[string]interface{}, error) {
    var reqBody io.Reader
    if body != nil {
        jsonData, err := json.Marshal(body)
        if err != nil {
            return nil, err
        }
        reqBody = bytes.NewBuffer(jsonData)
    }

    req, err := http.NewRequest(method, c.BaseURL+path, reqBody)
    if err != nil {
        return nil, err
    }

    req.Header.Set("Content-Type", "application/json")

    resp, err := c.HTTPClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    if resp.StatusCode >= 400 {
        return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, resp.Status)
    }

    var result map[string]interface{}
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }

    return result, nil
}

`;

    // Generate Go methods
    for (const [path, methods] of Object.entries(this.spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        const operationName = this.getOperationName(operation, path, method);

        code += `func (c *Client) ${operationName}(params map[string]interface{}) (map[string]interface{}, error) {\n`;
        code += `    // ${operation.summary || operation.description || ''}\n`;

        let apiPath = path;
        if (operation.parameters) {
          for (const param of operation.parameters) {
            if (param.in === 'path') {
              apiPath = apiPath.replace(`{${param.name}}`, `\${params["${param.name}"].(string)}`);
            }
          }
        }

        code += `    path := "${apiPath}"\n`;
        code += `    return c.doRequest("${method.toUpperCase()}", path, params)\n`;
        code += `}\n\n`;
      }
    }

    writeFileSync(join(outputDir, 'client.go'), code);

    console.log(`🔵 Generated Go SDK in ${outputDir}`);
  }

  private async generateRust(outputDir: string): Promise<void> {
    let code = `// Auto-generated Rust client for ${this.spec.info.title}
// Generated at: ${new Date().toISOString()}

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone)]
pub struct ${this.spec.info.title.replace(/\s+/g, '')}Client {
    client: Client,
    base_url: String,
}

impl ${this.spec.info.title.replace(/\s+/g, '')}Client {
    pub fn new(base_url: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.to_string(),
        }
    }

    async fn request<T: for<'de> Deserialize<'de>>(
        &self,
        method: reqwest::Method,
        path: &str,
        body: Option<serde_json::Value>,
    ) -> Result<T, Box<dyn std::error::Error>> {
        let url = format!("{}{}", self.base_url, path);
        let mut request = self.client.request(method, &url);

        if let Some(body) = body {
            request = request.json(&body);
        }

        let response = request.send().await?;
        let status = response.status();

        if !status.is_success() {
            return Err(format!("HTTP {}: {}", status, status.canonical_reason().unwrap_or("Unknown")).into());
        }

        let result = response.json().await?;
        Ok(result)
    }

`;

    // Generate Rust methods
    for (const [path, methods] of Object.entries(this.spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        const operationName = this.getOperationName(operation, path, method);

        code += `    pub async fn ${operationName.toLowerCase()}(&self, params: HashMap<String, serde_json::Value>) -> Result<serde_json::Value, Box<dyn std::error::Error>> {\n`;
        code += `        // ${operation.summary || operation.description || ''}\n`;

        let apiPath = path;
        if (operation.parameters) {
          for (const param of operation.parameters) {
            if (param.in === 'path') {
              apiPath = apiPath.replace(`{${param.name}}`, `\${params.get("${param.name}").unwrap_or(&serde_json::Value::Null)}`);
            }
          }
        }

        code += `        let path = "${apiPath}";\n`;
        code += `        self.request(reqwest::Method::${method.toUpperCase()}, path, None).await\n`;
        code += `    }\n\n`;
      }
    }

    code += '}\n';

    writeFileSync(join(outputDir, 'lib.rs'), code);

    console.log(`🦀 Generated Rust SDK in ${outputDir}`);
  }

  private async generateDocumentation(): Promise<void> {
    const docsDir = join(this.config.outputDir, 'docs');
    mkdirSync(docsDir, { recursive: true });

    let markdown = `# ${this.spec.info.title}

${this.spec.info.description || ''}

**Version:** ${this.spec.info.version}
**Generated:** ${new Date().toISOString()}

## API Endpoints

`;

    for (const [path, methods] of Object.entries(this.spec.paths)) {
      markdown += `### \`${path}\`\n\n`;

      for (const [method, operation] of Object.entries(methods)) {
        markdown += `#### ${method.toUpperCase()}\n\n`;
        markdown += `**${operation.summary || 'No summary'}**\n\n`;

        if (operation.description) {
          markdown += `${operation.description}\n\n`;
        }

        if (operation.parameters) {
          markdown += '**Parameters:**\n\n';
          for (const param of operation.parameters) {
            markdown += `- \`${param.name}\` (${param.in}) - ${param.description || 'No description'}\n`;
          }
          markdown += '\n';
        }

        if (operation.requestBody?.content?.['application/json']) {
          markdown += '**Request Body:** `application/json`\n\n';
        }

        markdown += '**Responses:**\n\n';
        for (const [statusCode, response] of Object.entries(operation.responses)) {
          markdown += `- \`${statusCode}\`: ${response.description}\n`;
        }

        markdown += '\n---\n\n';
      }
    }

    writeFileSync(join(docsDir, 'README.md'), markdown);
    console.log(`📚 Generated documentation in ${docsDir}`);
  }

  private async generateTests(): Promise<void> {
    const testsDir = join(this.config.outputDir, 'tests');
    mkdirSync(testsDir, { recursive: true });

    let testCode = `// Auto-generated tests for ${this.spec.info.title}
// Generated at: ${new Date().toISOString()}

import { describe, it, expect } from 'vitest';
import { ${this.spec.info.title.replace(/\s+/g, '')}Client } from '../typescript/index.js';

describe('${this.spec.info.title} API', () => {
  const client = new ${this.spec.info.title.replace(/\s+/g, '')}Client('http://localhost:3000');

`;

    // Generate basic tests for each operation
    for (const [path, methods] of Object.entries(this.spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        const operationName = this.getOperationName(operation, path, method);
        const methodName = operationName.charAt(0).toLowerCase() + operationName.slice(1);

        testCode += `  it('should ${methodName.replace(/([A-Z])/g, ' $1').toLowerCase()}', async () => {\n`;
        testCode += `    // This is a basic test - customize as needed\n`;
        testCode += `    try {\n`;
        testCode += `      const result = await client.${methodName}({});\n`;
        testCode += `      expect(result).toBeDefined();\n`;
        testCode += `    } catch (error) {\n`;
        testCode += `      // Expected for mock server - remove when using real API\n`;
        testCode += `      expect(error.message).toContain('HTTP');\n`;
        testCode += `    }\n`;
        testCode += `  });\n\n`;
      }
    }

    testCode += '});\n';

    writeFileSync(join(testsDir, 'api.test.ts'), testCode);
    console.log(`🧪 Generated tests in ${testsDir}`);
  }

  private getOperationName(operation: OpenAPIOperation, path: string, method: string): string {
    if (operation.operationId) {
      return operation.operationId.charAt(0).toUpperCase() + operation.operationId.slice(1);
    }

    // Generate from path and method
    const pathParts = path.split('/').filter(p => p && !p.startsWith('{'));
    const methodPrefix = method.charAt(0).toUpperCase() + method.slice(1);
    const pathSuffix = pathParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');

    return methodPrefix + pathSuffix;
  }
}

export function codeGenPlugin(config: CodeGenConfig = {
  outputDir: './generated',
  languages: ['typescript'],
  generateDocs: true,
  generateTests: true
}): Plugin {
  let generator: CodeGenerator | null = null;

  return {
    name: 'codegen',
    setup(app: any) {
      // Add code generation context
      app.use(async (ctx: Context, next: any) => {
        ctx.codegen = {
          generateFromSpec: async (specPath: string) => {
            try {
              const specContent = readFileSync(specPath, 'utf-8');
              const spec = JSON.parse(specContent) as OpenAPISpec;
              generator = new CodeGenerator(spec, config);
              await generator.generate();
              return { success: true };
            } catch (error) {
              console.error('Code generation failed:', error);
              return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
          },
          generateFromUrl: async (specUrl: string) => {
            try {
              const response = await fetch(specUrl);
              const spec = await response.json() as OpenAPISpec;
              generator = new CodeGenerator(spec, config);
              await generator.generate();
              return { success: true };
            } catch (error) {
              console.error('Code generation from URL failed:', error);
              return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
          }
        };
        await next();
      });

      // Add code generation routes
      app.post('/api/codegen/generate', async (ctx: Context) => {
        const body = ctx.req.body as { specPath?: string; specUrl?: string } || {};

        if (body.specPath) {
          ctx.res.body = await (ctx.codegen as any).generateFromSpec(body.specPath);
        } else if (body.specUrl) {
          ctx.res.body = await (ctx.codegen as any).generateFromUrl(body.specUrl);
        } else {
          ctx.res.status = 400;
          ctx.res.body = { error: 'Either specPath or specUrl is required' };
        }
      });

      app.get('/api/codegen/status', async (ctx: Context) => {
        ctx.res.body = {
          configured: true,
          outputDir: config.outputDir,
          languages: config.languages,
          generateDocs: config.generateDocs,
          generateTests: config.generateTests
        };
      });
    }
  };
}