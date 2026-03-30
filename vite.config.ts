import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const appVersion = process.env.VITE_APP_VERSION || process.env.npm_package_version || "dev";

function versionManifestPlugin() {
  const versionPayload = JSON.stringify({ version: appVersion }, null, 2);

  return {
    name: "version-manifest",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use("/version.json", (_req, res) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.end(versionPayload);
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: versionPayload,
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), versionManifestPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
