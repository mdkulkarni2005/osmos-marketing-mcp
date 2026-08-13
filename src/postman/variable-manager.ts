/**
 * Central place for the one transform every builder needs: turning a
 * placeholder written in the testcase workbook (`<retailer_id>`) into a
 * Postman variable reference (`{{retailer_id}}`). Also tracks which
 * variable names actually got used, so environment-builder only emits
 * variables the collection references — never invents unused ones.
 */

const PLACEHOLDER = /<([a-zA-Z0-9_]+)>/g;
const PATH_PARAM = /\{([a-zA-Z0-9_]+)\}/g;

export class VariableTracker {
  private used = new Set<string>();

  toPostmanVar(name: string): string {
    this.used.add(name);
    return `{{${name}}}`;
  }

  /** Replace `<name>` placeholders (as seen in workbook header/body cells) with `{{name}}`. */
  substitutePlaceholders(text: string): string {
    return text.replace(PLACEHOLDER, (_m, name) => this.toPostmanVar(name));
  }

  /** Replace OpenAPI-style `{name}` path segments with Postman `{{name}}` variables. */
  substitutePathParams(urlPath: string): string {
    return urlPath.replace(PATH_PARAM, (_m, name) => this.toPostmanVar(name));
  }

  usedVariables(): string[] {
    return [...this.used].sort();
  }
}
