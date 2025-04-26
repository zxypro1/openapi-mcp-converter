import { OpenAPIV3 } from "openapi-types";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

type JSONSchema = OpenAPIV3.SchemaObject;
type HTTPMethod = OpenAPIV3.HttpMethods;

interface ToolCall {
  path: string;
  method: HTTPMethod;
  url: string;
  operationId: string;
  parametersSchema: JSONSchema;
  description: string;
}

interface Options {
  timeout?: number;
}

export class OpenApiMCPSeverConverter {
  private tools: ToolCall[];
  private mcpTools: any[];
  private server: Server;

  constructor(private openApiDoc: OpenAPIV3.Document, private options?: Options) {
    this.tools = this.analyzeOpenApiSchema();
    this.mcpTools = this.createMcpTools();
    this.server = this.initializeServer();
  }

  public getServer(): Server {
    return this.server;
  }

  public getMcpTools(): any[] {
    return this.mcpTools;
  }

  public getTools(): ToolCall[] {
    return this.tools;
  }

  private initializeServer(): Server {
    const server = new Server(
      { name: "github-mcp-server", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.mcpTools
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const tool = this.tools.find(t => t.operationId === request.params.name);
        if (!tool) throw new Error("Tool not found");
        if (!request.params.arguments) throw new Error("Arguments are required");

        const result = await axios.request({
          method: tool.method,
          url: tool.url,
          data: request.params.arguments?.body || undefined,
          params: request.params.arguments?.query || undefined,
          headers: request.params.arguments?.header || undefined,
          // default timeout is 60 seconds
          timeout: this.options?.timeout || 60000,
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result.data) }],
          isError: false
        };
      } catch (error) {
        throw error;
      }
    });

    return server;
  }

  private createMcpTools(): any[] {
    return this.tools.map(tool => ({
      name: tool.operationId,
      description: tool.description,
      inputSchema: tool.parametersSchema
    }));
  }

  private analyzeOpenApiSchema(): ToolCall[] {
    const results: ToolCall[] = [];
    const servers = this.openApiDoc.servers || [{ url: "/" }];

    for (const [path, pathItem] of Object.entries(this.openApiDoc.paths)) {
      for (const method of Object.values(OpenAPIV3.HttpMethods)) {
        const operation = pathItem?.[method];
        if (!operation) continue;

        const parameters = this.mergeParameters(
          pathItem.parameters,
          operation.parameters
        );

        const parametersSchema = this.buildParameterSchema(
          parameters,
          operation.requestBody
        );

        const baseUrl = servers[0].url.endsWith("/") 
          ? servers[0].url.slice(0, -1)
          : servers[0].url;
        const fullUrl = `${baseUrl}${path}`;

        results.push({
          path,
          method,
          url: fullUrl,
          operationId: operation.operationId || `${method}:${path}`,
          parametersSchema,
          description: operation.description || operation.summary || "",
        });
      }
    }
    return results;
  }

  private mergeParameters(
    pathParams?: Array<OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject>,
    operationParams?: Array<OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject>
  ): OpenAPIV3.ParameterObject[] {
    const paramMap = new Map<string, OpenAPIV3.ParameterObject>();

    const addParams = (
      params: Array<OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject> = []
    ) => {
      params.forEach((p) => {
        const param = p as OpenAPIV3.ParameterObject;
        if (param.in && param.name) {
          paramMap.set(`${param.in}:${param.name}`, param);
        }
      });
    };

    addParams(pathParams);
    addParams(operationParams);
    return Array.from(paramMap.values());
  }

  private buildParameterSchema(
    parameters: OpenAPIV3.ParameterObject[],
    requestBody?: OpenAPIV3.ReferenceObject | OpenAPIV3.RequestBodyObject
  ): JSONSchema {
    const schema: JSONSchema = {
      type: "object",
      properties: {
        path: { type: "object", properties: {}, required: [] },
        query: { type: "object", properties: {}, required: [] },
        header: { type: "object", properties: {}, required: [] },
        body: { type: "object", properties: {}, required: [] },
      },
      required: [],
    };

    parameters.forEach((param) => {
      const location = param.in === "cookie" ? "header" : param.in;
      if (!["path", "query", "header"].includes(location)) return;

      const target = schema.properties![location] as JSONSchema;
      const paramSchema = param.schema as JSONSchema;

      target.properties![param.name] = paramSchema;
      if (param.required) {
        (target.required as string[]).push(param.name);
      }
    });

    if (requestBody && "content" in requestBody) {
      const content = requestBody.content["application/json"];
      if (content?.schema) {
        schema.properties!.body = content.schema as JSONSchema;
        if (requestBody.required) {
          schema.required!.push("body");
        }
      }
    }

    Object.keys(schema.properties!).forEach((key) => {
      const prop = schema.properties![key] as JSONSchema;
      if (Object.keys(prop.properties || {}).length === 0) {
        delete schema.properties![key];
      }
    });

    return schema;
  }
}
