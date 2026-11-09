import type { AuthoredContent, AuthoredDomain } from "./AuthoredContent";

export interface ContentSource {
  domain: AuthoredDomain;
  source: string;
  data: unknown;
}

export interface LocaleSource extends ContentSource {
  language: string;
}

export interface LocalizationInput {
  content: readonly ContentSource[];
  locales: readonly LocaleSource[];
  language: string;
  allowEnglishFallback?: boolean;
}

export type LocalizationDiagnosticCode =
  | "invalid-language"
  | "invalid-shape"
  | "duplicate-key"
  | "malformed-reference"
  | "missing-english-key"
  | "missing-target-key"
  | "fallback-used"
  | "temporary-text"
  | "malformed-placeholder"
  | "unknown-placeholder"
  | "placeholder-set-mismatch"
  | "unused-entry";

export interface LocalizationDiagnostic {
  code: LocalizationDiagnosticCode;
  severity: "error" | "info";
  source: string;
  path: readonly (string | number)[];
  language: string;
  message: string;
  reference?: string;
  placeholder?: string;
}

export type LocalizationResult =
  | { success: false; diagnostics: LocalizationDiagnostic[] }
  | {
      success: true;
      definitions: AuthoredContent;
      metadata: { language: string; allowEnglishFallback: boolean };
      diagnostics: LocalizationDiagnostic[];
    };
