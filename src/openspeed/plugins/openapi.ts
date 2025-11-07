import type { Context } from '../context.js';
import type { ZodSchema } from 'zod';
import { zodToTs, createAuxiliaryTypeStore } from 'zod-to-ts';

function generatePythonClient(routes: RouteInfo[]): string {
  let clientCode = `# Generated OpenSpeed Python Client
# Requires requests library
import requests
import json
from typing import Dict, Any, Optional, List

class OpenSpeedClient:
    def __init__(self, base_url: str = ""):
        self.base_url = base_url
        self.session = requests.Session()

`;

  for (const route of routes) {
    const path = route.path;
    const method = route.method.toUpperCase();
    const funcName = path.replace(/:/g, '_').replace(/\//g, '_').replace(/^_/, '') || 'root';

    // Collect parameters
    const pathParams: Array<{ name: string }> = [];
    const queryParams: Array<{ name: string }> = [];

    if (route.parameters) {
      for (const param of route.parameters) {
        if (param.in === 'path') pathParams.push({ name: param.name });
        else if (param.in === 'query') queryParams.push({ name: param.name });
      }
    }

    // Add path params from route path
    const pathParamNames = (route.path.match(/:(\w+)/g) || []).map((p) => p.slice(1));
    for (const name of pathParamNames) {
      if (!pathParams.find((p) => p.name === name)) {
        pathParams.push({ name });
      }
    }

    // Build parameter list
    const paramList: string[] = [];
    paramList.push('self');
    if (pathParams.length > 0) paramList.push(`path_params: Dict[str, str]`);
    if (queryParams.length > 0) paramList.push(`query_params: Optional[Dict[str, str]] = None`);
    if (route.requestBody && ['POST', 'PUT', 'PATCH'].includes(method))
      paramList.push(`body: Optional[Any] = None`);
    paramList.push(`options: Optional[Dict[str, str]] = None`);
    const params = paramList.join(', ');

    clientCode += `    def ${funcName}(${params}) -> Dict[str, Any]:\n`;

    // URL construction
    let urlTemplate = route.path;
    for (const p of pathParams) {
      urlTemplate = urlTemplate.replace(`:${p.name}`, `" + path_params["${p.name}"] + "`);
    }
    clientCode += `        url = self.base_url + "${urlTemplate}"\n`;

    if (queryParams.length > 0) {
      clientCode += `        params = query_params or {}\n`;
    } else {
      clientCode += `        params = {}\n`;
    }

    // Request setup
    clientCode += `        headers = options or {}\n`;
    if (route.requestBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
      clientCode += `        if body is not None:\n`;
      clientCode += `            headers['Content-Type'] = 'application/json'\n`;
      clientCode += `            data = json.dumps(body)\n`;
      clientCode += `        else:\n`;
      clientCode += `            data = None\n`;
    } else {
      clientCode += `        data = None\n`;
    }

    clientCode += `        response = self.session.${method.toLowerCase()}(url, params=params, data=data, headers=headers)\n`;
    clientCode += `        response.raise_for_status()\n`;
    clientCode += `        return response.json()\n\n`;
  }

  clientCode += `
# Example usage:
# client = OpenSpeedClient("http://localhost:3000")
# result = client.users(path_params={"id": "123"})
`;
  return clientCode;
}

interface LanguageGenerator {
  (routes: RouteInfo[]): string;
}

const languageRegistry: Map<string, LanguageGenerator> = new Map();

// Extension to language mapping
const extensionToLanguage: Record<string, string> = {
  ts: 'typescript',
  js: 'typescript', // fallback for JS
  php: 'php',
  cpp: 'cpp',
  cc: 'cpp', // alternative C++ extension
  cxx: 'cpp', // alternative C++ extension
  rs: 'rust',
  go: 'go',
  py: 'python',
  java: 'java',
  kt: 'kotlin',
  scala: 'scala',
  cs: 'csharp',
  vb: 'vbnet',
  swift: 'swift',
  dart: 'dart',
  rb: 'ruby',
  pl: 'perl',
  lua: 'lua',
  r: 'r',
  sh: 'bash',
  ps1: 'powershell',
  m: 'matlab',
  jl: 'julia',
  hs: 'haskell',
  ml: 'ocaml',
  fs: 'fsharp',
  clj: 'clojure',
  elm: 'elm',
  ex: 'elixir',
  nim: 'nim',
  zig: 'zig',
  v: 'vlang',
  cr: 'crystal',
  d: 'dlang',
  nimble: 'nim',
};

// Initialize built-in language generators
languageRegistry.set('typescript', generateTypeScriptClient);
languageRegistry.set('php', generatePHPClient);
languageRegistry.set('cpp', generateCPPClient);
languageRegistry.set('rust', generateRustClient);
languageRegistry.set('go', generateGoClient);
languageRegistry.set('python', generatePythonClient);

function generateTypeScriptClient(routes: RouteInfo[]): string {
  let types = '';
  let clientCode = `// Generated OpenSpeed Client with End-to-End Type Safety
// Provides auto-completion, runtime validation, and type inference
import { z } from 'zod';

`;

  for (const route of routes) {
    const path = route.path;
    const method = route.method.toUpperCase();
    const funcName = path.replace(/:/g, '$').replace(/\//g, '_').replace(/^_/, '') || 'root';

    // Collect parameters
    const pathParams: Array<{ name: string; schema: ZodSchema }> = [];
    const queryParams: Array<{ name: string; schema: ZodSchema }> = [];
    const headerParams: Array<{ name: string; schema: ZodSchema }> = [];

    if (route.parameters) {
      for (const param of route.parameters) {
        if (param.in === 'path') pathParams.push({ name: param.name, schema: param.schema });
        else if (param.in === 'query') queryParams.push({ name: param.name, schema: param.schema });
        else if (param.in === 'header')
          headerParams.push({ name: param.name, schema: param.schema });
      }
    }

    // Add path params from route path if not already
    const pathParamNames = (route.path.match(/:(\w+)/g) || []).map((p) => p.slice(1));
    for (const name of pathParamNames) {
      if (!pathParams.find((p) => p.name === name)) {
        pathParams.push({ name, schema: { type: 'string' } as any }); // Assume string
      }
    }

    // Simple type generation for tests
    function simpleZodToString(schema: any): string {
      if (schema._def?.typeName === 'ZodString') return 'string';
      if (schema._def?.typeName === 'ZodNumber') return 'number';
      if (schema._def?.typeName === 'ZodBoolean') return 'boolean';
      return 'any';
    }

    // Generate types for path params
    if (pathParams.length > 0) {
      const pathParamTypes = pathParams
        .map((p) => `${p.name}: ${simpleZodToString(p.schema)}`)
        .join(', ');
      types += `export type ${funcName}PathParams = {${pathParamTypes}};\n`;
    }

    // Generate types for query params
    if (queryParams.length > 0) {
      const queryParamTypes = queryParams
        .map((p) => `${p.name}?: ${simpleZodToString(p.schema)}`)
        .join(', ');
      types += `export type ${funcName}QueryParams = {${queryParamTypes}};\n`;
    }

    // Generate types for request body
    let requestType = 'void';
    if (route.requestBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
      requestType = `${funcName}Request`;
      types += `export type ${requestType} = ${simpleZodToString(route.requestBody)};\n`;
    }

    // Generate types and schemas for responses
    let responseType = 'Response';
    if (route.responses && route.responses['200']?.schema) {
      responseType = `${funcName}Response`;
      types += `export type ${responseType} = ${simpleZodToString(route.responses['200'].schema)};\n`;
      types += `export const ${funcName}ResponseSchema = ${zodToZodCode(route.responses['200'].schema)};\n`;
    }

    // Build parameter list
    const paramList: string[] = [];
    if (pathParams.length > 0) paramList.push(`pathParams: ${funcName}PathParams`);
    if (queryParams.length > 0) paramList.push(`queryParams?: ${funcName}QueryParams`);
    if (requestType !== 'void') paramList.push(`body: ${requestType}`);
    paramList.push(`options?: {headers?: Record<string, string>; auth?: string}`);
    const params = paramList.join(', ');

    // Generate method signature
    clientCode += `  async ${funcName}(${params}): Promise<${responseType}> {\n`;

    // Generate URL construction
    let urlTemplate = route.path;
    for (const p of pathParams) {
      urlTemplate = urlTemplate.replace(`:${p.name}`, `\${pathParams.${p.name}}`);
    }
    clientCode += `    let url = \`\${this.baseURL}${urlTemplate}\`;\n`;

    if (queryParams.length > 0) {
      clientCode += `    const searchParams = new URLSearchParams();\n`;
      for (const p of queryParams) {
        clientCode += `    if (queryParams.${p.name} !== undefined) searchParams.append('${p.name}', String(queryParams.${p.name}));\n`;
      }
      clientCode += `    url += '?' + searchParams.toString();\n`;
    }

    // Headers
    clientCode += `    const headers: Record<string, string> = { ...options?.headers };\n`;
    if (requestType !== 'void') {
      clientCode += `    headers['Content-Type'] = 'application/json';\n`;
    }
    clientCode += `    if (options?.auth) headers['Authorization'] = options.auth;\n`;

    // Fetch call
    clientCode += `    return fetch(url, {\n`;
    clientCode += `      method: '${method}',\n`;
    clientCode += `      headers,\n`;
    if (requestType !== 'void') {
      clientCode += `      body: JSON.stringify(body),\n`;
    }
    clientCode += `    }).then(async (res) => {\n`;
    clientCode += `      if (!res.ok) throw new Error(\`HTTP \${res.status}: \${res.statusText}\`);\n`;
    if (responseType !== 'Response') {
      clientCode += `      const data = await res.json();\n`;
      clientCode += `      return ${funcName}ResponseSchema.parse(data);\n`;
    } else {
      clientCode += `      return res;\n`;
    }
    clientCode += `    });\n`;
    clientCode += `  }\n\n`;
  }

  clientCode =
    types +
    `\nexport class OpenSpeedClient {\n  constructor(private baseURL: string = '') {}\n\n` +
    clientCode +
    `}\n`;
  return clientCode;
}

function generatePHPClient(routes: RouteInfo[]): string {
  let clientCode = `<?php
// Generated OpenSpeed PHP Client
// Provides type-safe API calls

class OpenSpeedClient {
    private $baseURL;

    public function __construct($baseURL = '') {
        $this->baseURL = $baseURL;
    }

`;

  for (const route of routes) {
    const path = route.path;
    const method = route.method.toUpperCase();
    const funcName = path.replace(/:/g, '$').replace(/\//g, '_').replace(/^_/, '') || 'root';

    // Collect parameters
    const pathParams: Array<{ name: string }> = [];
    const queryParams: Array<{ name: string }> = [];

    if (route.parameters) {
      for (const param of route.parameters) {
        if (param.in === 'path') pathParams.push({ name: param.name });
        else if (param.in === 'query') queryParams.push({ name: param.name });
      }
    }

    // Add path params from route path
    const pathParamNames = (route.path.match(/:(\w+)/g) || []).map((p) => p.slice(1));
    for (const name of pathParamNames) {
      if (!pathParams.find((p) => p.name === name)) {
        pathParams.push({ name });
      }
    }

    // Build parameter list
    const paramList: string[] = [];
    if (pathParams.length > 0) paramList.push(`$pathParams`);
    if (queryParams.length > 0) paramList.push(`$queryParams = []`);
    if (route.requestBody && ['POST', 'PUT', 'PATCH'].includes(method))
      paramList.push(`$body = null`);
    paramList.push(`$options = []`);
    const params = paramList.join(', ');

    clientCode += `    public function ${funcName}(${params}) {\n`;

    // URL construction
    let urlTemplate = route.path;
    for (const p of pathParams) {
      urlTemplate = urlTemplate.replace(`:${p.name}`, '{' + p.name + '}');
    }
    clientCode += `        $url = $this->baseURL . "${urlTemplate}";\n`;

    if (pathParams.length > 0) {
      for (const p of pathParams) {
        clientCode += `        $url = str_replace('{${p.name}}', $pathParams['${p.name}'], $url);\n`;
      }
    }

    if (queryParams.length > 0) {
      clientCode += `        $query = http_build_query($queryParams);\n`;
      clientCode += `        if ($query) $url .= '?' . $query;\n`;
    }

    // Headers
    clientCode += `        $headers = $options['headers'] ?? [];\n`;
    if (route.requestBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
      clientCode += `        $headers['Content-Type'] = 'application/json';\n`;
    }
    clientCode += `        if (isset($options['auth'])) $headers['Authorization'] = $options['auth'];\n`;

    // cURL call
    clientCode += `        $ch = curl_init($url);\n`;
    clientCode += `        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n`;
    clientCode += `        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${method}');\n`;
    clientCode += `        if (!empty($headers)) {\n`;
    clientCode += `            $headerArray = [];\n`;
    clientCode += `            foreach ($headers as $key => $value) {\n`;
    clientCode += `                $headerArray[] = "$key: $value";\n`;
    clientCode += `            }\n`;
    clientCode += `            curl_setopt($ch, CURLOPT_HTTPHEADER, $headerArray);\n`;
    clientCode += `        }\n`;
    if (route.requestBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
      clientCode += `        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));\n`;
    }
    clientCode += `        $response = curl_exec($ch);\n`;
    clientCode += `        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);\n`;
    clientCode += `        curl_close($ch);\n`;
    clientCode += `        if ($httpCode >= 400) {\n`;
    clientCode += `            throw new Exception("HTTP $httpCode: " . $response);\n`;
    clientCode += `        }\n`;
    clientCode += `        return json_decode($response, true);\n`;
    clientCode += `    }\n\n`;
  }

  clientCode += `}
?>`;
  return clientCode;
}

function generateCPPClient(routes: RouteInfo[]): string {
  let clientCode = `// Generated OpenSpeed C++ Client
// Requires libcurl and nlohmann/json
#include <iostream>
#include <string>
#include <curl/curl.h>
#include <nlohmann/json.hpp>

class OpenSpeedClient {
private:
    std::string baseURL;
    static size_t WriteCallback(void* contents, size_t size, size_t nmemb, void* userp) {
        ((std::string*)userp)->append((char*)contents, size * nmemb);
        return size * nmemb;
    }

public:
    OpenSpeedClient(std::string baseURL = "") : baseURL(baseURL) {}

`;

  for (const route of routes) {
    const path = route.path;
    const method = route.method.toUpperCase();
    const funcName = path.replace(/:/g, '$').replace(/\//g, '_').replace(/^_/, '') || 'root';

    // Collect parameters
    const pathParams: Array<{ name: string }> = [];
    const queryParams: Array<{ name: string }> = [];

    if (route.parameters) {
      for (const param of route.parameters) {
        if (param.in === 'path') pathParams.push({ name: param.name });
        else if (param.in === 'query') queryParams.push({ name: param.name });
      }
    }

    // Add path params from route path
    const pathParamNames = (route.path.match(/:(\w+)/g) || []).map((p) => p.slice(1));
    for (const name of pathParamNames) {
      if (!pathParams.find((p) => p.name === name)) {
        pathParams.push({ name });
      }
    }

    // Build parameter list
    const paramList: string[] = [];
    if (pathParams.length > 0) paramList.push(`std::map<std::string, std::string> pathParams`);
    if (queryParams.length > 0)
      paramList.push(`std::map<std::string, std::string> queryParams = {}`);
    if (route.requestBody && ['POST', 'PUT', 'PATCH'].includes(method))
      paramList.push(`nlohmann::json body = nullptr`);
    paramList.push(`std::map<std::string, std::string> options = {}`);
    const params = paramList.join(', ');

    clientCode += `    nlohmann::json ${funcName}(${params}) {\n`;

    // URL construction
    let urlTemplate = route.path;
    for (const p of pathParams) {
      urlTemplate = urlTemplate.replace(`:${p.name}`, `" + pathParams["${p.name}"] + "`);
    }
    clientCode += `        std::string url = baseURL + "${urlTemplate}";\n`;

    if (queryParams.length > 0) {
      clientCode += `        std::string query;\n`;
      clientCode += `        for (auto& p : queryParams) {\n`;
      clientCode += `            if (!query.empty()) query += "&";\n`;
      clientCode += `            query += p.first + "=" + p.second;\n`;
      clientCode += `        }\n`;
      clientCode += `        if (!query.empty()) url += "?" + query;\n`;
    }

    // cURL call
    clientCode += `        CURL* curl = curl_easy_init();\n`;
    clientCode += `        std::string response_string;\n`;
    clientCode += `        curl_easy_setopt(curl, CURLOPT_URL, url.c_str());\n`;
    clientCode += `        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);\n`;
    clientCode += `        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response_string);\n`;

    if (method !== 'GET') {
      clientCode += `        curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "${method}");\n`;
    }

    // Headers
    clientCode += `        struct curl_slist* headers = NULL;\n`;
    clientCode += `        headers = curl_slist_append(headers, "Content-Type: application/json");\n`;
    clientCode += `        for (auto& h : options) {\n`;
    clientCode += `            headers = curl_slist_append(headers, (h.first + ": " + h.second).c_str());\n`;
    clientCode += `        }\n`;
    clientCode += `        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);\n`;

    if (route.requestBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
      clientCode += `        std::string body_str = body.dump();\n`;
      clientCode += `        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body_str.c_str());\n`;
    }

    clientCode += `        CURLcode res = curl_easy_perform(curl);\n`;
    clientCode += `        long http_code = 0;\n`;
    clientCode += `        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_code);\n`;
    clientCode += `        curl_slist_free_all(headers);\n`;
    clientCode += `        curl_easy_cleanup(curl);\n`;
    clientCode += `        if (http_code >= 400) {\n`;
    clientCode += `            throw std::runtime_error("HTTP " + std::to_string(http_code) + ": " + response_string);\n`;
    clientCode += `        }\n`;
    clientCode += `        return nlohmann::json::parse(response_string);\n`;
    clientCode += `    }\n\n`;
  }

  clientCode += `};
`;
  return clientCode;
}

function generateRustClient(routes: RouteInfo[]): string {
  let clientCode = `// Generated OpenSpeed Rust Client
// Requires reqwest and serde_json
use reqwest::Client;
use serde_json::{json, Value};
use std::collections::HashMap;

pub struct OpenSpeedClient {
    base_url: String,
    client: Client,
}

impl OpenSpeedClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            client: Client::new(),
        }
    }

`;

  for (const route of routes) {
    const path = route.path;
    const method = route.method.toUpperCase();
    const funcName = path.replace(/:/g, '_').replace(/\//g, '_').replace(/^_/, '') || 'root';

    // Collect parameters
    const pathParams: Array<{ name: string }> = [];
    const queryParams: Array<{ name: string }> = [];

    if (route.parameters) {
      for (const param of route.parameters) {
        if (param.in === 'path') pathParams.push({ name: param.name });
        else if (param.in === 'query') queryParams.push({ name: param.name });
      }
    }

    // Add path params from route path
    const pathParamNames = (route.path.match(/:(\w+)/g) || []).map((p) => p.slice(1));
    for (const name of pathParamNames) {
      if (!pathParams.find((p) => p.name === name)) {
        pathParams.push({ name });
      }
    }

    // Build parameter list
    const paramList: string[] = [];
    if (pathParams.length > 0) paramList.push(`&self, path_params: HashMap<&str, &str>`);
    if (queryParams.length > 0) paramList.push(`query_params: Option<HashMap<&str, &str>>`);
    if (route.requestBody && ['POST', 'PUT', 'PATCH'].includes(method))
      paramList.push(`body: Option<Value>`);
    paramList.push(`options: Option<HashMap<&str, &str>>`);
    const params = paramList.join(', ');

    clientCode += `    pub async fn ${funcName}(${params}) -> Result<Value, Box<dyn std::error::Error>> {\n`;

    // URL construction
    let urlTemplate = route.path;
    for (const p of pathParams) {
      urlTemplate = urlTemplate.replace(`:${p.name}`, `" + path_params["${p.name}"] + "`);
    }
    clientCode += `        let mut url = format!("{}{}", self.base_url, "${urlTemplate}");\n`;

    if (queryParams.length > 0) {
      clientCode += `        if let Some(qp) = query_params {\n`;
      clientCode += `            let query: Vec<String> = qp.iter().map(|(k, v)| format!("{}={}", k, v)).collect();\n`;
      clientCode += `            url.push_str(&format!("?{}", query.join("&")));\n`;
      clientCode += `        }\n`;
    }

    // Request building
    clientCode += `        let mut request = self.client.${method.toLowerCase()}(url);\n`;

    if (route.requestBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
      clientCode += `        if let Some(b) = body {\n`;
      clientCode += `            request = request.json(&b);\n`;
      clientCode += `        }\n`;
    }

    if (pathParams.length > 0) {
      clientCode += `        for (key, value) in path_params {\n`;
      clientCode += `            url = url.replace(&format!("{{{}}}", key), value);\n`;
      clientCode += `        }\n`;
    }

    clientCode += `        if let Some(opts) = options {\n`;
    clientCode += `            for (key, value) in opts {\n`;
    clientCode += `                request = request.header(key, value);\n`;
    clientCode += `            }\n`;
    clientCode += `        }\n`;

    clientCode += `        let response = request.send().await?;\n`;
    clientCode += `        if !response.status().is_success() {\n`;
    clientCode += `            return Err(format!("HTTP {}: {}", response.status(), response.text().await?).into());\n`;
    clientCode += `        }\n`;
    clientCode += `        let json: Value = response.json().await?;\n`;
    clientCode += `        Ok(json)\n`;
    clientCode += `    }\n\n`;
  }

  clientCode += `}
`;
  return clientCode;
}

function generateGoClient(routes: RouteInfo[]): string {
  let clientCode = `// Generated OpenSpeed Go Client
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "strings"
)

type OpenSpeedClient struct {
    BaseURL string
    Client  *http.Client
}

func NewOpenSpeedClient(baseURL string) *OpenSpeedClient {
    return &OpenSpeedClient{
        BaseURL: baseURL,
        Client:  &http.Client{},
    }
}

`;

  for (const route of routes) {
    const path = route.path;
    const method = route.method.toUpperCase();
    const funcName = path.replace(/:/g, '_').replace(/\//g, '_').replace(/^_/, '') || 'root';

    // Collect parameters
    const pathParams: Array<{ name: string }> = [];
    const queryParams: Array<{ name: string }> = [];

    if (route.parameters) {
      for (const param of route.parameters) {
        if (param.in === 'path') pathParams.push({ name: param.name });
        else if (param.in === 'query') queryParams.push({ name: param.name });
      }
    }

    // Add path params from route path
    const pathParamNames = (route.path.match(/:(\w+)/g) || []).map((p) => p.slice(1));
    for (const name of pathParamNames) {
      if (!pathParams.find((p) => p.name === name)) {
        pathParams.push({ name });
      }
    }

    // Build parameter list
    const paramList: string[] = [];
    if (pathParams.length > 0) paramList.push(`pathParams map[string]string`);
    if (queryParams.length > 0) paramList.push(`queryParams map[string]string`);
    if (route.requestBody && ['POST', 'PUT', 'PATCH'].includes(method))
      paramList.push(`body interface{}`);
    paramList.push(`options map[string]string`);
    const params = paramList.join(', ');

    clientCode += `func (c *OpenSpeedClient) ${funcName}(${params}) (map[string]interface{}, error) {\n`;

    // URL construction
    let urlTemplate = route.path;
    for (const p of pathParams) {
      urlTemplate = urlTemplate.replace(`:${p.name}`, `" + pathParams["${p.name}"] + "`);
    }
    clientCode += `    url := c.BaseURL + "${urlTemplate}"\n`;

    if (queryParams.length > 0) {
      clientCode += `    queryParts := make([]string, 0, len(queryParams))\n`;
      clientCode += `    for k, v := range queryParams {\n`;
      clientCode += `        queryParts = append(queryParts, fmt.Sprintf("%s=%s", k, v))\n`;
      clientCode += `    }\n`;
      clientCode += `    if len(queryParts) > 0 {\n`;
      clientCode += `        url += "?" + strings.Join(queryParts, "&")\n`;
      clientCode += `    }\n`;
    }

    if (pathParams.length > 0) {
      clientCode += `    for k, v := range pathParams {\n`;
      clientCode += `        url = strings.Replace(url, "{"+k+"}", v, -1)\n`;
      clientCode += `    }\n`;
    }

    // Request body
    if (route.requestBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
      clientCode += `    var bodyBytes []byte\n`;
      clientCode += `    if body != nil {\n`;
      clientCode += `        bodyBytes, _ = json.Marshal(body)\n`;
      clientCode += `    }\n`;
      clientCode += `    req, err := http.NewRequest("${method}", url, bytes.NewBuffer(bodyBytes))\n`;
    } else {
      clientCode += `    req, err := http.NewRequest("${method}", url, nil)\n`;
    }

    clientCode += `    if err != nil {\n`;
    clientCode += `        return nil, err\n`;
    clientCode += `    }\n`;

    if (route.requestBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
      clientCode += `    req.Header.Set("Content-Type", "application/json")\n`;
    }

    clientCode += `    for k, v := range options {\n`;
    clientCode += `        req.Header.Set(k, v)\n`;
    clientCode += `    }\n`;

    clientCode += `    resp, err := c.Client.Do(req)\n`;
    clientCode += `    if err != nil {\n`;
    clientCode += `        return nil, err\n`;
    clientCode += `    }\n`;
    clientCode += `    defer resp.Body.Close()\n`;

    clientCode += `    if resp.StatusCode >= 400 {\n`;
    clientCode += `        bodyBytes, _ := io.ReadAll(resp.Body)\n`;
    clientCode += `        return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(bodyBytes))\n`;
    clientCode += `    }\n`;

    clientCode += `    var result map[string]interface{}\n`;
    clientCode += `    json.NewDecoder(resp.Body).Decode(&result)\n`;
    clientCode += `    return result, nil\n`;
    clientCode += `}\n\n`;
  }

  return clientCode;
}

interface RouteInfo {
  method: string;
  path: string;
  description?: string;
  requestBody?: ZodSchema;
  responses?: Record<string, { schema?: ZodSchema; description?: string }>;
  parameters?: Array<{
    name: string;
    in: 'path' | 'query' | 'header';
    required?: boolean;
    schema: ZodSchema;
    description?: string;
  }>;
}

function registerLanguage(language: string, generator: LanguageGenerator): void {
  languageRegistry.set(language.toLowerCase(), generator);
}

function getLanguageGenerator(language: string): LanguageGenerator | undefined {
  return languageRegistry.get(language.toLowerCase());
}

export function openapi(options: { title?: string; version?: string } = {}) {
  const routes: RouteInfo[] = [];
  const { title = 'OpenSpeed API', version = '1.0.0' } = options;

  const api = {
    collect: (method: string, path: string, options: string | Partial<RouteInfo> = {}) => {
      const routeInfo: Partial<RouteInfo> =
        typeof options === 'string' ? { description: options } : options;

      routes.push({
        method: method.toLowerCase(),
        path,
        ...routeInfo,
      });
    },
    generate: () => {
      const paths: Record<string, any> = {};

      for (const route of routes) {
        const path = route.path.replace(/:(\w+)/g, '{$1}');
        if (!paths[path]) paths[path] = {};

        const operation: any = {
          description: route.description || '',
          responses: {},
        };

        // Add parameters
        if (route.parameters) {
          operation.parameters = route.parameters.map((param) => ({
            name: param.name,
            in: param.in,
            required: param.required,
            description: param.description,
            schema: zodToOpenAPISchema(param.schema),
          }));
        }

        // Add path parameters from route
        const pathParams = route.path.match(/:(\w+)/g);
        if (pathParams) {
          operation.parameters = operation.parameters || [];
          for (const param of pathParams) {
            const name = param.slice(1);
            if (!operation.parameters.find((p: any) => p.name === name && p.in === 'path')) {
              operation.parameters.push({
                name,
                in: 'path',
                required: true,
                schema: { type: 'string' },
              });
            }
          }
        }

        // Add request body
        if (route.requestBody && ['post', 'put', 'patch'].includes(route.method)) {
          operation.requestBody = {
            required: true,
            content: {
              'application/json': {
                schema: zodToOpenAPISchema(route.requestBody),
              },
            },
          };
        }

        // Add responses
        if (route.responses) {
          for (const [status, response] of Object.entries(route.responses)) {
            operation.responses[status] = {
              description: response.description || 'Success',
              content: response.schema
                ? {
                    'application/json': {
                      schema: zodToOpenAPISchema(response.schema),
                    },
                  }
                : undefined,
            };
          }
        } else {
          operation.responses['200'] = { description: 'Success' };
        }

        paths[path][route.method] = operation;
      }

      return {
        openapi: '3.0.0',
        info: { title, version },
        paths,
      };
    },

    generateClient: (language: string = 'typescript') => {
      // First try direct language name
      let generator = getLanguageGenerator(language);
      if (!generator) {
        // Try extension mapping
        const mappedLanguage = extensionToLanguage[language.toLowerCase()];
        if (mappedLanguage) {
          generator = getLanguageGenerator(mappedLanguage);
        }
      }
      if (generator) {
        return generator(routes);
      }
      throw new Error(
        `Unsupported language: ${language}. Use registerLanguage() to add support or check supported extensions.`
      );
    },

    registerLanguage,

    middleware: async (ctx: Context, next: () => Promise<any>) => {
      // NOTE: localhost URL is only used as base for pathname parsing, not for actual connection
      const pathname = new URL(ctx.req.url, 'http://localhost').pathname;
      if (pathname === '/openapi.json') {
        ctx.res.status = 200;
        ctx.res.headers = { ...ctx.res.headers, 'content-type': 'application/json' };
        ctx.res.body = JSON.stringify(api.generate(), null, 2);
        return;
      }

      // Handle dynamic client generation: /client.{ext}
      const clientMatch = pathname.match(/^\/client\.(.+)$/);
      if (clientMatch) {
        const ext = clientMatch[1];
        try {
          ctx.res.status = 200;
          ctx.res.headers = { ...ctx.res.headers, 'content-type': 'text/plain' };
          ctx.res.body = api.generateClient(ext);
          return;
        } catch (error) {
          ctx.res.status = 400;
          ctx.res.headers = { ...ctx.res.headers, 'content-type': 'application/json' };
          ctx.res.body = JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            supportedExtensions: Object.keys(extensionToLanguage),
          });
          return;
        }
      }

      await next();
    },
  };

  return api;
}

// Helper function to convert Zod schema to OpenAPI schema (basic implementation)
function zodToOpenAPISchema(schema: ZodSchema): any {
  // This is a basic implementation. For production, consider using a library like zod-to-openapi
  try {
    const shape = (schema as any)._def.shape?.();
    if (shape) {
      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const [key, fieldSchema] of Object.entries(shape)) {
        properties[key] = zodToOpenAPISchema(fieldSchema as ZodSchema);
        if (!(fieldSchema as any)._def.optional) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }

    const typeName = (schema as any)._def.typeName;
    switch (typeName) {
      case 'ZodString':
        return { type: 'string' };
      case 'ZodNumber':
        return { type: 'number' };
      case 'ZodBoolean':
        return { type: 'boolean' };
      case 'ZodArray':
        return {
          type: 'array',
          items: zodToOpenAPISchema((schema as any)._def.element),
        };
      default:
        return { type: 'string' }; // fallback
    }
  } catch {
    return { type: 'string' };
  }
}

// Helper function to convert Zod schema to Zod code for runtime validation
function zodToZodCode(schema: ZodSchema): string {
  try {
    const typeName = (schema as any)._def.typeName;
    switch (typeName) {
      case 'ZodString':
        return 'z.string()';
      case 'ZodNumber':
        return 'z.number()';
      case 'ZodBoolean':
        return 'z.boolean()';
      case 'ZodArray':
        return `z.array(${zodToZodCode((schema as any)._def.element)})`;
      case 'ZodObject': {
        const shape = (schema as any)._def.shape();
        const props = Object.entries(shape)
          .map(([k, v]) => `${k}: ${zodToZodCode(v as ZodSchema)}`)
          .join(', ');
        return `z.object({${props}})`;
      }
      default:
        return 'z.any()';
    }
  } catch {
    return 'z.any()';
  }
}
