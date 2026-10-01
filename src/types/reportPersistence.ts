export type PersistedJson = null | boolean | number | string | PersistedJson[] | { [key: string]: PersistedJson };

/** Only list/search/decision summaries belong in reports/{id}; never source trees. */
export interface ReportSummary {
  reportId: string;
  userId: string;
  ticker: string;
  companyName: string;
  marketPrice: number | null;
  fairValue: number | null;
  convictionScore: number | null;
  executiveSummary: string;
  keyTakeaways: string[];
  thesisSummary: string;
  valuationAssumptions: Record<string, string | number | boolean | null>;
  valuationRun?: { valuationRunId: string; financialSnapshotId: string; inputHash: string;
    assumptionHash: string; modelVersion: string; primaryMethod: string; status: string };
  flags: { validationStatus: string; analysisType: string; marginOfSafetyPct: number | null;
    executionStatus?: 'COMPLETED' | 'FAILED'; coverageStatus?: 'COMPLETE' | 'PARTIAL';
    consistencyStatus?: 'PASS' | 'WARNING' | 'FAIL'; valuationStatus?: 'PASS' | 'UNAVAILABLE' | 'FAIL';
    qualityStatus?: 'PASS' | 'WARNING' | 'FAIL'; persistenceStatus?: 'PENDING' | 'SUCCEEDED' | 'FAILED';
    missingSections?: string[] };
  language: string;
  generatedAt: string;
  createdAt: string;
  schemaVersion: number;
  generatedByVersion: string;
  persistenceVersion: 2;
}

/** Heavy rendered sections live below the report, or refer to an immutable blob. */
export interface ReportSection {
  sectionId: string;
  sizeBytes: number;
  checksum: string;
  version: 1;
  json?: string;
  artifactId?: string;
}

/** Source/artifact bodies are never embedded in the main report or manifest. */
export interface ReportArtifact {
  artifactId: string;
  storagePath: string;
  sizeBytes: number;
  checksum: string;
  version: 1;
  backend: 'firebase-storage' | 'firestore-chunks';
  chunkCount?: number;
}

export interface PersistedReportEnvelope {
  version: 2;
  reportId: string;
  sections: string[];
  artifacts: string[];
  history: string[];
  /** JSON pointer aliases restore duplicated accepted datasets without storing twice. */
  aliases: { target: string[]; source: string[] }[];
  recomputedFields: string[];
}
