import { collection, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, getReportBlobStorage } from '../lib/firebase';
import type { AnalysisReport } from '../types';
import type { PersistedJson, PersistedReportEnvelope, ReportArtifact, ReportSection, ReportSummary } from '../types/reportPersistence';
import { assertPayloadSize, checksumJson, jsonByteSize, REPORT_PERSISTENCE_LIMITS as limits, restoreReportSections, sanitizeReportForSave, summaryReportPreview, utf8ByteSize } from '../utils/reportPersistence';
import { buildCanonicalExecutiveSnapshot } from '../domain/canonicalExecutiveSnapshot';
import { resolveReportCompletion } from '../domain/reportCompletion';
import { withDeadline } from '../utils/asyncDeadline';

export interface ReportPersistenceStore {
  write(path: string, data: Record<string, unknown>): Promise<void>;
  read(path: string): Promise<Record<string, any> | undefined>;
  publish(path: string): Promise<void>;
  uploadBlob?(path: string, json: string): Promise<void>;
  readBlob?(path: string, maxBytes: number): Promise<string>;
}
const safeId = (id: string): string => {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(id)) throw new Error('Invalid report storage identifier.');
  return id;
};
const pathRoot = (id: string) => `reports/${safeId(id)}`;

/** Sequential bounded requests: never a Firestore batch/HTTP body containing the report. */
async function storeArtifact(store: ReportPersistenceStore, root: string, userId: string, id: string, json: string): Promise<ReportArtifact> {
  const artifactId = safeId(id), sizeBytes = utf8ByteSize(json), checksum = await checksumJson(json);
  const storagePath = `reports/${safeId(userId)}/${root.split('/')[1]}/${artifactId}.json`;
  if (store.uploadBlob) {
    try {
      await store.uploadBlob(storagePath, json);
      // Verify authenticated read-back now; upload alone doesn't prove bucket CORS/read rules.
      if (!store.readBlob) throw new Error('Blob read adapter unavailable.');
      const saved = await store.readBlob(storagePath, sizeBytes);
      if (utf8ByteSize(saved) !== sizeBytes || await checksumJson(saved) !== checksum) throw new Error('Blob read-back verification failed.');
      const artifact: ReportArtifact = { artifactId, storagePath, sizeBytes, checksum, version: 1, backend: 'firebase-storage' };
      await store.write(`${root}/artifacts/${artifactId}`, artifact as unknown as Record<string, unknown>);
      return artifact;
    } catch {
      // A bucket may not be provisioned yet. Preserve the report with bounded private
      // Firestore blob chunks rather than reverting to an oversized root document.
      console.warn('[report-save] Blob storage unavailable; using bounded artifact chunks.', { artifactId, sizeBytes });
      store.uploadBlob = undefined; // Don't pay a bucket timeout again for every section.
    }
  }
  let offset = 0, index = 0;
  while (offset < json.length) {
    let end = Math.min(offset + limits.chunkBytes / 2, json.length);
    // Don't split a surrogate pair, or round-trip text/checksum would change.
    if (end < json.length && /[\uD800-\uDBFF]/.test(json[end - 1])) end--;
    let content = json.slice(offset, end);
    while (utf8ByteSize(JSON.stringify({ content })) > limits.chunkBytes) {
      end = offset + Math.floor((end - offset) / 2);
      if (/[\uD800-\uDBFF]/.test(json[end - 1])) end--;
      content = json.slice(offset, end);
    }
    if (index >= limits.maxParts) throw new Error('Report artifact chunk budget exceeded.');
    const chunk = { content, index, version: 1 };
    assertPayloadSize(chunk, 'Artifact chunk');
    await store.write(`${root}/artifacts/${artifactId}_part_${index}`, chunk);
    offset = end; index++;
  }
  const artifact: ReportArtifact = { artifactId, storagePath: `${root}/artifacts/${artifactId}`, sizeBytes, checksum, version: 1, backend: 'firestore-chunks', chunkCount: index };
  await store.write(`${root}/artifacts/${artifactId}`, artifact as unknown as Record<string, unknown>);
  return artifact;
}

