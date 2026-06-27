/**
 * Template Parameter Validator for Megacode (OverCoat). (#44)
 *
 * Validates user-supplied parameters against a template's declared schema
 * before the template is rendered or a flow is executed. Prevents silent
 * failures caused by missing or incorrectly-typed parameters.
 *
 * Features:
 * - Required-field enforcement.
 * - Type coercion and runtime type checking (string | number | boolean | array).
 * - Pattern (regex) validation for string fields.
 * - Min/max bounds for numbers and array lengths.
 * - Enum allowlist enforcement.
 * - Default value injection for optional fields.
 */

// ============================================================================
// Schema types
// ============================================================================

export type ParamType = "string" | "number" | "boolean" | "array" | "object";

export interface ParamSchema {
  /** Display name for the parameter. */
  name: string;
  /** The expected JavaScript type. */
  type: ParamType;
  /** Whether the caller must supply this parameter. */
  required?: boolean;
  /** Default value to inject when param is missing and not required. */
  default?: unknown;
  /** Description for documentation / CLI prompts. */
  description?: string;
  /** Allowed values (works for strings and numbers). */
  enum?: (string | number)[];
  /** For strings: regular expression the value must match. */
  pattern?: string | RegExp;
  /** For numbers: minimum allowed value (inclusive). */
  min?: number;
  /** For numbers: maximum allowed value (inclusive). */
  max?: number;
  /** For arrays: minimum length. */
  minItems?: number;
  /** For arrays: maximum length. */
  maxItems?: number;
  /** For arrays: type of each element. */
  itemType?: ParamType;
}

export type TemplateSchema = Record<string, ParamSchema>;

// ============================================================================
// Validation result types
// ============================================================================

export interface ParamError {
  param: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ParamError[];
  /**
   * The coerced / default-injected parameter map. Consumers should use this
   * instead of the raw input so defaults are applied correctly.
   */
  params: Record<string, unknown>;
}

// ============================================================================
// TemplateParamValidator
// ============================================================================

/**
 * Validates and coerces a parameter map against a template's schema.
 *
 * @example
 * ```ts
 * const validator = new TemplateParamValidator({
 *   projectName: { name: "Project Name", type: "string", required: true },
 *   port: { name: "Port", type: "number", default: 3000, min: 1024, max: 65535 },
 * });
 *
 * const result = validator.validate({ projectName: "my-app" });
 * // result.valid === true, result.params.port === 3000
 * ```
 */
export class TemplateParamValidator {
  constructor(private readonly schema: TemplateSchema) {}

  /**
   * Validate and coerce the supplied params against the schema.
   * Returns a `ValidationResult` with the coerced params and any errors.
   */
  validate(input: Record<string, unknown> = {}): ValidationResult {
    const errors: ParamError[] = [];
    const params: Record<string, unknown> = {};

    for (const [key, schema] of Object.entries(this.schema)) {
      let value = Object.prototype.hasOwnProperty.call(input, key)
        ? input[key]
        : undefined;

      // Inject default
      if (value === undefined && schema.default !== undefined) {
        value = schema.default;
      }

      // Required check
      if (value === undefined || value === null) {
        if (schema.required) {
          errors.push({ param: key, message: `"${key}" is required` });
        }
        params[key] = value;
        continue;
      }

      // Type coercion and checking
      const coerced = this._coerce(value, schema.type);
      if (coerced === undefined) {
        errors.push({
          param: key,
          message: `"${key}" must be of type ${schema.type} (got ${typeof value})`,
        });
        params[key] = value;
        continue;
      }

      value = coerced;

      // Enum check
      if (schema.enum && schema.enum.length > 0) {
        if (!(schema.enum as unknown[]).includes(value)) {
          errors.push({
            param: key,
            message: `"${key}" must be one of [${schema.enum.join(", ")}]`,
          });
        }
      }

      // String pattern
      if (schema.type === "string" && schema.pattern !== undefined) {
        const regex =
          schema.pattern instanceof RegExp
            ? schema.pattern
            : new RegExp(schema.pattern);
        if (!regex.test(value as string)) {
          errors.push({
            param: key,
            message: `"${key}" does not match required pattern ${regex}`,
          });
        }
      }

      // Number bounds
      if (schema.type === "number") {
        const n = value as number;
        if (schema.min !== undefined && n < schema.min) {
          errors.push({ param: key, message: `"${key}" must be >= ${schema.min}` });
        }
        if (schema.max !== undefined && n > schema.max) {
          errors.push({ param: key, message: `"${key}" must be <= ${schema.max}` });
        }
      }

      // Array bounds and element type
      if (schema.type === "array") {
        const arr = value as unknown[];
        if (schema.minItems !== undefined && arr.length < schema.minItems) {
          errors.push({
            param: key,
            message: `"${key}" must have at least ${schema.minItems} item(s)`,
          });
        }
        if (schema.maxItems !== undefined && arr.length > schema.maxItems) {
          errors.push({
            param: key,
            message: `"${key}" must have at most ${schema.maxItems} item(s)`,
          });
        }
        if (schema.itemType) {
          for (let i = 0; i < arr.length; i++) {
            if (this._coerce(arr[i], schema.itemType) === undefined) {
              errors.push({
                param: key,
                message: `"${key}[${i}]" must be of type ${schema.itemType}`,
              });
            }
          }
        }
      }

      params[key] = value;
    }

    return {
      valid: errors.length === 0,
      errors,
      params,
    };
  }

  /**
   * Like `validate()` but throws a `TypeError` on the first validation error.
   * Useful for strict execution paths where invalid params must halt execution.
   */
  validateOrThrow(input: Record<string, unknown> = {}): Record<string, unknown> {
    const result = this.validate(input);
    if (!result.valid) {
      throw new TypeError(
        `Template parameter validation failed:\n${result.errors.map(e => `  • ${e.message}`).join("\n")}`
      );
    }
    return result.params;
  }

  /** Return a human-readable summary of the schema (for CLI help text). */
  describe(): string {
    const lines: string[] = [];
    for (const [key, schema] of Object.entries(this.schema)) {
      const required = schema.required ? " (required)" : ` (default: ${JSON.stringify(schema.default ?? null)})`;
      let line = `  ${key}: ${schema.type}${required}`;
      if (schema.description) line += ` — ${schema.description}`;
      if (schema.enum) line += `  [${schema.enum.join(" | ")}]`;
      lines.push(line);
    }
    return lines.join("\n");
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  /**
   * Attempt to coerce `value` to `type`. Returns `undefined` if impossible.
   */
  private _coerce(value: unknown, type: ParamType): unknown {
    switch (type) {
      case "string":
        return typeof value === "string" ? value : undefined;
      case "number": {
        if (typeof value === "number") return value;
        if (typeof value === "string") {
          const trimmed = value.trim();
          if (trimmed === "") return undefined;
          const n = Number(trimmed);
          return isNaN(n) ? undefined : n;
        }
        return undefined;
      }
      case "boolean": {
        if (typeof value === "boolean") return value;
        if (value === "true") return true;
        if (value === "false") return false;
        return undefined;
      }
      case "array":
        return Array.isArray(value) ? value : undefined;
      case "object":
        return typeof value === "object" && value !== null && !Array.isArray(value)
          ? value
          : undefined;
      default:
        return undefined;
    }
  }
}
