const TICKER_PATTERN = /^[A-Z0-9.-]{1,12}$/;
const MODEL_PATTERN = /^gemini-[a-z0-9.-]{1,48}$/;
const SAFE_FILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;

export const ANALYSIS_TYPES = new Set(['fundamental', 'technical', 'combined']);
export const ANALYSIS_LANGUAGES = new Set(['Thai', 'English']);

export function normalizeTicker(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const ticker = value.trim().toUpperCase();
  return TICKER_PATTERN.test(ticker) ? ticker : null;
}

export function normalizeGeminiModel(value: unknown, fallback = 'gemini-3.8-flash'): string | null {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return null;
  const model = value.trim().toLowerCase();
  return MODEL_PATTERN.test(model) ? model : null;
}

export function normalizeAnalysisType(value: unknown): 'fundamental' | 'technical' | 'combined' | null {
  if (value === undefined || value === null || value === '') return 'fundamental';
  return typeof value === 'string' && ANALYSIS_TYPES.has(value)
    ? value as 'fundamental' | 'technical' | 'combined'
    : null;
}

export function normalizeAnalysisLanguage(value: unknown): 'Thai' | 'English' | null {
  if (value === undefined || value === null || value === '') return 'English';
  return typeof value === 'string' && ANALYSIS_LANGUAGES.has(value)
    ? value as 'Thai' | 'English'
    : null;
}

export function normalizeOptionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return undefined;
  return text.length <= maxLength ? text : null;
}

export function normalizeBoolean(value: unknown, fallback: boolean): boolean | null {
  if (value === undefined || value === null) return fallback;
  return typeof value === 'boolean' ? value : null;
}

export function safeArtifactFilename(value: unknown, fallback = 'podcast_briefing.wav'): string | null {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return null;
  const name = value.trim();
  if (!SAFE_FILE_PATTERN.test(name)) return null;
  if (name === '.' || name === '..' || name.startsWith('.')) return null;
  return name;
}

export function isBoundedArray(value: unknown, maxItems: number): boolean {
  return Array.isArray(value) && value.length <= maxItems;
}
