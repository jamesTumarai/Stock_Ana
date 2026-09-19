/**
 * Semantic Subject Normalization & Lifecycle Reconciliation Engine
 *
 * Provides stable semantic identity for tracked risks, catalysts, lifecycle items,
 * and research subjects across paraphrases, preventing contradictory lifecycle states
 * and duplicate count inflation across all sectors.
 */

export interface SemanticChangeSubject {
  subjectKey: string;
  subjectType: 'risk' | 'catalyst' | 'lifecycle' | 'expectation' | 'other';
  normalizedEntity: string;
  normalizedTopic: string;
  normalizedEventType?: string;
  businessContext?: string;
  period?: string;
  rawText: string;
}

export type ReconciledLifecycleState =
  | 'CONTINUED_UNCHANGED'
  | 'CONTINUED_PARAPHRASED'
  | 'NEWLY_TRACKED'
  | 'OMITTED_FROM_CURRENT_RESEARCH';

export interface ReconciledSubjectTransition {
  subject: SemanticChangeSubject;
  lifecycleState: ReconciledLifecycleState;
  previousText: string | null;
  currentText: string | null;
  isCertain: boolean;
}

export const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'up', 'about', 'into', 'over', 'after', 'is', 'are', 'was',
  'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'but', 'if', 'then', 'else', 'when', 'where', 'why', 'how', 'all', 'any',
  'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will',
  'just', 'should', 'now', 'could', 'may', 'might', 'risk', 'risks', 'catalyst',
  'catalysts', 'factor', 'factors', 'potential', 'possible', 'key', 'impact'
]);

export const STEM_WORDS = (w: string) => {
  if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('er') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  return w;
};

export function getSignificantStems(text: string): Set<string> {
  const rawWords = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  return new Set(rawWords.map(STEM_WORDS));
}

// Known entities across sectors (financial, tech, industrial, regulatory, macro)
const KNOWN_ENTITIES: Array<{ entity: string; patterns: RegExp[] }> = [
  {
    entity: 'citizens_bank',
    patterns: [/\bcitizens\s+bank\b/i, /\bcitizens\s+financial\b/i, /\bcitizens\b/i]
  },
  {
    entity: 'jpmorgan',
    patterns: [/\bjpmorgan\b/i, /\bchase\b/i, /\bjpm\b/i]
  },
  {
    entity: 'bank_of_america',
    patterns: [/\bbank\s+of\s+america\b/i, /\bbofa\b/i]
  },
  {
    entity: 'wells_fargo',
    patterns: [/\bwells\s+fargo\b/i]
  },
  {
    entity: 'goldman_sachs',
    patterns: [/\bgoldman\s+sachs\b/i, /\bgoldman\b/i]
  },
  {
    entity: 'morgan_stanley',
    patterns: [/\bmorgan\s+stanley\b/i]
  },
  {
    entity: 'apple',
    patterns: [/\bapple\b/i, /\baapl\b/i]
  },
  {
    entity: 'microsoft',
    patterns: [/\bmicrosoft\b/i, /\bazure\b/i, /\bmsft\b/i]
  },
  {
    entity: 'google',
    patterns: [/\bgoogle\b/i, /\balphabet\b/i, /\bgcp\b/i]
  },
  {
    entity: 'amazon',
    patterns: [/\bamazon\b/i, /\baws\b/i]
  },
  {
    entity: 'nvidia',
    patterns: [/\bnvidia\b/i, /\bnvda\b/i]
  },
  {
    entity: 'meta',
    patterns: [/\bmeta\b/i, /\bfacebook\b/i]
  },
  {
    entity: 'fda',
    patterns: [/\bfda\b/i, /\bfood\s+and\s+drug\s+administration\b/i]
  },
  {
    entity: 'sec',
    patterns: [/\bsec\b/i, /\bsecurities\s+and\s+exchange\s+commission\b/i]
  },
  {
    entity: 'doj',
    patterns: [/\bdoj\b/i, /\bdepartment\s+of\s+justice\b/i]
  },
  {
    entity: 'ftc',
    patterns: [/\bftc\b/i, /\bfederal\s+trade\s+commission\b/i]
  },
  // Generic entity types
  {
    entity: 'traditional_banks',
    patterns: [
      /\btraditional\s+banks?\b/i,
      /\bincumbent\s+banks?\b/i,
      /\blarge\s+banks?\b/i,
      /\bbanking\s+incumbents?\b/i,
      /\bcommercial\s+banks?\b/i
    ]
  },
  {
    entity: 'cloud_providers',
    patterns: [
      /\bhyperscalers?\b/i,
      /\bcloud\b/i,
      /\bcloud\s+platforms?\b/i,
      /\bcloud\s+providers?\b/i,
      /\bcloud\s+infrastructure\b/i
    ]
  },
  {
    entity: 'macroeconomy',
    patterns: [
      /\bmacroeconom(?:ic|y)\b/i,
      /\bmacro\b/i,
      /\beconom(?:ic|y)\b/i,
      /\bgdp\b/i,
      /\binflation\b/i,
      /\binterest\s+rates?\b/i
    ]
  }
];

