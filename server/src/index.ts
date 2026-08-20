import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { pingDb, dbConfigured, dbLastError } from "./db.js";
import { githubHmac } from "./middleware/hmac.js";
import { handleGitHubWebhook } from "./routes/webhooks.js";
import { apiRouter } from "./routes/api.js";

const app = express();

app.use(
  cors({
    origin: config.clientOrigin === "*" ? true : config.clientOrigin.split(","),
  }),
);

app.get("/health", async (_req, res) => {
  const db = await pingDb();
  res.json({
    ok: true,
    db,
    configured: dbConfigured(),
    dbError: db ? null : dbLastError(),
  });
});

app.post(
  "/webhooks/github",
  express.raw({ type: "*/*" }),
  (req, _res, next) => {
    const raw = req.body as Buffer;
    (req as express.Request & { rawBody?: Buffer }).rawBody = raw;
    try {
      req.body = JSON.parse(raw.toString("utf8") || "{}");
    } catch {
      req.body = {};
    }
    next();
  },
  githubHmac,
  (req, res, next) => {
    void handleGitHubWebhook(req, res).catch(next);
  },
);

app.use(express.json({ limit: "2mb" }));
app.use("/api", apiRouter);

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const message = err instanceof Error ? err.message : "internal error";
    console.error(message);
    const dbDown =
      /DATABASE_URL|ECONNREFUSED|ENOTFOUND|timeout|ssl|password authentication|Tenant or user not found/i.test(
        message,
      );
    res.status(dbDown ? 503 : 500).json({ error: dbDown ? "database_unavailable" : "internal", detail: message });
  },
);

process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection", reason);
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(`CausalRail API listening on ${config.port}`);
});
