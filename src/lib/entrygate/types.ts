import { z } from "zod";

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .pipe(z.string().url().optional());

const optionalRepo = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

export const AuditRequest = z.object({
  message: z.string().min(1).max(4000),
  demoUrl: optionalUrl,
  repoUrl: optionalRepo,
  videoUrl: optionalUrl,
});
export type AuditRequest = z.infer<typeof AuditRequest>;

export type Verdict = "go" | "almost" | "no-go";

export interface ChecklistItem {
  id: string;
  label: string;
  status: "pass" | "fail" | "warn" | "skip";
  detail: string;
  priority: number;
}

export interface ToolTrace {
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
  summary: string;
  raw?: unknown;
}

export interface AuditResult {
  verdict: Verdict;
  summary: string;
  score: number;
  checklist: ChecklistItem[];
  fixes: string[];
  tools: ToolTrace[];
  llmUsed: boolean;
  llmError?: string;
}
