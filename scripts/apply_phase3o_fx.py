from pathlib import Path

# ReportTemplate: fetch provider-backed USD/THB snapshot and fail closed when unavailable.
path = Path('src/ReportTemplate.tsx')
text = path.read_text()

market_import = "import { fetchLiveQuotes } from './services/marketDataService';\n"
fx_imports = "import { fetchUsdThbFxSnapshot } from './services/fxDataService';\nimport type { FxSnapshot } from './domain/fxSnapshot';\n"
if "fetchUsdThbFxSnapshot" not in text:
    if text.count(market_import) != 1:
        raise SystemExit('ReportTemplate market import anchor mismatch')
    text = text.replace(market_import, market_import + fx_imports, 1)

state_anchor = "  const [refreshSuccessMessage, setRefreshSuccessMessage] = useState<string | null>(null);\n"
state_replacement = state_anchor + "  const [fxSnapshot, setFxSnapshot] = useState<FxSnapshot | null>(null);\n  const [isLoadingFx, setIsLoadingFx] = useState(false);\n"
if "const [fxSnapshot, setFxSnapshot]" not in text:
    if text.count(state_anchor) != 1:
        raise SystemExit('ReportTemplate FX state anchor mismatch')
    text = text.replace(state_anchor, state_replacement, 1)

refresh_anchor = "  const handleRefreshLiveQuotes = async (isManual: boolean | React.MouseEvent = true) => {\n"
fx_effect = """  useEffect(() => {
    let cancelled = false;
    setIsLoadingFx(true);
    fetchUsdThbFxSnapshot()
      .then((snapshot) => {
        if (!cancelled) setFxSnapshot(snapshot);
      })
      .catch((error) => {
        console.warn('[ReportTemplate] USD/THB FX snapshot unavailable:', error);
        if (!cancelled) setFxSnapshot(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingFx(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

"""
if "[ReportTemplate] USD/THB FX snapshot unavailable" not in text:
    if text.count(refresh_anchor) != 1:
        raise SystemExit('ReportTemplate refresh anchor mismatch')
    text = text.replace(refresh_anchor, fx_effect + refresh_anchor, 1)

rate_old = "  // Default USD to THB rate\n  const currencyRate = 35.5; // Indicative only; never label this as a live FX rate.\n"
rate_new = "  const currencyRate = fxSnapshot?.rate;\n  const hasUsdThbRate = typeof currencyRate === 'number' && Number.isFinite(currencyRate) && currencyRate > 0;\n"
if rate_old in text:
    text = text.replace(rate_old, rate_new, 1)
elif "const hasUsdThbRate" not in text:
    raise SystemExit('ReportTemplate hardcoded FX anchor mismatch')

format_old = """    if (currencyMode === 'THB') {
      return `฿${(num * currencyRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
"""
format_new = """    if (currencyMode === 'THB') {
      if (!hasUsdThbRate || currencyRate === undefined) return isThai ? 'FX ไม่พร้อมใช้งาน' : 'FX unavailable';
      return `฿${(num * currencyRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
"""
if format_old in text:
    text = text.replace(format_old, format_new, 1)
elif "FX ไม่พร้อมใช้งาน" not in text:
    raise SystemExit('ReportTemplate formatPrice FX anchor mismatch')

buttons_old = """                <button type="button" onClick={() => setCurrencyMode('USD')} className={`px-2.5 py-0.5 rounded-full font-bold transition-all ${currencyMode === 'USD' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'}`}>USD ($)</button>
                <button type="button" onClick={() => setCurrencyMode('THB')} className={`px-2.5 py-0.5 rounded-full font-bold transition-all ${currencyMode === 'THB' ? 'bg-[#0b5a4b] text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'}`}>THB (฿)</button>
              </div>
"""
buttons_new = """                <button type="button" onClick={() => setCurrencyMode('USD')} className={`px-2.5 py-0.5 rounded-full font-bold transition-all ${currencyMode === 'USD' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'}`}>USD ($)</button>
                <button
                  type="button"
                  onClick={() => hasUsdThbRate && setCurrencyMode('THB')}
                  disabled={!hasUsdThbRate}
                  title={!hasUsdThbRate ? (isLoadingFx ? (isThai ? 'กำลังโหลด USD/THB...' : 'Loading USD/THB...') : (isThai ? 'USD/THB ไม่พร้อมใช้งาน' : 'USD/THB unavailable')) : undefined}
                  className={`px-2.5 py-0.5 rounded-full font-bold transition-all ${currencyMode === 'THB' ? 'bg-[#0b5a4b] text-white shadow-xs' : hasUsdThbRate ? 'text-stone-600 hover:text-stone-900' : 'text-stone-400 cursor-not-allowed opacity-60'}`}
                >
                  THB (฿)
                </button>
              </div>
              {(fxSnapshot || isLoadingFx) && (
                <span className="hidden lg:inline text-[9px] font-mono text-stone-500 bg-white/70 border border-stone-200 rounded-full px-2 py-0.5" title={isThai ? 'อัตราแปลงเพื่อการแสดงผล ไม่รับประกัน real-time' : 'Display conversion snapshot; not guaranteed real-time'}>
                  {fxSnapshot
                    ? `USD/THB ${fxSnapshot.rate.toFixed(3)} • ${fxSnapshot.provider || 'Provider'} • snapshot`
                    : (isThai ? 'กำลังโหลด USD/THB...' : 'Loading USD/THB...')}
                </span>
              )}
"""
if buttons_old in text:
    text = text.replace(buttons_old, buttons_new, 1)
