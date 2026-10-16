/**
 * Contiq MCP OAuth authorize UI.
 * Identity comes from Cloudflare Access (edge JWT / ctx.access / local DEV_USER_MAIL).
 * Consent is per MCP client via workers-oauth-provider helpers.
 */
import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { resolveAccessUserFromRequest } from "../middleware/accessAuth";
import type { Bindings, ContiqMcpProps } from "../types/shared-types";

type AuthorizeEnv = {
  Bindings: Bindings & { OAUTH_PROVIDER: OAuthHelpers };
};

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

function consentHtml(opts: {
  clientName: string;
  clientDomain: string | null;
  redirectHost: string;
  redirectIsLoopback: boolean;
  scopes: string[];
  handle: string;
  userEmail: string;
  authRole: string;
}): string {
  const name = escape(opts.clientName);
  const origin = opts.clientDomain
    ? `Published by <strong>${escape(opts.clientDomain)}</strong>.`
    : "This app registered itself; its name is not verified.";
  const scopes = opts.scopes
    .map(
      (scope) =>
        `<label style="display:block;margin:0.25rem 0"><input type="checkbox" name="scope" value="${escape(scope)}" checked> ${escape(scope)}</label>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Authorize ${name} — Contiq MCP</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 0 1.25rem; line-height: 1.5; color: #0f172a; }
  .card { border: 1px solid #e2e8f0; border-radius: 0.375rem; padding: 1.5rem; }
  h1 { font-size: 1.25rem; margin: 0 0 0.75rem; }
  .meta { background: #f8fafc; padding: 0.75rem 1rem; border-radius: 0.25rem; font-size: 0.875rem; margin: 1rem 0; }
  .warn { color: #b45309; font-size: 0.875rem; }
  .actions { display: flex; gap: 0.75rem; margin-top: 1.25rem; }
  button { flex: 1; padding: 0.6rem 1rem; border-radius: 0.25rem; border: none; font-size: 0.95rem; cursor: pointer; }
  .approve { background: #0d9488; color: #fff; }
  .deny { background: #e2e8f0; color: #0f172a; }
</style>
<body>
  <div class="card">
    <h1>Allow ${name} to use Contiq MCP?</h1>
    <p>${origin} Tokens will be sent to <strong>${escape(opts.redirectHost)}</strong>.</p>
    ${opts.redirectIsLoopback ? `<p class="warn"><strong>This sends access to an app on your computer.</strong> Continue only if you started sign-in from that app.</p>` : ""}
    <div class="meta">
      Signed in as <strong>${escape(opts.userEmail)}</strong> (${escape(opts.authRole)})
    </div>
    <p>Requested scopes:</p>
    <form method="post">
      <input type="hidden" name="handle" value="${escape(opts.handle)}">
      ${scopes || "<p><em>none</em></p>"}
      <div class="actions">
        <button class="deny" name="decision" value="deny" type="submit">Deny</button>
        <button class="approve" name="decision" value="approve" type="submit">Allow</button>
      </div>
    </form>
  </div>
</body>
</html>`;
}

function errorHtml(message: string): string {
  return `<!doctype html><meta charset="utf-8"><title>Contiq MCP</title>
<body style="font-family:system-ui;max-width:32rem;margin:3rem auto;padding:0 1rem">
<h1>Authorization error</h1><p>${escape(message)}</p>
<p><a href="/authorize">Try again</a></p></body>`;
}

const authorizeApp = new Hono<AuthorizeEnv>();

authorizeApp.get("/authorize", async (c) => {
  const oauth = c.env.OAUTH_PROVIDER;
  let request: AuthRequest;
  try {
    request = await oauth.parseAuthRequest(c.req.raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid authorization request";
    return c.html(errorHtml(msg), 400);
  }

  const resolved = await resolveAccessUserFromRequest(c.req.raw, c.env, c.executionCtx);
  if (!resolved.ok) {
    return c.html(
      errorHtml(
        `${resolved.message}. Sign in to Contiq via Cloudflare Access, then open this authorize URL again.`,
      ),
      resolved.status,
    );
  }

  const details = await oauth.describeConsent(request);
  const consent = await oauth.beginConsent(request);
  consent.headers.set("Content-Type", "text/html; charset=utf-8");

  const html = consentHtml({
    clientName: details.clientName || "MCP Client",
    clientDomain: details.clientDomain ?? null,
    redirectHost: details.redirectHost,
    redirectIsLoopback: details.redirectIsLoopback,
    scopes: details.scope,
    handle: consent.handle,
    userEmail: resolved.user.email,
    authRole: resolved.user.auth_role,
  });

  return new Response(html, { headers: consent.headers });
});

authorizeApp.post("/authorize", async (c) => {
  const oauth = c.env.OAUTH_PROVIDER;
  const form = await c.req.formData();
  const handle = String(form.get("handle") ?? "");

  if (!handle) {
    return c.html(errorHtml("Missing consent handle. Start again from your MCP client."), 400);
  }

  if (form.get("decision") !== "approve") {
    const denied = await oauth.denyConsent(c.req.raw, handle);
    return new Response(null, { status: 302, headers: denied.headers });
  }

  const resolved = await resolveAccessUserFromRequest(c.req.raw, c.env, c.executionCtx);
  if (!resolved.ok) {
    return c.html(errorHtml(resolved.message), resolved.status);
  }

  const scopes = form.getAll("scope").map(String);
  let approved;
  try {
    approved = await oauth.approveConsent(c.req.raw, handle, { scope: scopes });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Consent expired or invalid";
    return c.html(errorHtml(msg), 400);
  }

  const props: ContiqMcpProps = {
    userId: resolved.user.id,
    email: resolved.user.email,
    name: resolved.user.name,
    authRole: resolved.user.auth_role === "admin" ? "admin" : "user",
  };

  const { redirectTo } = await oauth.completeAuthorization({
    request: approved.request,
    userId: resolved.user.id,
    metadata: {
      label: "Contiq MCP",
      email: resolved.user.email,
      authRole: props.authRole,
    },
    scope: approved.request.scope,
    props,
  });

  approved.headers.set("Location", redirectTo);
  return new Response(null, { status: 302, headers: approved.headers });
});

export { authorizeApp };
