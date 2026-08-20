import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeStackTrace } from "./normalizer.js";

const LOG_A = `2026-08-18T14:02:11.441Z FAIL
    AssertionError: expected 8.25 to be 8.5
      at Object.<anonymous> (/home/runner/work/web-checkout/web-checkout/src/checkout/tax.test.ts:48:21)
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
`;

const LOG_B = `2026-08-19T01:00:00.000Z FAIL
    AssertionError: expected 1 to be 2
      at Object.<anonymous> (/Users/ci/web-checkout/src/checkout/tax.test.ts:48:99)
      at processTicksAndRejections (node:internal/process/task_queues:95:5)
`;

test("same frames yield the same fingerprint across machines and timestamps", () => {
  const a = normalizeStackTrace(LOG_A);
  const b = normalizeStackTrace(LOG_B);
  assert.equal(a.fingerprint, b.fingerprint);
  assert.equal(a.frames[0]?.file.includes("src/checkout/tax.test.ts"), true);
  assert.equal(a.category, "assertion");
});

test("timeout logs classify without frames", () => {
  const r = normalizeStackTrace("Error: deadline exceeded after 30000ms");
  assert.equal(r.category, "timeout");
});
