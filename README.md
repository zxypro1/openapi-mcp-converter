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
import { OpenApiMCPSeverConverter } from "openapi-mcp-converter";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "fs";

const openApiDoc = JSON.parse(fs.readFileSync("./openapi.json"));
const converter = new OpenApiMCPSeverConverter(openApiDoc);
const server = converter.getServer();

// Start MCP service
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
npm test  # Execute sample test cases
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
