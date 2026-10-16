import { getMcpAuthContext } from "agents/mcp/server";
import type { ContiqMcpProps } from "../types/shared-types";

export type ContiqRole = "admin" | "user";

export function requireMcpProps(): ContiqMcpProps {
  const auth = getMcpAuthContext();
  const props = auth?.props as ContiqMcpProps | undefined;
  if (!props?.userId || !props.authRole) {
    throw new Error("Not authenticated. Complete Contiq MCP OAuth, then retry.");
  }
  if (props.authRole !== "admin" && props.authRole !== "user") {
    throw new Error("Invalid Contiq role on token.");
  }
  return props;
}

export function requireRole(props: ContiqMcpProps, allowed: ContiqRole[]): void {
  if (!allowed.includes(props.authRole)) {
    throw new Error(
      `This tool requires Contiq role ${allowed.join(" or ")}; your role is "${props.authRole}".`,
    );
  }
}
