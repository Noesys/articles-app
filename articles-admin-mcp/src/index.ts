#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createAuthProvider } from "./auth.js";
import { ArticleApi } from "./api.js";
import { registerTools } from "./tools.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const auth = createAuthProvider(config);
  const api = new ArticleApi(config, auth);

  const server = new McpServer({ name: "articles-admin", version: "0.1.0" });
  registerTools(server, api, config);

  // stdout carries the protocol, so log to stderr only.
  console.error(`[articles-admin-mcp] API=${config.apiBaseUrl} auth=${auth.name}`);
  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error("[articles-admin-mcp] fatal:", err);
  process.exit(1);
});
