export type RiskSeverity = "high" | "medium" | "low";
export type RiskFinding = {
  severity: RiskSeverity;
  code: string;
  title: string;
  explanation: string;
  evidence: string[];
};
export type RiskModule = {
  id: string;
  name: string;
  shortName: string;
  score: number;
  status: "verified" | "review" | "high-risk";
  summary: string;
  findings: RiskFinding[];
  metrics?: Record<string, number | null>;
};
export type RiskReport = {
  reportId: string;
  caseId: string;
  assetName: string;
  generatedAt: string;
  score: number;
  status: "verified" | "review" | "high-risk";
  decision: string;
  counts: { high: number; medium: number; passed: number };
  modules: RiskModule[];
  methodology: string;
  disclaimer: string;
};
export function analyzeCase(caseData: Record<string, unknown>): RiskReport;
export function canonicalizeReport(report: RiskReport): string;
