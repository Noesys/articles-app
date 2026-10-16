import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler, getMcpAuthContext } from "agents/mcp/server";
import type { Bindings, ContiqMcpProps } from "../types/shared-types";
import { registerContiqTools } from "./tools";

const MCP_HOSTS = [
  "contiq.noesyssoftware.com",
  "article-api.infoveave.workers.dev",
  "localhost",
  "127.0.0.1",
];

function buildServer(env: Bindings): McpServer {
  const auth = getMcpAuthContext();
  const props = auth?.props as ContiqMcpProps | undefined;
  const role = props?.authRole === "admin" ? "admin" : "user";

  const server = new McpServer({
    name: "contiq-mcp",
    version: "1.0.0",
  });

  registerContiqTools(server, env, role);
  return server;
}

/**
 * MCP apiHandler for OAuthProvider.
 * Builds a fresh server per request so tools/list matches the token role.
 */
export const contiqMcpApiHandler = {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    const handler = createMcpHandler(() => buildServer(env), {
      route: "/mcp",
      allowedHostnames: MCP_HOSTS,
    });
    return handler(request, env, ctx);
  },
};
