import fs from 'fs';
import { OpenApiMCPSeverConverter } from '../index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const openApiDoc = JSON.parse(fs.readFileSync('./openapi.json', 'utf8'));

const converter = new OpenApiMCPSeverConverter(openApiDoc);
const server = converter.getServer();
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("GitHub MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});