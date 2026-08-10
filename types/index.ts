/**
 * Core domain types for PermitBridge.
 * These mirror the shape of the JSON files in /data so the data layer
 * can be swapped for a real database later without touching the UI.
 */

export type PathwayType = "reciprocity" | "endorsement" | "comity" | "compact" | "none";

export interface ProfessionSummary {
  slug: string;
  name: string;
  shortName: string;
  category: string;
  icon: string;
  description: string;
}

export interface Profession extends ProfessionSummary {
  longDescription: string;
  averageTransferDays: [number, number];
  hasNationalCompact: boolean;
  compactName?: string;
  compactStates?: string[];
  commonExam?: string;
  commonExamAcceptedStates?: string[];
  faqs: FAQ[];
  relatedProfessions: string[];
  updatedAt: string;
  /** Optional pipeline provenance — see TransferRule for the same pattern. */
  sourceUrl?: string;
  verifiedAt?: string;
}

export interface StateSummary {
  slug: string;
  name: string;
  abbreviation: string;
  region: "West" | "Midwest" | "South" | "Northeast";
}

export interface State extends StateSummary {
  licensingAuthorityNote: string;
  isUlrState: boolean;
  ulrEnactedYear?: number;
  populationRank: number;
  faqs: FAQ[];
  updatedAt: string;
  /** Optional pipeline provenance — see TransferRule for the same pattern. */
  sourceUrl?: string;
  verifiedAt?: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface TransferRule {
  profession: string;
  fromState: string;
  toState: string;
  pathway: PathwayType;
  pathwayLabel: string;
  examRequired: boolean;
  examName?: string;
  additionalHoursRequired: number;
  feeUsd: number;
  estimatedProcessingDays: [number, number];
  minimumYearsLicensed: number;
  difficultyScore: number; // 1 (easy) - 10 (hard)
  portabilityScore: number; // 0-100, higher = easier to transfer
  steps: string[];
  notes: string;
  officialSourceName: string;
  updatedAt: string;
  /**
   * Optional provenance metadata, populated only for fields that were
   * confirmed by the data pipeline against a live official source rather
   * than computed by the default rule engine. Entirely optional and never
   * read by any page/component — safe to ignore.
   */
  sourceUrl?: string;
  verifiedAt?: string;
  confidence?: number;
}

export interface GuideSummary {
  slug: string;
  title: string;
  description: string;
  category: string;
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
}

export interface BlogPostSummary {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  tag: string;
  readingMinutes: number;
}

export interface SearchDocument {
  type: "profession" | "state" | "transfer" | "guide" | "blog";
  title: string;
  description: string;
  url: string;
  keywords: string[];
}