export async function persistReport(store: ReportPersistenceStore, report: AnalysisReport, options: { reportId: string; userId: string; language: string; now?: string }): Promise<ReportSummary> {
  if (report.report_completion?.executionStatus === 'FAILED') throw new Error('Report has fatal structural validation errors; persistence was not started.');
  store = { ...store }; // The per-save blob circuit breaker must not mutate the caller.
  const root = pathRoot(options.reportId), plan = sanitizeReportForSave(report, options);
  // No prose, accounting values, prompts or credentials in diagnostics.
  console.info('[report-save] Payload bytes by part', plan.sizes);
  console.info('[report-save] Size audit', JSON.stringify({
    serializedReportBytes: jsonByteSize(report),
    totalBytes: Object.values(plan.sizes).reduce((sum, bytes) => sum + bytes, 0),
    metadataBytes: plan.sizes.summary,
    largestFields: Object.entries(plan.sizes).sort((a, b) => b[1] - a[1]).slice(0, 8),
    executionStatus: plan.summary.flags.executionStatus,
    coverageStatus: plan.summary.flags.coverageStatus,
  }));
  for (const [part, bytes] of Object.entries(plan.sizes)) if (bytes > limits.documentSoftBytes) console.warn('[report-save] Part exceeds soft threshold; splitting/offloading.', { part, bytes });
  // Parent establishes ownership, but history hides it until all dependencies exist.
  const pending = { ...plan.summary, persistenceState: 'saving' };
  assertPayloadSize(pending, 'Pending summary', limits.summaryHardBytes);
  await store.write(root, pending);
  const envelope: PersistedReportEnvelope = { version: 2, reportId: options.reportId, sections: [], history: [], artifacts: [], aliases: plan.aliases, recomputedFields: plan.recomputedFields };
  for (const [kind, payloads] of Object.entries({ sections: plan.sections, history: plan.history })) {
    for (const [id, payload] of Object.entries(payloads)) {
      const json = JSON.stringify(payload), entry: ReportSection = { sectionId: id, sizeBytes: utf8ByteSize(json), checksum: await checksumJson(json), version: 1 };
      const inline = { ...entry, json };
      if (utf8ByteSize(JSON.stringify(inline)) <= limits.documentHardBytes) entry.json = json;
      else {
        const artifact = await storeArtifact(store, root, options.userId, `${kind}_${id}`, json);
        entry.artifactId = artifact.artifactId;
        envelope.artifacts.push(artifact.artifactId);
      }
      assertPayloadSize(entry, `${kind}/${id}`);
      await store.write(`${root}/${kind}/${safeId(id)}`, entry as unknown as Record<string, unknown>);
      envelope[kind as 'sections' | 'history'].push(id);
    }
  }
  for (const [id, payload] of Object.entries(plan.artifacts)) {
    const artifact = await storeArtifact(store, root, options.userId, id, JSON.stringify(payload));
    envelope.artifacts.push(artifact.artifactId);
  }
  assertPayloadSize(envelope, 'Report manifest');
  await store.write(`${root}/sections/_manifest`, envelope as unknown as Record<string, unknown>);
  await store.publish(root);
  return plan.summary;
}

async function loadSection(store: ReportPersistenceStore, root: string, kind: string, id: string): Promise<PersistedJson> {
  const entry = await store.read(`${root}/${kind}/${safeId(id)}`) as unknown as ReportSection | undefined;
  if (!entry || entry.sectionId !== id || entry.version !== 1 || !Number.isInteger(entry.sizeBytes) || entry.sizeBytes < 0 || entry.sizeBytes > limits.totalHardBytes) throw new Error(`Missing/invalid saved report section: ${id}`);
  let json = entry.json;
  if (entry.artifactId) {
    const artifact = await store.read(`${root}/artifacts/${safeId(entry.artifactId)}`) as unknown as ReportArtifact | undefined;
    if (!artifact || artifact.version !== 1 || artifact.artifactId !== entry.artifactId || artifact.sizeBytes !== entry.sizeBytes || artifact.checksum !== entry.checksum) throw new Error('Invalid saved artifact reference.');
    if (artifact.backend === 'firebase-storage') {
      const reportId = root.split('/')[1];
      if (!new RegExp(`^reports/[A-Za-z0-9_-]+/${reportId}/[A-Za-z0-9_-]+\\.json$`).test(artifact.storagePath) || !store.readBlob) throw new Error('Invalid blob storage path.');
      json = await store.readBlob(artifact.storagePath, entry.sizeBytes);
    } else if (artifact.backend === 'firestore-chunks') {
      if (artifact.storagePath !== `${root}/artifacts/${entry.artifactId}` || !Number.isInteger(artifact.chunkCount) || artifact.chunkCount! < 1 || artifact.chunkCount! > limits.maxParts) throw new Error('Invalid artifact chunk count.');
      const parts: string[] = []; let bytes = 0;
      for (let index = 0; index < artifact.chunkCount!; index++) {
        const chunk = await store.read(`${root}/artifacts/${entry.artifactId}_part_${index}`);
        if (!chunk || chunk.index !== index || chunk.version !== 1 || typeof chunk.content !== 'string') throw new Error('Saved report chunk missing.');
        bytes += utf8ByteSize(chunk.content);
        if (bytes > entry.sizeBytes) throw new Error('Saved artifact size exceeded.');
        parts.push(chunk.content);
      }
      json = parts.join('');
    } else throw new Error('Unknown saved artifact backend.');
  }
  if (typeof json !== 'string' || utf8ByteSize(json) !== entry.sizeBytes || await checksumJson(json) !== entry.checksum) throw new Error(`Saved report checksum failed: ${id}`);
  return JSON.parse(json);
}