// Topic / event normalizations across sectors
const KNOWN_TOPICS: Array<{ topic: string; patterns: RegExp[] }> = [
  {
    topic: 'recession',
    patterns: [
      /\brecession\b/i,
      /\beconomic\s+slowdown\b/i,
      /\bmacro(?:economic)?\s+slowdown\b/i,
      /\bdownturn\b/i,
      /\bstagflation\b/i,
      /\bborrower\s+stress\b/i,
      /\bborrower\s+quality\b/i
    ]
  },
  {
    topic: 'slowdown',
    patterns: [
      /\bslowdown\b/i,
      /\bslower\b/i,
      /\bdemand\s+slowdown\b/i,
      /\bspending\s+slowdown\b/i,
      /\benterprise\s+(?:cloud\s+)?spending\b/i,
      /\bcloud\s+spending\b/i,
      /\bcloud\s+demand\b/i
    ]
  },
  {
    topic: 'competition',
    patterns: [
      /\bcompet(?:ition|itive|itor|itors|ing)\b/i,
      /\bmarket\s+share\s+loss\b/i,
      /\bpricing\s+pressure\b/i,
      /\bcompetitive\s+pressure\b/i,
      /\brivals?\b/i,
      /\bslow\s+growth\b/i
    ]
  },
  {
    topic: 'partnership',
    patterns: [
      /\bpartner(?:ship|ships|ing|s)?\b/i,
      /\bcollab(?:oration|orate|orating)\b/i,
      /\balliance\b/i,
      /\bcooperat(?:ion|ing|e)\b/i,
      /\bjoint\s+venture\b/i,
      /\bdistribution\s+agreement\b/i,
      /\bbroaden\s+distribution\b/i,
      /\bcustomer\s+acquisition\b/i
    ]
  },
  {
    topic: 'credit_quality',
    patterns: [
      /\bcredit\s+(?:quality|deterioration|risk|exposure|losses)\b/i,
      /\bdelinquenc(?:y|ies)\b/i,
      /\bdefaults?\b/i,
      /\bcharge[\s-]offs?\b/i,
      /\bnco\b/i,
      /\bnon[\s-]performing\b/i,
      /\bhigher\s+delinquencies\b/i
    ]
  },
  {
    topic: 'refinancing',
    patterns: [
      /\brefinanc(?:ing|e)\b/i,
      /\bdebt\s+maturity\b/i,
      /\bdebt\s+refinancing\b/i,
      /\bborrowing\s+costs?\b/i,
      /\brate\s+reset\b/i,
      /\binterest\s+expense\b/i,
      /\brefinancing\s+costs?\b/i
    ]
  },
  {
    topic: 'regulatory',
    patterns: [
      /\bantitrust\b/i,
      /\bregulat(?:ion|ory|or|ors)\b/i,
      /\bfda\s+approval\b/i,
      /\binvestigat(?:ion|ing)\b/i,
      /\bcomplian(?:ce|t)\b/i,
      /\bfines?\b/i,
      /\bsanctions?\b/i,
      /\blawsuits?\b/i,
      /\blitigat(?:ion|e)\b/i
    ]
  },
  {
    topic: 'capex',
    patterns: [
      /\bcapex\b/i,
      /\bcapital\s+expenditure\b/i,
      /\binfrastructure\s+capex\b/i,
      /\bdatacenter\s+spend(?:ing)?\b/i,
      /\bhardware\s+capex\b/i,
      /\bbuildout\b/i
    ]
  },
  {
    topic: 'deposit',
    patterns: [
      /\bdeposits?\b/i,
      /\bdeposit\s+outflow\b/i,
      /\bdeposit\s+beta\b/i,
      /\bcost\s+of\s+deposits?\b/i,
      /\bdeposit\s+growth\b/i
    ]
  },
  {
    topic: 'capital_raise',
    patterns: [
      /\bcapital\s+raise\b/i,
      /\bequity\s+offering\b/i,
      /\bdilution\b/i,
      /\bsecondary\s+offering\b/i,
      /\bdebt\s+issuance\b/i,
      /\bshare\s+issuance\b/i
    ]
  },
  {
    topic: 'acquisition',
    patterns: [
      /\bacquisition\b/i,
      /\bmerger\b/i,
      /\btakeover\b/i,
      /\bbuyout\b/i,
      /\bm&a\b/i
    ]
  },
  {
    topic: 'commodity_price',
    patterns: [
      /\boil\s+prices?\b/i,
      /\boil\s+price\b/i,
      /\bcrude\s+prices?\b/i,
      /\bcommodity\s+prices?\b/i,
      /\bgas\s+prices?\b/i,
      /\blower\s+crude\b/i,
      /\bcrude\b/i
    ]
  },
  {
    topic: 'production_volume',
    patterns: [
      /\bproduction\s+volume\b/i,
      /\boutput\s+volume\b/i,
      /\bcapacity\s+utilization\b/i,
      /\bproduction\s+slowdown\b/i
    ]
  },
  {
    topic: 'earnings',
    patterns: [
      /\bearnings\s+(?:release|report|announcement|results|call)\b/i,
      /\bquarterly\s+results\b/i,
      /\bfinancial\s+results\b/i,
      /\bearnings\b/i
    ]
  },
  {
    topic: 'cybersecurity',
    patterns: [
      /\bcybersecurity\b/i,
      /\bdata\s+breach\b/i,
      /\bransomware\b/i,
      /\bcyber\s+attacks?\b/i,
      /\bsecurity\s+breach\b/i
    ]
  },
  {
    topic: 'occupancy',
    patterns: [
      /\boccupancy\b/i,
      /\btenant\s+vacanc(?:y|ies)\b/i,
      /\blease\s+renewal\b/i,
      /\btenant\s+defaults?\b/i
    ]
  }
];

