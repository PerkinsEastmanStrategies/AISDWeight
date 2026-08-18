import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { insertWeightingSubmission } from "./api/_insert-weighting.mjs";

function submitApiPlugin(): Plugin {
  return {
    name: "submit-weighting-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split("?")[0];
        if (path !== "/api/submit-weighting") {
          next();
          return;
        }
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        req.on("end", () => {
          void (async () => {
            try {
              const raw = Buffer.concat(chunks).toString("utf8");
              const body = raw ? JSON.parse(raw) : {};
              const env = loadEnv(server.config.mode, server.config.root, "");
              const result = await insertWeightingSubmission(body, {
                ...process.env,
                ...env,
              });
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(result));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  error: err instanceof Error ? err.message : "Could not save to Supabase.",
                }),
              );
            }
          })();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), submitApiPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
      },
    },
  },
});
