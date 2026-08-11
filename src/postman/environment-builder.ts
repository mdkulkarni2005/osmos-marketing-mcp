import type { PostmanEnvironment, PostmanVariableType } from "../schemas/environment.js";

export interface EnvironmentBuildOptions {
  serviceName: string;
  serviceVersion: string;
  suiteName: string;
  baseUrl: string;
}

/** Variables that must always be typed `secret` — never emit a real value here. */
const SECRET_VARIABLES = new Set(["token"]);

/**
 * Builds a Postman environment template containing only the variables the
 * built collection actually references (usedVariables from
 * collection-builder), plus base_url. Never embeds a real secret value —
 * secret-typed variables get an empty placeholder string, filled in
 * locally by whoever runs the collection on the execution machine.
 */
export function buildEnvironment(
  usedVariables: string[],
  options: EnvironmentBuildOptions
): PostmanEnvironment {
  const name = `${options.serviceName} ${options.serviceVersion} - ${options.suiteName}`;

  const values = usedVariables
    .filter((v) => v !== "base_url")
    .map((key) => ({
      key,
      value: "",
      type: (SECRET_VARIABLES.has(key) ? "secret" : "default") as PostmanVariableType,
      enabled: true,
    }));

  values.unshift({ key: "base_url", value: options.baseUrl, type: "default", enabled: true });

  return { name, values };
}
