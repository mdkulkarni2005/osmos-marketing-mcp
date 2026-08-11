import type { PostmanEnvironment } from "../schemas/environment.js";
import type { ValidationReport } from "../postman/collection-validator.js";
import type { ExecutionMode } from "./types.js";

export interface PreflightInput {
  mode: ExecutionMode;
  validation: ValidationReport;
  environment: PostmanEnvironment;
  usedVariables: string[];
  confirmRun?: boolean;
  allowProductionUrl?: boolean;
}

export interface PreflightResult {
  allowed: boolean;
  blockers: string[];
  warnings: string[];
}

/**
 * Patterns that suggest a base_url points at a real production system
 * rather than a test/staging/sandbox environment. Deliberately a blocklist
 * of positive signals for "safe", not a guess at what production looks
 * like — see brief §2 "detect obvious production URLs if possible".
 */
const SAFE_HOST_HINTS = /(localhost|127\.0\.0\.1|\bstaging\b|\bstage\b|\bsandbox\b|\bdev\b|\btest\b|\buat\b|\bqa\b)/i;

/**
 * Blocks RUN unless every documented safety condition holds (brief §2).
 * BUILD_ONLY / VALIDATE_ONLY / DRY_RUN are always allowed — they never
 * touch a real API or require credentials, so there's nothing to block.
 */
export function runPreflight(input: PreflightInput): PreflightResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (input.mode !== "RUN") {
    return { allowed: true, blockers, warnings };
  }

  if (!input.confirmRun) {
    blockers.push("RUN mode requires an explicit execution request (confirmRun=true). Refusing to guess intent.");
  }

  if (!input.validation.passed) {
    blockers.push("Collection validation has critical findings — fix them before RUN can proceed.");
  }

  const byKey = new Map(input.environment.values.map((v) => [v.key, v]));

  const baseUrl = byKey.get("base_url");
  if (!baseUrl || !baseUrl.value.trim()) {
    blockers.push("Environment is missing a non-empty base_url.");
  } else if (!SAFE_HOST_HINTS.test(baseUrl.value) && !input.allowProductionUrl) {
    blockers.push(
      `base_url "${baseUrl.value}" does not look like a test/staging/sandbox host and allowProductionUrl was not set — ` +
        `refusing to run against what may be production. Pass allowProductionUrl=true if this is intentional.`
    );
  } else if (!SAFE_HOST_HINTS.test(baseUrl.value) && input.allowProductionUrl) {
    warnings.push(`base_url "${baseUrl.value}" does not look like a test host — running only because allowProductionUrl=true.`);
  }

  for (const key of input.usedVariables) {
    if (key === "base_url") continue;
    const v = byKey.get(key);
    if (!v || !v.enabled || !v.value.trim()) {
      blockers.push(`Required environment variable "${key}" is missing or empty.`);
    }
  }

  return { allowed: blockers.length === 0, blockers, warnings };
}
