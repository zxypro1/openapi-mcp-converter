# OpenAPI to MCP Server Converter

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.x-brightgreen)](https://nodejs.org/)
[![TypeScript Version](https://img.shields.io/badge/typescript-5.x-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A tool for automatically converting OpenAPI specifications into Model Context Protocol (MCP) server instance

## Features

- 🚀 **Automated Conversion**: Auto-parses OpenAPI 3.0 specifications
- 🛠 **Type Safety**: TypeScript-based strong type validation
- 🔄 **Request Proxy**: Automatically handles tool call parameter mapping

## Quick Start

### Prerequisites

- Node.js 18+
- TypeScript 5.x

### Basic Usage

Install the package:

```bash
npm install openapi-mcp-converter
```

Run a local stdio MCP server:

```typescript
import fs from 'fs';
import { OpenApiMCPSeverConverter } from '../index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const openApiDoc = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'openapi.json'), 'utf8'));

const converter = new OpenApiMCPSeverConverter(openApiDoc, { timeout: 100000 });
const server = converter.getServer();
console.log(JSON.stringify(converter.getMcpTools(), null, 2));
console.log(JSON.stringify(converter.getTools(), null, 2));
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("GitHub MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
```

### Run Examples

```bash
npm run test  # Execute sample test cases
```

## Development Guide

### Project Structure

```
/openapi-to-mcp
├── dist/            # Compiled output
├── src/             # Source code
│   ├── example/     # Example configurations
│   └── index.ts     # Core implementation
├── package.json
└── tsconfig.json
```

### Build Commands

```bash
npm run build    # Production build
npm run watch    # Development mode watch
```
