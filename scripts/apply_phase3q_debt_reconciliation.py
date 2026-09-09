from pathlib import Path

resolver_path = Path('src/services/sec/secDebtResolver.ts')
test_path = Path('src/services/sec/secDebtResolver.test.ts')

resolver = resolver_path.read_text()

old_doc = """ * 3. A reconciled commercial-paper family only when all of the following are true for the same instant:\n *    - `LongTermDebtCurrent + LongTermDebtNoncurrent` exactly reconciles to `LongTermDebt`,\n *    - `CommercialPaper` is separately reported,\n *    - no same-period `ShortTermBorrowings` fact exists that could overlap with commercial paper,\n *    - no same-period finance-lease liability facts exist that would make this borrowing-only family incomplete.\n *\n * Missing facts are never treated as zero. If a family is incomplete or ambiguous, total debt stays null.\n"""
new_doc = """ * 3. A reconciled long-term debt family when `LongTermDebtCurrent + LongTermDebtNoncurrent`\n *    exactly reconciles to `LongTermDebt` for the same instant. If same-period `CommercialPaper` is\n *    separately reported, it is added once; stale historical commercial-paper facts are never carried forward.\n *    A same-period `ShortTermBorrowings` fact or finance-lease liability keeps the family fail-closed because\n *    it could make the borrowing-only total incomplete or overlapping.\n *\n * Missing facts are never converted to zero, stale debt is never carried into a newer balance sheet, and\n * overlapping aliases are never summed. If a current-period family is internally inconsistent, total debt stays null.\n"""
if old_doc not in resolver:
    raise SystemExit('Phase 3Q doc anchor not found')
resolver = resolver.replace(old_doc, new_doc, 1)

old_block = """    const commercialPaperFamilySafe = reconciledLongTermDebt\n      && paper\n      && finite(paper.value)\n      && samePeriodEnd(ltCurrent, ltNoncurrent, ltAggregate, paper)\n      && !(overlappingShortTerm && finite(overlappingShortTerm.value) && overlappingShortTerm.end === paper.end)\n      && !(separateLeaseCurrent && finite(separateLeaseCurrent.value) && separateLeaseCurrent.end === paper.end)\n      && !(separateLeaseNoncurrent && finite(separateLeaseNoncurrent.value) && separateLeaseNoncurrent.end === paper.end);\n\n    if (commercialPaperFamilySafe && ltAggregate && paper && ltCurrent && ltNoncurrent) {\n      const accessions = Array.from(new Set([\n        ...ltCurrent.accessionNumbers,\n        ...ltNoncurrent.accessionNumbers,\n        ...ltAggregate.accessionNumbers,\n        ...paper.accessionNumbers,\n      ]));\n      return {\n        metric: 'total_debt',\n        statement: 'balance_sheet',\n        value: round((ltAggregate.value + paper.value) / 1_000_000),\n        unit: 'USD_M',\n        period,\n        periodEnd: paper.end,\n        type: 'derived',\n        verification: 'verified',\n        source: sourceForFact(bundle, ltAggregate, RECONCILED_COMMERCIAL_PAPER_FAMILY.longTermAggregate),\n        derivation: `Deterministic SEC total debt = reconciled us-gaap:${RECONCILED_COMMERCIAL_PAPER_FAMILY.longTermAggregate} + separately reported us-gaap:${RECONCILED_COMMERCIAL_PAPER_FAMILY.commercialPaper}. LongTermDebt was verified to equal LongTermDebtCurrent + LongTermDebtNoncurrent for the same instant; accessions: ${accessions.join(', ')}. No same-period ShortTermBorrowings or finance-lease liability fact was present.`,\n      };\n    }\n"""

