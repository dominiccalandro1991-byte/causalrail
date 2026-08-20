import { createHash } from "node:crypto";

export function fingerprintNormalized(normalized: string): string {
  const payload = normalized.trim() || "causalrail:empty";
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