elif "USD/THB ${fxSnapshot.rate.toFixed(3)}" not in text:
    raise SystemExit('ReportTemplate currency toggle anchor mismatch')

path.write_text(text)

# Financial statements: remove implicit FX default and fail closed if THB rate is absent.
path = Path('src/components/FinancialStatementsTable.tsx')
text = path.read_text()
text = text.replace("  currencyRate = 35.5,\n", "  currencyRate,\n", 1)
mult_old = "  const currSym = currencyMode === 'THB' ? '฿' : '$';\n  const multiplier = currencyMode === 'THB' ? currencyRate : 1;\n"
mult_new = "  const currSym = currencyMode === 'THB' ? '฿' : '$';\n  const hasFxRate = typeof currencyRate === 'number' && Number.isFinite(currencyRate) && currencyRate > 0;\n  const multiplier = currencyMode === 'THB' && hasFxRate ? currencyRate : 1;\n"
if mult_old in text:
    text = text.replace(mult_old, mult_new, 1)
elif "const hasFxRate" not in text:
    raise SystemExit('FinancialStatementsTable multiplier anchor mismatch')
format_anchor = """    if (rawVal === null || rawVal === undefined) return '-';
    if (!isCurrency) return rawVal.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

    const val = (normalizeToMillions(rawVal) ?? 0);
"""
format_replacement = """    if (rawVal === null || rawVal === undefined) return '-';
    if (!isCurrency) return rawVal.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    if (currencyMode === 'THB' && !hasFxRate) return isThai ? 'FX ไม่พร้อม' : 'FX N/A';

    const val = (normalizeToMillions(rawVal) ?? 0);
"""
if "FX ไม่พร้อม' : 'FX N/A'" not in text:
    if text.count(format_anchor) != 1:
        raise SystemExit('FinancialStatementsTable format anchor mismatch')
    text = text.replace(format_anchor, format_replacement, 1)
path.write_text(text)

# Intrinsic value: remove implicit FX default and fail closed on missing display rate.
path = Path('src/components/IntrinsicValueEngine.tsx')
text = path.read_text()
text = text.replace("  currencyRate = 35.5\n", "  currencyRate\n", 1)
mult_old = "  const currSym = currencyMode === 'THB' ? '฿' : '$';\n  const multiplier = currencyMode === 'THB' ? currencyRate : 1;\n\n  const formatPrice"
mult_new = "  const currSym = currencyMode === 'THB' ? '฿' : '$';\n  const hasFxRate = typeof currencyRate === 'number' && Number.isFinite(currencyRate) && currencyRate > 0;\n  const multiplier = currencyMode === 'THB' && hasFxRate ? currencyRate : 1;\n\n  const formatPrice"
if mult_old in text:
    text = text.replace(mult_old, mult_new, 1)
elif "const hasFxRate" not in text:
    raise SystemExit('IntrinsicValueEngine multiplier anchor mismatch')
format_old = """  const formatPrice = (val: number | null | undefined): string => {
    if (val === null || val === undefined || !Number.isFinite(val)) return isThai ? 'ไม่มีข้อมูล (Data unavailable)' : 'Data unavailable';
    return `${currSym}${(val * multiplier).toFixed(2)}`;
  };
"""
format_new = """  const formatPrice = (val: number | null | undefined): string => {
    if (val === null || val === undefined || !Number.isFinite(val)) return isThai ? 'ไม่มีข้อมูล (Data unavailable)' : 'Data unavailable';
    if (currencyMode === 'THB' && !hasFxRate) return isThai ? 'FX ไม่พร้อมใช้งาน' : 'FX unavailable';
    return `${currSym}${(val * multiplier).toFixed(2)}`;
  };
"""
if format_old in text:
    text = text.replace(format_old, format_new, 1)
elif "currencyMode === 'THB' && !hasFxRate" not in text:
    raise SystemExit('IntrinsicValueEngine formatPrice anchor mismatch')
path.write_text(text)
