import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { config } from "../config.js";

export function verifyGitHubSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !signatureHeader) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expected = `sha256=${digest}`;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function githubHmac(req: Request, res: Response, next: NextFunction): void {
  if (!config.webhookSecret) {
    res.status(500).json({ error: "GITHUB_WEBHOOK_SECRET is not configured" });
    return;
  }
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!raw) {
    res.status(400).json({ error: "missing raw body" });
    return;
  }
  const signature = req.header("x-hub-signature-256");
  if (!verifyGitHubSignature(raw, signature, config.webhookSecret)) {
    res.status(401).json({ error: "invalid signature" });
    return;
  }
  next();
}
