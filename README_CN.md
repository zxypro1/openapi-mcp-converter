# OpenAPI to MCP Server Converter

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.x-brightgreen)](https://nodejs.org/)
[![TypeScript Version](https://img.shields.io/badge/typescript-5.x-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

将 OpenAPI 规范自动转换为 Model Context Protocol（MCP）服务实例

## 功能特性

- 🚀 **自动化转换**：自动解析 OpenAPI 3.0 规范
- 🛠 **类型安全**：基于 TypeScript 的强类型校验
- 🔄 **请求代理**：自动处理工具调用参数映射

## 快速开始

### 前置条件

- Node.js 18+
- TypeScript 5.x

### 基础用法

安装包：

```bash
npm install openapi-mcp-converter
```

跑一个本地 STDIO MCP 服务：

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

### 运行示例

```bash
npm test  # 执行示例测试用例
```

## 开发指南

### 项目结构

```
/openapi-to-mcp
├── dist/            # 编译输出
├── src/             # 源代码
│   ├── example/     # 示例配置
│   └── index.ts     # 核心实现
├── package.json
└── tsconfig.json
```

### 构建命令

```bash
npm run build    # 生产环境构建
npm run watch    # 开发模式监听
```
