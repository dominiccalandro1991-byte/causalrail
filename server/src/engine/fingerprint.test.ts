import assert from "node:assert/strict";
import { test } from "node:test";
import { fingerprintNormalized } from "./fingerprint.js";

test("empty input is stable", () => {
  assert.equal(fingerprintNormalized(""), fingerprintNormalized("   "));
  assert.equal(fingerprintNormalized("abc").length, 64);
});
