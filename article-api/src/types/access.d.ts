// Augment Hono's ExecutionContext (not the global one) to include
// Cloudflare Access typings.  Hono defines its own ExecutionContext in
// "hono/dist/types/context", which is what `c.executionCtx` resolves to.
// The global ExecutionContext from worker-configuration.d.ts already has
// `access`, but Hono never re-exports or extends it.

import "hono";

declare module "hono" {
  interface ExecutionContext {
    /**
     * Cloudflare Access context, injected by the Workers runtime when an
     * Access policy protects the Worker.
     */
    access?: {
      readonly aud: string;
      getIdentity(): Promise<CloudflareAccessIdentity | undefined>;
    };
  }
}
