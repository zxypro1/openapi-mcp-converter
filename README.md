[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/zxypro1-openapi-to-mcp-converter-badge.png)](https://mseep.ai/app/zxypro1-openapi-to-mcp-converter)

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

Create a server instance:

```typescript
import fs from 'fs';
import { OpenApiMCPSeverConverter } from '../index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const openApiDoc = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'openapi.json'), 'utf8'));

const converter = new OpenApiMCPSeverConverter(openApiDoc, { timeout: 100000, security: { apiKey: 'my-api-key' } });
const server = converter.getServer();
```

Run a local stdio MCP server:

```typescript
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

Run a local SSE Server:

```typescript
const app = express();
let transport = null;

app.get("/sse", async (req, res) => {
  console.log("SSE connection opened");
  console.log("Request Headers:", req?.headers);
  console.log("Request Query:", req?.query);
  server.onclose = async () => {
    await server.close();
  };
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
  return;
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
      throw new Error("sessionId query parameter is required");
  }
  await transport.handlePostMessage(req, res);
  return;
});

app.listen(8080, () => {
  console.log('MCP Server running on port 8080');
});
```

Run a local Streamable HTTP Server:

```typescript
const app = express();
app.use(express.json());

const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  if (sessionId && transports[sessionId]) {
    transport = transports[sessionId];
  } else if (!sessionId && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        transports[sessionId] = transport;
      }
    });
    transport.onclose = () => {
      if (transport.sessionId) {
        delete transports[transport.sessionId];
      }
    };
    await server.connect(transport);
  } else {
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No valid session ID provided',
      },
      id: null,
    });
    return;
  }

  await transport.handleRequest(req, res, req.body);
});

const handleSessionRequest = async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }
  
  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
};

app.get('/mcp', handleSessionRequest);

app.delete('/mcp', handleSessionRequest);

app.listen(3000);
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
