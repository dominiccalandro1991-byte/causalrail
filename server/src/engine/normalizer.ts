import type { FailureCategory, Frame, NormalizeResult } from "./types.js";
import { fingerprintNormalized } from "./fingerprint.js";

const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
const TIMESTAMP =
  /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g;
const CLOCK = /\b\d{1,2}:\d{2}:\d{2}(?:[.,]\d+)?\b/g;
const HEX_ADDR = /\b0x[0-9a-fA-F]{4,}\b/g;
const UUID =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const GIT_SHA = /\b[0-9a-f]{7,40}\b/g;
const PID = /\b(?:pid|PID|process(?:\s+id)?)\s*[:=#]?\s*\d+\b/g;
const DURATION = /\b\d+(?:\.\d+)?\s?(?:ms|µs|us|ns|s|sec|secs|seconds)\b/gi;
const MEMORY = /\b\d+(?:\.\d+)?\s?(?:b|kb|mb|gb|tb|kib|mib|gib)\b/gi;
const LOCALHOST = /localhost:\d+/g;
const WORKER = /\b(?:worker|jest-worker|pid)[-_ ]?\d+\b/gi;
const ABS_UNIX = /(?:\/(?:home|Users|opt|var|tmp|usr|app)\/[^\s"'`]+)/g;
const WIN_PATH = /[A-Za-z]:\\[^\s"'`]+/g;
const FILE_URL = /file:\/\/\/[^\s"'`]+/g;
const RUNNER_NOISE =
  /##\[(?:error|warning|debug|group|endgroup|command)\].*$/gm;

const JS_FRAME =
  /^\s*at\s+(?:(?<fn>.+?)\s+\()?(?:(?<file>[^()\n]+?):(?<line>\d+)(?::(?<col>\d+))?\)?)?\s*$/;
const PY_FILE = /^\s*File\s+"(?<file>[^"]+)",\s+line\s+(?<line>\d+)(?:,\s+in\s+(?<fn>.+))?/;
const JAVA_FRAME =
  /^\s*at\s+(?<fn>[\w.$]+)\((?<file>[\w.]+):(?<line>\d+)\)/;
const GO_FRAME = /^\s*(?<file>\S+\.go):(?<line>\d+)\s+/;
const RUBY_FRAME = /^\s*from\s+(?<file>.+):(?<line>\d+):in\s+`(?<fn>[^']+)'/;

const NOISE_PATH =
  /node_modules|site-packages|dist[/\\]runtime|jest-circus|vitest[/\\]dist|pytest[/\\]runner|internal[/\\]process|node:internal/;

function stripNoise(raw: string): string {
  return raw
    .replace(ANSI, "")
    .replace(RUNNER_NOISE, "")
    .replace(TIMESTAMP, "<ts>")
    .replace(CLOCK, "<ts>")
    .replace(UUID, "<uuid>")
    .replace(HEX_ADDR, "<addr>")
    .replace(PID, "pid=<pid>")
    .replace(DURATION, "<dur>")
    .replace(MEMORY, "<mem>")
    .replace(LOCALHOST, "localhost:<port>")
    .replace(WORKER, "worker-<n>")
    .replace(FILE_URL, (m) => relativize(m.replace(/^file:\/\/\/?/, "/")))
    .replace(ABS_UNIX, relativize)
    .replace(WIN_PATH, relativize)
    .replace(GIT_SHA, (m) => (m.length >= 7 ? "<sha>" : m));
}

function relativize(path: string): string {
  const unix = path.replace(/\\/g, "/");
  const src = unix.search(/\/(?:src|app|lib|packages|tests?|cypress|e2e)\//i);
  if (src >= 0) return unix.slice(src + 1);
  const parts = unix.split("/");
  return parts.slice(-3).join("/");
}

function detectLanguage(line: string): Frame["language"] {
  if (line.includes("File \"") || line.includes("Traceback")) return "python";
  if (/^\s*at\s+[\w.$]+\(/.test(line) && line.includes(".java")) return "java";
  if (line.includes(".go:")) return "go";
  if (/from .+in `/.test(line)) return "ruby";
  if (/^\s*at\s+/.test(line)) return "js";
  return "other";
}

function parseFrame(line: string): Frame | null {
  const js = JS_FRAME.exec(line);
  if (js?.groups?.file) {
    const file = relativize(js.groups.file.trim());
    if (NOISE_PATH.test(file)) return null;
    return {
      language: "js",
      functionName: (js.groups.fn ?? "<anonymous>").trim(),
      file,
      line: js.groups.line ? Number(js.groups.line) : null,
      raw: line.trim(),
    };
  }
  const py = PY_FILE.exec(line);
  if (py?.groups?.file) {
    const file = relativize(py.groups.file);
    if (NOISE_PATH.test(file)) return null;
    return {
      language: "python",
      functionName: (py.groups.fn ?? "<module>").trim(),
      file,
      line: Number(py.groups.line),
      raw: line.trim(),
    };
  }
  const java = JAVA_FRAME.exec(line);
  if (java?.groups) {
    return {
      language: "java",
      functionName: java.groups.fn,
      file: java.groups.file,
      line: Number(java.groups.line),
      raw: line.trim(),
    };
  }
  const go = GO_FRAME.exec(line);
  if (go?.groups) {
    return {
      language: "go",
      functionName: "<fn>",
      file: relativize(go.groups.file),
      line: Number(go.groups.line),
      raw: line.trim(),
    };
  }
  const ruby = RUBY_FRAME.exec(line);
  if (ruby?.groups) {
    return {
      language: "ruby",
      functionName: ruby.groups.fn,
      file: relativize(ruby.groups.file),
      line: Number(ruby.groups.line),
      raw: line.trim(),
    };
  }
  return null;
}

function extractFrames(raw: string): Frame[] {
  const frames: Frame[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const frame = parseFrame(line);
    if (frame) frames.push(frame);
  }
  return frames;
}

function framesToCanonical(frames: Frame[]): string {
  return frames
    .slice(0, 12)
    .map((f) => `${f.language}|${f.file}|${f.functionName}|${f.line ?? 0}`)
    .join("\n");
}

const CATEGORY_RULES: { category: FailureCategory; re: RegExp; cause: string; confidence: number }[] = [
  {
    category: "timeout",
    re: /timeout|timed out|etimedout|exceeded \d+|deadline exceeded/i,
    cause: "Operation exceeded its time budget.",
    confidence: 0.86,
  },
  {
    category: "oom",
    re: /out of memory|javascript heap|enomem|killed process|oom-killer/i,
    cause: "Process exhausted available memory.",
    confidence: 0.9,
  },
  {
    category: "dependency",
    re: /econnrefused|enotfound|registry\.npmjs|pip install|failed to resolve|socket hang up/i,
    cause: "Upstream dependency or network resolution failed.",
    confidence: 0.78,
  },
  {
    category: "infra",
    re: /no space left|docker daemon|cannot connect to the docker|runner was stopped|the job was canceled/i,
    cause: "Runner or infrastructure fault, not product code.",
    confidence: 0.82,
  },
  {
    category: "flake",
    re: /flaky|intermittent|race condition|order-dependent|was not called/i,
    cause: "Non-deterministic test observed.",
    confidence: 0.7,
  },
  {
    category: "assertion",
    re: /assertionerror|expect\(|assert\s|expected .* received|test failed|failed:/i,
    cause: "Hard assertion failed in product or test code.",
    confidence: 0.8,
  },
];

export function classifyFailure(text: string): {
  category: FailureCategory;
  rootCause: string;
  confidence: number;
} {
  for (const rule of CATEGORY_RULES) {
    if (rule.re.test(text)) {
      return { category: rule.category, rootCause: rule.cause, confidence: rule.confidence };
    }
  }
  return {
    category: "unknown",
    rootCause: "No deterministic pattern matched the log.",
    confidence: 0.35,
  };
}

export function normalizeStackTrace(raw: string): NormalizeResult {
  const stripped = stripNoise(raw);
  const frames = extractFrames(raw);
  const canonical = frames.length > 0 ? framesToCanonical(frames) : stripped.slice(0, 4000).trim();
  const fingerprint = fingerprintNormalized(canonical);
  const classified = classifyFailure(raw);
  const needsLlm = frames.length === 0 && classified.category === "unknown";

  const normalized =
    frames.length > 0
      ? frames
          .map((f) => `at ${f.functionName} (${f.file}:${f.line ?? 0})`)
          .join("\n")
      : stripped
          .split(/\r?\n/)
          .map((l) => l.trimEnd())
          .filter((l) => l.length > 0)
          .slice(0, 80)
          .join("\n");

  return {
    normalized,
    frames,
    fingerprint,
    needsLlm,
    category: classified.category,
    rootCause: classified.rootCause,
    confidence: classified.confidence,
  };
}

export function languageHint(frames: Frame[]): string {
  const counts = new Map<string, number>();
  for (const f of frames) counts.set(f.language, (counts.get(f.language) ?? 0) + 1);
  let best = "other";
  let n = 0;
  for (const [k, v] of counts) {
    if (v > n) {
      best = k;
      n = v;
    }
  }
  return best;
}

export { detectLanguage, stripNoise };