const PERIOD_PATTERNS = [
  /\b(q[1-4])\b/i,
  /\b(fy\d{2,4})\b/i,
  /\b(20\d{2})\b/i
];

/**
 * Deterministically extracts entity, topic, and period from item text.
 */
export function normalizeResearchSubject(
  text: string,
  type: 'risk' | 'catalyst' | 'lifecycle' | 'expectation' | 'other' = 'risk'
): SemanticChangeSubject {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // 1. Extract Entity
  let normalizedEntity = 'general';
  for (const ke of KNOWN_ENTITIES) {
    if (ke.patterns.some(p => p.test(lower))) {
      normalizedEntity = ke.entity;
      break;
    }
  }

  // 2. Extract Topic
  let normalizedTopic = '';
  for (const kt of KNOWN_TOPICS) {
    if (kt.patterns.some(p => p.test(lower))) {
      normalizedTopic = kt.topic;
      break;
    }
  }

  // If no predefined topic matches, derive a normalized stem-based topic
  if (!normalizedTopic) {
    const rawWords = lower
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0 && !STOP_WORDS.has(w));
    const stems = Array.from(new Set(rawWords.map(STEM_WORDS))).sort();
    normalizedTopic = stems.slice(0, 3).join('_') || lower.replace(/[^a-z0-9]/g, '_') || 'unspecified';
  }

  // 3. Extract Period
  let period: string | undefined;
  for (const pp of PERIOD_PATTERNS) {
    const m = lower.match(pp);
    if (m) {
      period = m[1].toLowerCase();
      break;
    }
  }

  // 4. Construct Subject Key: type:entity:topic:period
  const subjectKey = `${type}:${normalizedEntity}:${normalizedTopic}:${period || 'any'}`.toLowerCase();

  return {
    subjectKey,
    subjectType: type,
    normalizedEntity,
    normalizedTopic,
    period,
    rawText: trimmed
  };
}

/**
 * Reconciles prior and current research subjects to produce deterministic, non-contradictory lifecycle states.
 * Guarantees that the same semantic subject never produces contradictory states (e.g. newly introduced AND omitted).
 */
