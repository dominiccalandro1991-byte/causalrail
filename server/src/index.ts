import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { pingDb, dbConfigured } from "./db.js";
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
  let db = false;
  try {
    db = await pingDb();
  } catch {
    db = false;
  }
  res.json({ ok: true, db, configured: dbConfigured() });
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

app.listen(config.port, "0.0.0.0", () => {
  console.log(`CausalRail API listening on ${config.port}`);
});
