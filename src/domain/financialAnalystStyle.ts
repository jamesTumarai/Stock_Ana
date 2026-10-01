import type { MetricInterpretationContext } from './financialMetricContext';
import type { SelectedFinancialMetric } from './selectedFinancialMetric';

/** Remove only an obvious leading textbook definition. Called AFTER full
 * numeric/schema validation so trimming can never hide an invented figure. */
export function companyFirstSynthesis(text: string, selected: SelectedFinancialMetric, context: MetricInterpretationContext): string {
  const paragraphs = text.trim().split(/\n\s*\n/);
  const first = paragraphs[0];
  const thaiName = selected.definition?.meaning?.education?.definition.th.split('คือ')[0].trim();
  const names = [selected.definition?.meaning?.name, context.metricName, context.metricNameTh, thaiName]
    .filter((name): name is string => !!name && name.length < 100);
  const escape = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[_\s]+/g, '\\s+');
  const intro = new RegExp(`^(?:${names.map(escape).join('|')})\\s*(?:คือ|หมายถึง|means\\b|measures\\b|refers to\\b|is defined as\\b|is (?:the |a |an )?(?:ratio|share|sales|recognized sales|profit|cash|amount|value|percentage|proportion|return|time|book value)\\b)`, 'i');
  if (!intro.test(first)) return text;
  const condition = /(?:ในงวดล่าสุด|ค่าปัจจุบัน|ข้อมูลล่าสุด|จากข้อมูลที่ตรวจสอบ|งวดล่าสุด|(?:in )?the latest (?:period|quarter|observation)|the current (?:value|observation)|currently)/i.exec(first);
  const remainder = condition ? [first.slice(condition.index), ...paragraphs.slice(1)] : paragraphs.slice(1);
  return remainder.join('\n\n').trim();
}
