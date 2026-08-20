export type FailureCategory =
  | "assertion"
  | "timeout"
  | "flake"
  | "infra"
  | "dependency"
  | "oom"
  | "unknown";

export type Frame = {
  language: "js" | "python" | "java" | "go" | "ruby" | "other";
  functionName: string;
  file: string;
  line: number | null;
  raw: string;
};

export type NormalizeResult = {
  normalized: string;
  frames: Frame[];
  fingerprint: string;
  needsLlm: boolean;
  category: FailureCategory;
  rootCause: string;
  confidence: number;
};