export async function readPersistedReport(store: ReportPersistenceStore, reportId: string): Promise<AnalysisReport> {
  const root = pathRoot(reportId), record = await store.read(root);
  if (!record || record.deletedAt) throw new Error('Saved report unavailable.');
  // Compatibility-only: do not rewrite old snapshots or mutate historical theses.
  if (record.persistenceVersion !== 2) {
    if (!record.data || typeof record.data !== 'object') throw new Error('Invalid legacy report.');
    return record.data as AnalysisReport;
  }
  if (record.persistenceState !== 'ready') throw new Error('Report save is incomplete; retry saving.');
  const envelope = await store.read(`${root}/sections/_manifest`) as unknown as PersistedReportEnvelope | undefined;
  if (!envelope || envelope.version !== 2 || envelope.reportId !== reportId || !Array.isArray(envelope.sections) || !Array.isArray(envelope.aliases) || envelope.sections.length > limits.maxParts || new Set(envelope.sections).size !== envelope.sections.length) throw new Error('Invalid saved report manifest.');
  const sections: Record<string, PersistedJson> = {}; let bytes = 0;
  for (const id of envelope.sections) {
    if (['__proto__', 'constructor', 'prototype', '_manifest'].includes(id)) throw new Error('Invalid section key.');
    const payload = await loadSection(store, root, 'sections', id);
    bytes += utf8ByteSize(JSON.stringify(payload));
    if (bytes > limits.totalHardBytes) throw new Error('Saved report exceeds read budget.');
    sections[id] = payload;
  }
  return restoreReportSections(sections, envelope.aliases, envelope.recomputedFields ?? []);
}

function firebaseStore(userId: string): ReportPersistenceStore {
  const checkUser = () => { if (auth.currentUser?.uid !== userId) throw new Error('Report account changed; sign in and retry.'); };
  return {
    async write(path, data) { checkUser(); assertPayloadSize(data, path); await withDeadline(setDoc(doc(db, path), data), 'Report write'); checkUser(); },
    async read(path) { checkUser(); const snapshot = await withDeadline(getDoc(doc(db, path)), 'Report read'); checkUser(); return snapshot.exists() ? snapshot.data() : undefined; },
    async publish(path) { checkUser(); await withDeadline(updateDoc(doc(db, path), { persistenceState: 'ready', savedAt: serverTimestamp() }), 'Report publish'); checkUser(); },
    async uploadBlob(path, json) {
      checkUser();
      const [{ ref, uploadBytesResumable }, storage] = await Promise.all([import('firebase/storage'), getReportBlobStorage()]);
      checkUser();
      const task = uploadBytesResumable(ref(storage, path), new TextEncoder().encode(json), { contentType: 'application/json', cacheControl: 'private, no-store' });
      const timer = setTimeout(() => task.cancel(), 15000);
      try { await task; checkUser(); } finally { clearTimeout(timer); }
    },
    async readBlob(path, maxBytes) {
      checkUser();
      const [{ ref, getBytes }, storage] = await Promise.all([import('firebase/storage'), getReportBlobStorage()]);
      checkUser(); const bytes = await withDeadline(getBytes(ref(storage, path), maxBytes), 'Report artifact read', 15000); checkUser(); return new TextDecoder().decode(bytes);
    },
  };
}
export async function saveReportSnapshot(report: AnalysisReport, userId: string, language: string): Promise<ReportSummary> {
  const reportId = doc(collection(db, 'reports')).id;
  return persistReport(firebaseStore(userId), report, { reportId, userId, language });
}
export async function loadReportSnapshot(reportId: string, userId: string): Promise<AnalysisReport> {
  const loaded = await readPersistedReport(firebaseStore(userId), reportId);
  // Don't re-run normalization on historical prose, theses or valuation assumptions.
  // Only the omitted recomputable presentation snapshot is rebuilt from saved inputs.
  if (!loaded.canonical_executive_snapshot) loaded.canonical_executive_snapshot = buildCanonicalExecutiveSnapshot(loaded, loaded.ticker);
  loaded.report_completion = { ...(loaded.report_completion ?? resolveReportCompletion(loaded, loaded.validation ?? {
    status:'warning',issues:[{code:'LEGACY_REPORT_UNVERIFIED',severity:'warning',section:'history',message:'Legacy snapshot has no current quality audit.'}],
    checked_at:loaded.generated_at || '',schema_version:loaded.schema_version ?? 0 })), persistenceStatus:'SUCCEEDED' };
  return loaded;
}
export function reportHistoryRecord(id: string, data: Record<string, any>): Record<string, any> {
  return data.persistenceVersion === 2
    ? { ...data, id, validationStatus: data.flags?.validationStatus,
      executionStatus: data.flags?.executionStatus, coverageStatus: data.flags?.coverageStatus, missingSections: data.flags?.missingSections,
      persistenceStatus: data.persistenceState === 'ready' ? 'SUCCEEDED' : 'IN_PROGRESS',
      data: summaryReportPreview(data as ReportSummary), isSummaryOnly: true }
    : { ...data, id };
}