export function reconcileSubjectLifecycles(
  previousTexts: string[],
  currentTexts: string[],
  type: 'risk' | 'catalyst'
): ReconciledSubjectTransition[] {
  // 1. Deduplicate within prior and current sets based on subjectKey
  const prevSubjs: SemanticChangeSubject[] = [];
  const seenPrevKeys = new Set<string>();
  for (const text of previousTexts) {
    if (!text || !text.trim()) continue;
    const subj = normalizeResearchSubject(text, type);
    if (!seenPrevKeys.has(subj.subjectKey)) {
      seenPrevKeys.add(subj.subjectKey);
      prevSubjs.push(subj);
    }
  }

  const currSubjs: SemanticChangeSubject[] = [];
  const seenCurrKeys = new Set<string>();
  for (const text of currentTexts) {
    if (!text || !text.trim()) continue;
    const subj = normalizeResearchSubject(text, type);
    if (!seenCurrKeys.has(subj.subjectKey)) {
      seenCurrKeys.add(subj.subjectKey);
      currSubjs.push(subj);
    }
  }

  const matchedPrevIndices = new Set<number>();
  const matchedCurrIndices = new Set<number>();
  const transitions: ReconciledSubjectTransition[] = [];

  // Pass 1: Exact matches
  for (let cIdx = 0; cIdx < currSubjs.length; cIdx++) {
    const curr = currSubjs[cIdx];
    const cleanCurr = curr.rawText.trim().toLowerCase();
    for (let pIdx = 0; pIdx < prevSubjs.length; pIdx++) {
      if (matchedPrevIndices.has(pIdx)) continue;
      const prev = prevSubjs[pIdx];
      if (prev.rawText.trim().toLowerCase() === cleanCurr) {
        matchedPrevIndices.add(pIdx);
        matchedCurrIndices.add(cIdx);
        transitions.push({
          subject: curr,
          lifecycleState: 'CONTINUED_UNCHANGED',
          previousText: prev.rawText,
          currentText: curr.rawText,
          isCertain: true
        });
        break;
      }
    }
  }

  // Pass 2: Subject Key matches
  for (let cIdx = 0; cIdx < currSubjs.length; cIdx++) {
    if (matchedCurrIndices.has(cIdx)) continue;
    const curr = currSubjs[cIdx];
    for (let pIdx = 0; pIdx < prevSubjs.length; pIdx++) {
      if (matchedPrevIndices.has(pIdx)) continue;
      const prev = prevSubjs[pIdx];
      if (prev.subjectKey === curr.subjectKey) {
        matchedPrevIndices.add(pIdx);
        matchedCurrIndices.add(cIdx);
        transitions.push({
          subject: curr,
          lifecycleState: 'CONTINUED_PARAPHRASED',
          previousText: prev.rawText,
          currentText: curr.rawText,
          isCertain: false
        });
        break;
      }
    }
  }

  // Pass 3: High-confidence semantic overlap (substring or stem overlap) with over-merge safeguards
  for (let cIdx = 0; cIdx < currSubjs.length; cIdx++) {
    if (matchedCurrIndices.has(cIdx)) continue;
    const curr = currSubjs[cIdx];
    const cleanCurr = curr.rawText.trim().toLowerCase();

    for (let pIdx = 0; pIdx < prevSubjs.length; pIdx++) {
      if (matchedPrevIndices.has(pIdx)) continue;
      const prev = prevSubjs[pIdx];
      const cleanPrev = prev.rawText.trim().toLowerCase();

      // SAFEGUARD: If both have distinct defined topics (e.g. partnership vs competition), NEVER merge!
      if (
        prev.normalizedTopic &&
        curr.normalizedTopic &&
        prev.normalizedTopic !== curr.normalizedTopic &&
        prev.normalizedTopic !== 'unspecified' &&
        curr.normalizedTopic !== 'unspecified'
      ) {
        continue;
      }

      // SAFEGUARD: If periods are specified and different (e.g. Q1 vs Q4), NEVER merge!
      if (prev.period && curr.period && prev.period !== curr.period) {
        continue;
      }

      // Check substring match
      const isSubstring = cleanCurr.includes(cleanPrev) || cleanPrev.includes(cleanCurr);

      // Check stem overlap
      const stemsPrev = getSignificantStems(prev.rawText);
      const stemsCurr = getSignificantStems(curr.rawText);
      let sharedStems = 0;
      for (const sp of stemsPrev) {
        for (const sc of stemsCurr) {
          if (sp === sc || (sp.length >= 4 && sc.length >= 4 && (sp.startsWith(sc) || sc.startsWith(sp)))) {
            sharedStems++;
            break;
          }
        }
      }

      if (isSubstring || sharedStems > 0) {
        matchedPrevIndices.add(pIdx);
        matchedCurrIndices.add(cIdx);
        transitions.push({
          subject: curr,
          lifecycleState: 'CONTINUED_PARAPHRASED',
          previousText: prev.rawText,
          currentText: curr.rawText,
          isCertain: false
        });
        break;
      }
    }
  }

  // Pass 4: Unmatched current items -> NEWLY_TRACKED
  for (let cIdx = 0; cIdx < currSubjs.length; cIdx++) {
    if (matchedCurrIndices.has(cIdx)) continue;
    transitions.push({
      subject: currSubjs[cIdx],
      lifecycleState: 'NEWLY_TRACKED',
      previousText: null,
      currentText: currSubjs[cIdx].rawText,
      isCertain: false
    });
  }

  // Pass 5: Unmatched previous items -> OMITTED_FROM_CURRENT_RESEARCH
  for (let pIdx = 0; pIdx < prevSubjs.length; pIdx++) {
    if (matchedPrevIndices.has(pIdx)) continue;
    transitions.push({
      subject: prevSubjs[pIdx],
      lifecycleState: 'OMITTED_FROM_CURRENT_RESEARCH',
      previousText: prevSubjs[pIdx].rawText,
      currentText: null,
      isCertain: false
    });
  }

  return transitions;
}
