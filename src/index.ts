import { OpenAPIV3 } from "openapi-types";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { Buffer } from "buffer";

type JSONSchema = OpenAPIV3.SchemaObject;
type HTTPMethod = OpenAPIV3.HttpMethods;

interface ToolCall {
  path: string;
  method: HTTPMethod;
  url: string;
  operationId: string;
  parametersSchema: JSONSchema;
  description: string;
  securitySchemes?: OpenAPIV3.SecuritySchemeObject[];
}

interface Options {
  timeout?: number;
  security?: Record<string, string>;
}

export class OpenApiMCPSeverConverter {
  private tools: ToolCall[];
  private mcpTools: any[];
  private server: Server;

  constructor(
    private openApiDoc: OpenAPIV3.Document,
    private options?: Options
  ) {
    this.options = this.injectGlobalSecurity(options);
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
      tools: this.mcpTools,
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const tool = this.tools.find(
          (t) => t.operationId === request.params.name
        );
        if (!tool) throw new Error("Tool not found");

        const [securityHeaders, securityQuery] =
          this.resolveSecurityParameters(tool);
        const authHeaders = this.handleAuthSchemes(tool);

        const result = await axios.request({
          method: tool.method,
          url: this.buildSecureUrl(tool.url, securityQuery),
          data: request.params.arguments?.body,
          params: { 
            ...(securityQuery || {}),
            ...(request.params.arguments?.query || {}) 
          },
          headers: {
            ...securityHeaders,
            ...authHeaders,
            ...(request.params.arguments?.header || {}),
          },
          timeout: this.options?.timeout || 60000,
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result.data) }],
          isError: false,
        };
      } catch (error) {
        throw error;
      }
    });

    return server;
  }

  private createMcpTools(): any[] {
    return this.tools.map((tool) => ({
      name: tool.operationId,
      description: tool.description,
      inputSchema: tool.parametersSchema,
    }));
  }

  private analyzeOpenApiSchema(): ToolCall[] {
    const results: ToolCall[] = [];
    const servers = this.openApiDoc.servers || [{ url: "/" }];

    for (const [path, pathItem] of Object.entries(this.openApiDoc.paths)) {
      for (const method of Object.values(OpenAPIV3.HttpMethods)) {
        const operation = pathItem?.[method];
        if (!operation) continue;

        const securitySchemes = [
          ...(this.openApiDoc.security || []),
          ...(operation.security || []),
        ]
          .flatMap((sec) =>
            Object.keys(sec).map(
              (name) => this.openApiDoc.components?.securitySchemes?.[name]
            )
          )
          .filter(Boolean) as OpenAPIV3.SecuritySchemeObject[];

        const parameters = this.mergeParameters(
          pathItem.parameters,
          operation.parameters
        );
        const requestBody =
          operation.requestBody && "$ref" in operation.requestBody
            ? this.resolveRequestBodyRef(operation.requestBody.$ref)
            : (operation.requestBody as
                | OpenAPIV3.RequestBodyObject
                | undefined);

        const parametersSchema = this.buildParameterSchema(
          parameters,
          requestBody
        );
        const baseUrl = servers[0].url.replace(/\/$/, "");
        const fullUrl = `${baseUrl}${path}`;

        results.push({
          path,
          method,
          url: fullUrl,
          operationId: operation.operationId || `${method}:${path}`,
          parametersSchema,
          description: operation.description || operation.summary || "",
          securitySchemes,
        });
      }
    }
    return results;
  }

  private resolveRequestBodyRef(
    ref: string
  ): OpenAPIV3.RequestBodyObject | undefined {
    const paths = ref.replace("#/", "").split("/");
    let current: any = this.openApiDoc;

    for (const path of paths) {
      current = current?.[path];
      if (!current) return undefined;
    }
    return current as OpenAPIV3.RequestBodyObject;
  }

  private resolveSecurityParameters(
    tool: ToolCall
  ): [Record<string, string>, Record<string, string>] {
    const headers: Record<string, string> = {};
    const query: Record<string, string> = {};

    tool.securitySchemes?.forEach((scheme) => {
      const value = this.options?.security?.[scheme.type === 'http' ? scheme.scheme : scheme.type];
      if (!value) return;

      switch (scheme.type) {
        case "apiKey":
          if (scheme.in === "header") headers[scheme.name] = value;
          if (scheme.in === "query") query[scheme.name] = value;
          break;
        case "http":
          if (scheme.scheme === "basic") {
            headers.Authorization = `Basic ${Buffer.from(value).toString("base64")}`;
          }
          break;
      }
    });

    return [headers, query];
  }

  private handleAuthSchemes(tool: ToolCall): Record<string, string> {
    const headers: Record<string, string> = {};
    tool.securitySchemes?.forEach((scheme) => {
      const value = this.options?.security?.[scheme.type === 'http' ? scheme.scheme : scheme.type];
      if (scheme.type === "oauth2" && value) {
        headers.Authorization = `Bearer ${value}`;
      }
    });
    return headers;
  }

  private buildSecureUrl(
    baseUrl: string,
    securityParams: Record<string, string>
  ): string {
    const url = new URL(baseUrl);
    Object.entries(securityParams).forEach(([key, val]) =>
      url.searchParams.append(key, val)
    );
    return url.toString();
  }

  private injectGlobalSecurity(options?: Options): Options {
    const globalSecurity = this.resolveGlobalSecurity();
    return {
      ...options,
      security: { ...globalSecurity, ...options?.security },
    };
  }

  private resolveGlobalSecurity(): Record<string, string> {
    const security: Record<string, string> = {};
    this.openApiDoc.security?.forEach((sec) =>
      Object.keys(sec).forEach((schemeName) => (security[schemeName] = ""))
    );
    return security;
  }

  private mergeParameters(
    pathParams?: Array<OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject>,
    operationParams?: Array<
      OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject
    >
  ): OpenAPIV3.ParameterObject[] {
    const paramMap = new Map<string, OpenAPIV3.ParameterObject>();
    const addParams = (params: any[] = []) =>
      params.forEach((p: OpenAPIV3.ParameterObject) =>
        paramMap.set(`${p.in}:${p.name}`, p)
      );
    addParams(pathParams);
    addParams(operationParams);
    return Array.from(paramMap.values());
  }

  private buildParameterSchema(
    parameters: OpenAPIV3.ParameterObject[],
    requestBody?: OpenAPIV3.RequestBodyObject
  ): JSONSchema {
    const schema: JSONSchema = {
      type: "object",
      properties: { path: {}, query: {}, header: {}, body: {} },
      required: [],
    };

    parameters.forEach((param) => {
      const location = param.in === "cookie" ? "header" : param.in;
      if (!["path", "query", "header"].includes(location)) return;
      const target = schema.properties![location] as JSONSchema;
      target.properties![param.name] = param.schema as JSONSchema;
      if (param.required) (target.required ??= []).push(param.name);
    });

    if (requestBody?.content?.["application/json"]?.schema) {
      schema.properties!.body = requestBody.content["application/json"]
        .schema as JSONSchema;
      if (requestBody.required) schema.required!.push("body");
    }

    Object.keys(schema.properties!).forEach((key) => {
      if (
        Object.keys((schema.properties![key] as JSONSchema).properties || {})
          .length === 0
      ) {
        delete schema.properties![key];
      }
    });

    return schema;
  }
}
