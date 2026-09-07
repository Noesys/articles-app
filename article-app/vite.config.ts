import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function apiMethodProxy() {
  return {
    name: "api-method-proxy",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = req.url || "";
        const isArticles = url.startsWith("/api/articles");
        const isMine = url.includes("/mine");
        let targetBase: string | null = null;
        if (req.method === "POST" && isArticles) targetBase = "http://127.0.0.1:8787";
        else if (req.method === "GET" && isArticles && !isMine) {
          // Admin list/detail: GET /api/articles[?month=] or GET /api/articles/:id
          // User detail is /api/articles/mine/:id (already handled by proxy)
          targetBase = "http://127.0.0.1:8788";
        }
        if (!targetBase) return next();
        const http = await import("node:http");
        const target = targetBase + url.replace(/^\/api/, isMine ? "" : url.startsWith("/api/articles") && targetBase.includes("8787") ? "" : url.startsWith("/api/articles") ? "/api/articles" + url.slice("/api/articles".length) : url);
        // Simplify: keep /api prefix for admin (8788), strip for user (8787)
        const finalPath = targetBase.includes("8788") ? url : url.replace(/^\/api/, "");
        const finalTarget = targetBase + finalPath;
        const parsed = new URL(finalTarget);
        const proxyReq = http.request(
          { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname + parsed.search, method: req.method, headers: req.headers },
          (proxyRes: any) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
          }
        );
        req.pipe(proxyReq);
        proxyReq.on("error", next);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths(), apiMethodProxy()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // /api/articles/mine → user-api
      "/api/articles/mine": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/api/users": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true,
      },
      "/api/article-types": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true,
      },
      "/api/insights": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true,
      },
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
