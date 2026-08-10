/**
 * lib/pipeline/validate.ts
 *
 * Schema + business-rule validation for anything the pipeline proposes to
 * write. This runs on EVERY proposal before it ever reaches the diff/update
 * stages — nothing touches disk if it fails here. Uses zod for schema shape
 * validation, plus a handful of hand-written business rules that a generic
 * schema can't express (e.g. "a compact pathway requires both states to be
 * members").
 */
import { z } from "zod";
import type { ValidationResult, ValidationIssue } from "./types";

const faqSchema = z.object({
  question: z.string().min(5),
  answer: z.string().min(10),
});

export const professionSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(3),
  shortName: z.string().min(2),
  category: z.string().min(2),
  icon: z.string().min(2),
  description: z.string().min(10),
  longDescription: z.string().min(20),
  averageTransferDays: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  hasNationalCompact: z.boolean(),
  compactName: z.string().optional(),
  compactStates: z.array(z.string()).optional(),
  commonExam: z.string().optional(),
  commonExamAcceptedStates: z.array(z.string()).optional(),
  faqs: z.array(faqSchema).min(1),
  relatedProfessions: z.array(z.string()),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceUrl: z.string().url().optional(),
  verifiedAt: z.string().optional(),
});

export const stateSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(3),
  abbreviation: z.string().length(2),
  region: z.enum(["West", "Midwest", "South", "Northeast"]),
  licensingAuthorityNote: z.string().min(10),
  isUlrState: z.boolean(),
  ulrEnactedYear: z.number().int().min(2015).max(2035).optional(),
  populationRank: z.number().int().min(1).max(60),
  faqs: z.array(faqSchema).min(1),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceUrl: z.string().url().optional(),
  verifiedAt: z.string().optional(),
});

function toIssues(zodError: z.ZodError): ValidationIssue[] {
  return zodError.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    severity: "error" as const,
  }));
}

export function validateProfession(record: unknown): ValidationResult {
  const result = professionSchema.safeParse(record);
  if (result.success) return { valid: true, issues: [] };
  return { valid: false, issues: toIssues(result.error) };
}

export function validateState(record: unknown): ValidationResult {
  const result = stateSchema.safeParse(record);
  if (result.success) return { valid: true, issues: [] };
  return { valid: false, issues: toIssues(result.error) };
}

/**
 * Business rules that span more than one field, or need domain knowledge
 * a generic schema can't encode.
 */
export function runBusinessRules(entityKind: "profession" | "state", record: Record<string, unknown>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (entityKind === "profession") {
    const hasCompact = record.hasNationalCompact === true;
    const compactStates = record.compactStates as string[] | undefined;
    if (hasCompact && (!compactStates || compactStates.length === 0)) {
      issues.push({
        path: "compactStates",
        message: "hasNationalCompact is true but compactStates is empty — a compact with zero member states is not meaningful.",
        severity: "error",
      });
    }
    if (!hasCompact && compactStates && compactStates.length > 0) {
      issues.push({
        path: "hasNationalCompact",
        message: "compactStates is populated but hasNationalCompact is false — likely an extraction inconsistency, flag for manual review.",
        severity: "warning",
      });
    }
  }

  if (entityKind === "state") {
    const isUlr = record.isUlrState === true;
    const year = record.ulrEnactedYear as number | undefined;
    if (isUlr && !year) {
      issues.push({
        path: "ulrEnactedYear",
        message: "isUlrState is true but ulrEnactedYear is missing — acceptable but should be filled in when the source states it.",
        severity: "warning",
      });
    }
    if (!isUlr && year) {
      issues.push({
        path: "isUlrState",
        message: "ulrEnactedYear is set but isUlrState is false — likely an extraction inconsistency, flag for manual review.",
        severity: "warning",
      });
    }
  }

  return issues;
}

export function validateProposal(entityKind: "profession" | "state", record: Record<string, unknown>): ValidationResult {
  const schemaResult = entityKind === "profession" ? validateProfession(record) : validateState(record);
  const businessIssues = runBusinessRules(entityKind, record);
  const allIssues = [...schemaResult.issues, ...businessIssues];
  const hasBlockingErrors = allIssues.some((i) => i.severity === "error");
  return { valid: !hasBlockingErrors, issues: allIssues };
}
