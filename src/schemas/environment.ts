/** Minimal Postman Environment schema subset. */

export type PostmanVariableType = "default" | "secret" | "any";

export interface PostmanEnvironmentVariable {
  key: string;
  value: string;
  type: PostmanVariableType;
  enabled: boolean;
}

export interface PostmanEnvironment {
  id?: string;
  name: string;
  values: PostmanEnvironmentVariable[];
  _postman_variable_scope?: "environment";
}
