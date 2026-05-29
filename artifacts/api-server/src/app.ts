import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve the compiled frontend in production.
// The Dockerfile copies parking/dist/public → dist/public next to dist/index.mjs.
if (process.env.NODE_ENV === "production") {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const frontendPath = join(__dirname, "public");
  if (existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    // SPA fallback — let React Router handle unmatched paths
    app.use((_req, res) => {
      res.sendFile(join(frontendPath, "index.html"));
    });
  }
}

export default app;