new_block = """    const familyEnd = ltAggregate?.end;\n    const samePeriodShortTerm = Boolean(\n      familyEnd\n      && overlappingShortTerm\n      && finite(overlappingShortTerm.value)\n      && overlappingShortTerm.end === familyEnd\n    );\n    const samePeriodLease = Boolean(\n      familyEnd\n      && ((separateLeaseCurrent && finite(separateLeaseCurrent.value) && separateLeaseCurrent.end === familyEnd)\n        || (separateLeaseNoncurrent && finite(separateLeaseNoncurrent.value) && separateLeaseNoncurrent.end === familyEnd))\n    );\n    const samePeriodPaper = Boolean(\n      reconciledLongTermDebt\n      && ltAggregate\n      && paper\n      && finite(paper.value)\n      && samePeriodEnd(ltCurrent, ltNoncurrent, ltAggregate, paper)\n    );\n    const mismatchedPaperForFiscalQuarter = Boolean(\n      reconciledLongTermDebt\n      && paper\n      && finite(paper.value)\n      && ltAggregate\n      && paper.end !== ltAggregate.end\n    );\n\n    // A reconciled current/non-current long-term debt family is already a complete authoritative\n    // long-term borrowing amount for the instant. Commercial paper is added only when SEC reports\n    // it for that exact same instant. Historical paper is not carried forward and is not treated as zero.\n    if (\n      reconciledLongTermDebt\n      && ltAggregate\n      && ltCurrent\n      && ltNoncurrent\n      && !samePeriodShortTerm\n      && !samePeriodLease\n      && !mismatchedPaperForFiscalQuarter\n    ) {\n      const paperFact = samePeriodPaper && paper ? paper : undefined;\n      const accessions = Array.from(new Set([\n        ...ltCurrent.accessionNumbers,\n        ...ltNoncurrent.accessionNumbers,\n        ...ltAggregate.accessionNumbers,\n        ...(paperFact?.accessionNumbers ?? []),\n      ]));\n      const totalValue = ltAggregate.value + (paperFact?.value ?? 0);\n      const paperNote = paperFact\n        ? ` + separately reported us-gaap:${RECONCILED_COMMERCIAL_PAPER_FAMILY.commercialPaper}`\n        : '';\n      const absenceNote = paperFact\n        ? 'CommercialPaper was reported for the same instant and added exactly once.'\n        : 'No CommercialPaper fact was reported for this fiscal-quarter instant; no stale short-term debt was carried forward.';\n      return {\n        metric: 'total_debt',\n        statement: 'balance_sheet',\n        value: round(totalValue / 1_000_000),\n        unit: 'USD_M',\n        period,\n        periodEnd: ltAggregate.end,\n        type: 'derived',\n        verification: 'verified',\n        source: sourceForFact(bundle, ltAggregate, RECONCILED_COMMERCIAL_PAPER_FAMILY.longTermAggregate),\n        derivation: `Deterministic SEC total debt = reconciled us-gaap:${RECONCILED_COMMERCIAL_PAPER_FAMILY.longTermAggregate}${paperNote}. LongTermDebt was verified to equal LongTermDebtCurrent + LongTermDebtNoncurrent for the same instant; accessions: ${accessions.join(', ')}. ${absenceNote} No same-period ShortTermBorrowings or finance-lease liability fact was present.`,\n      };\n    }\n"""

if old_block not in resolver:
    raise SystemExit('Phase 3Q resolver anchor not found')
resolver = resolver.replace(old_block, new_block, 1)
resolver_path.write_text(resolver)

tests = test_path.read_text()
anchor = "console.log('SEC total debt resolution checks passed');\n"
if anchor not in tests:
    raise SystemExit('Phase 3Q test anchor not found')

new_tests = r"""
{
  // MSFT-like shape: the current and non-current portions reconcile to LongTermDebt,
  // while older short-term borrowing / commercial-paper facts must not be carried forward.
  const resolved = attachVerifiedTotalDebtFromSec(baseDataset(), bundle({
    LongTermDebtCurrent: unit(four([10_000_000, 10_000_000, 9_500_000, 9_227_000_000], 'msft-ltc')),
    LongTermDebtNoncurrent: unit(four([40_000_000, 38_000_000, 35_000_000, 31_067_000_000], 'msft-ltnc')),
    LongTermDebt: unit(four([50_000_000, 48_000_000, 44_500_000, 40_294_000_000], 'msft-lta')),
    ShortTermBorrowings: unit([fact(2018, 'FY', 4_000_000_000, 'stale-stb')]),
    CommercialPaper: unit([fact(2025, 'FY', 6_000_000_000, 'stale-cp')]),
  }));
  const total = resolved.values['balance_sheet.total_debt'];
  assert.equal(total[3].value, 40294);
  assert.equal(total[3].verification, 'verified');
  assert.match(total[3].derivation || '', /no stale short-term debt was carried forward/i);
  assert.doesNotMatch(total[3].derivation || '', /\+ separately reported us-gaap:CommercialPaper/);
}

{
  // AAPL-like shape: current + non-current term debt reconcile to the aggregate and
  // same-period commercial paper is a separate current liability, so it is added once.
  const resolved = attachVerifiedTotalDebtFromSec(baseDataset(), bundle({
    LongTermDebtCurrent: unit(four([11_000_000_000, 11_100_000_000, 11_007_000_000, 11_007_000_000], 'aapl-ltc')),
    LongTermDebtNoncurrent: unit(four([75_000_000_000, 73_000_000_000, 71_340_000_000, 71_340_000_000], 'aapl-ltnc')),
    LongTermDebt: unit(four([86_000_000_000, 84_100_000_000, 82_347_000_000, 82_347_000_000], 'aapl-lta')),
    CommercialPaper: unit(four([4_000_000_000, 3_000_000_000, 1_997_000_000, 1_997_000_000], 'aapl-cp')),
    // A stale prior-year lease fact must not poison the current-period borrowing family.
    FinanceLeaseLiabilityCurrent: unit([fact(2025, 'FY', 1_000_000_000, 'stale-lease')]),
  }));
  const total = resolved.values['balance_sheet.total_debt'];
  assert.equal(total[3].value, 84344);
  assert.equal(total[3].verification, 'verified');
  assert.match(total[3].derivation || '', /CommercialPaper was reported for the same instant and added exactly once/);
}

"""
tests = tests.replace(anchor, new_tests + anchor, 1)
test_path.write_text(tests)
