import type { Context } from "hono";

type ValidationResult =
  | { success: true; data: unknown }
  | {
      success: false;
      error: {
        issues: Array<{ path: Array<string | number | symbol>; message: string }>;
      };
    };

/**
 * Standardized Zod error formatting hook for Hono zValidator middleware.
 * Formats raw Zod validation issues into clean, user-friendly error messages and structured field errors.
 */
export const formatZodErrorHook = (result: ValidationResult, c: Context) => {
  if (!result.success) {
    const issues = result.error.issues;
    const firstIssue = issues[0];
    const message = firstIssue?.message || "Validation failed";
    
    return c.json(
      {
        success: false as const,
        error: message,
        message,
        errors: issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      400
    );
  }
};
