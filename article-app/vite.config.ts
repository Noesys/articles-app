import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Chunks that should load only with their routes — never preload with the shell. */
const ROUTE_ONLY_CHUNK =
  /(?:^|\/)(?:tiptap|markdown|table-|data-grid|MyArticles|Article|UsersPage|Insights|Admin|Tiptap|Markdown)/;

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 500,
    modulePreload: {
      // Keep the polyfill, but don't preload TipTap/DataGrid/etc. with the app shell.
      resolveDependencies: (_filename, deps) => deps.filter((dep) => !ROUTE_ONLY_CHUNK.test(dep)),
    },
    rolldownOptions: {
      output: {
        strictExecutionOrder: true,
        codeSplitting: {
          groups: [
            {
              name: "react-vendor",
              test: /node_modules[\\/](react|react-dom|scheduler)([\\/]|$)/,
              priority: 40,
            },
            {
              name: "router",
              test: /node_modules[\\/]react-router/,
              priority: 35,
            },
            {
              name: "tiptap",
              test: /node_modules[\\/](@tiptap|prosemirror)/,
              priority: 30,
              // Avoid pulling shared deps into this chunk (which would force
              // unrelated routes to download TipTap).
              includeDependenciesRecursively: false,
            },
            {
              name: "markdown",
              test: /node_modules[\\/](react-markdown|remark-|rehype-|marked|dompurify|turndown)/,
              priority: 25,
              includeDependenciesRecursively: false,
            },
            {
              name: "table",
              test: /node_modules[\\/](@tanstack[\\/]react-table|@tanstack[\\/]react-virtual|@dnd-kit)/,
              priority: 25,
              includeDependenciesRecursively: false,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
});
