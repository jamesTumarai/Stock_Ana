import type { Express } from 'express';

export function registerMarketRoutes(app: Express) {
  app.get("/api/live-quotes", async (req, res) => {
    try {
      const symbolsParam = (req.query.symbols as string) || (req.query.tickers as string) || '';
      if (!symbolsParam) {
        return res.status(400).json({ error: "Missing 'symbols' query parameter" });
      }

      const rawSymbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      if (rawSymbols.length === 0) {
        return res.status(400).json({ error: "No valid symbols provided" });
      }

      const mappedSymbols = rawSymbols.map(s => (s === 'SQ' ? 'XYZ' : s));
      const quotes: Record<string, any> = {};

      // 1. Try Authenticated Yahoo Finance Quote (multi-symbol)
      let cookie = '';
      let crumb = '';
      try {
        const cRes = await fetch('https://fc.yahoo.com', {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          signal: AbortSignal.timeout(3500)
        });
        cookie = cRes.headers.get('set-cookie') || '';
        const crRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Cookie': cookie },
          signal: AbortSignal.timeout(3500)
        });
        crumb = await crRes.text();
        if (crumb && crumb.length < 50 && !crumb.includes('<')) {
          const quoteUrl = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${mappedSymbols.join(',')}&crumb=${encodeURIComponent(crumb)}`;
          const qRes = await fetch(quoteUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Cookie': cookie },
            signal: AbortSignal.timeout(4000)
          });
          if (qRes.ok) {
            const qJson: any = await qRes.json();
            const list = qJson?.quoteResponse?.result || [];
            for (const q of list) {
              const sym = q.symbol?.toUpperCase();
              if (sym) {
                const capNum = q.marketCap || null;
                const capStr = capNum
                  ? (capNum >= 1e12 ? `$${(capNum / 1e12).toFixed(2)}T` : (capNum >= 1e9 ? `$${(capNum / 1e9).toFixed(2)}B` : `$${(capNum / 1e6).toFixed(1)}M`))
                  : null;
                quotes[sym] = {
                  symbol: sym,
                  price: q.regularMarketPrice ?? null,
                  changePercent: q.regularMarketChangePercent ?? null,
                  change: q.regularMarketChange ?? null,
                  marketCap: capStr,
                  marketCapRaw: capNum,
                  trailingPE: q.trailingPE ? Number(q.trailingPE.toFixed(1)) : null,
                  forwardPE: q.forwardPE ? Number(q.forwardPE.toFixed(1)) : null,
                  fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
                  fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? null,
                  volume: q.regularMarketVolume ?? null,
                  shortName: q.shortName || q.longName || sym
                };
              }
            }

            // 1b. Fetch quoteSummary for complete Valuation Measures (pegRatio, priceToSales, priceToBook, enterpriseToRevenue, enterpriseToEbitda)
            await Promise.all(mappedSymbols.map(async (s) => {
              try {
                const qsUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(s)}?modules=defaultKeyStatistics,summaryDetail,financialData,upgradeDowngradeHistory,recommendationTrend&crumb=${encodeURIComponent(crumb)}`;
                const qsRes = await fetch(qsUrl, {
                  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Cookie': cookie },
                  signal: AbortSignal.timeout(4000)
                });
                if (qsRes.ok) {
                  const qsJson: any = await qsRes.json();
                  const res0 = qsJson?.quoteSummary?.result?.[0];
                  if (res0) {
                    const ks = res0.defaultKeyStatistics || {};
                    const sd = res0.summaryDetail || {};
                    const fd = res0.financialData || {};
                    const ugh = res0.upgradeDowngradeHistory || {};
                    const rt = res0.recommendationTrend || {};

                    if (!quotes[s]) {
                      quotes[s] = { symbol: s };
                    }

                    // Key Valuation Measures
                    if (ks.pegRatio?.raw !== undefined) quotes[s].pegRatio = Number(ks.pegRatio.raw.toFixed(2));
                    if (sd.priceToSalesTrailing12Months?.raw !== undefined) quotes[s].priceToSales = Number(sd.priceToSalesTrailing12Months.raw.toFixed(2));
                    const pb = ks.priceToBook?.raw ?? sd.priceToBook?.raw ?? quotes[s].priceToBook;
                    if (pb !== undefined && pb !== null) quotes[s].priceToBook = Number(pb.toFixed(2));
                    if (ks.enterpriseToRevenue?.raw !== undefined) quotes[s].enterpriseToRevenue = Number(ks.enterpriseToRevenue.raw.toFixed(2));
                    if (ks.enterpriseToEbitda?.raw !== undefined) quotes[s].enterpriseToEbitda = Number(ks.enterpriseToEbitda.raw.toFixed(2));
                    if (ks.enterpriseValue?.raw !== undefined) {
                      quotes[s].enterpriseValueRaw = ks.enterpriseValue.raw;
                      const evNum = ks.enterpriseValue.raw;
                      quotes[s].enterpriseValue = evNum >= 1e12 ? `$${(evNum / 1e12).toFixed(2)}T` : (evNum >= 1e9 ? `$${(evNum / 1e9).toFixed(2)}B` : `$${(evNum / 1e6).toFixed(1)}M`);
                    }

                    // Multiples refinement
                    if (quotes[s].trailingPE === null && sd.trailingPE?.raw) quotes[s].trailingPE = Number(sd.trailingPE.raw.toFixed(1));
                    if (quotes[s].forwardPE === null && (ks.forwardPE?.raw || sd.forwardPE?.raw)) {
                      quotes[s].forwardPE = Number((ks.forwardPE?.raw || sd.forwardPE?.raw).toFixed(1));
                    }

                    // Margins and Growth
                    if (fd.revenueGrowth?.raw !== undefined) quotes[s].revenueGrowthYoY = Number((fd.revenueGrowth.raw * 100).toFixed(1));
                    if (fd.grossMargins?.raw !== undefined) quotes[s].grossMargin = Number((fd.grossMargins.raw * 100).toFixed(1));
                    if (fd.profitMargins?.raw !== undefined) quotes[s].netMargin = Number((fd.profitMargins.raw * 100).toFixed(1));

                    // Real Wall Street Consensus & Analyst Ratings
                    quotes[s].forecast_data = {
                      financialData: {
                        targetHighPrice: fd.targetHighPrice?.raw,
                        targetLowPrice: fd.targetLowPrice?.raw,
                        targetMeanPrice: fd.targetMeanPrice?.raw,
                        targetMedianPrice: fd.targetMedianPrice?.raw,
                        recommendationKey: fd.recommendationKey,
                        numberOfAnalystOpinions: fd.numberOfAnalystOpinions?.raw,
                        currentPrice: fd.currentPrice?.raw || quotes[s].price
                      },
                      recommendationTrend: rt.trend || [],
                      upgradeDowngradeHistory: (ugh.history || []).slice(0, 15)
                    };
                  }
                }
              } catch (err) {
                // Ignore individual quoteSummary error
              }
            }));
          }
        }
      } catch (e) {
        console.warn("[/api/live-quotes] Yahoo cookie/crumb fetch error:", e);
      }

      // 2. Fallback to chart endpoint for any missing symbol
      const missingSymbols = mappedSymbols.filter(s => !quotes[s] || quotes[s].price === null);
      if (missingSymbols.length > 0) {
        await Promise.all(missingSymbols.map(async (sym) => {
          try {
            const chartRes = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}`, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
              signal: AbortSignal.timeout(3500)
            });
            if (chartRes.ok) {
              const cJson: any = await chartRes.json();
              const meta = cJson?.chart?.result?.[0]?.meta;
              if (meta && typeof meta.regularMarketPrice === 'number') {
                quotes[sym] = {
                  symbol: sym,
                  price: meta.regularMarketPrice,
                  changePercent: meta.regularMarketChangePercent ?? null,
                  change: meta.regularMarketPrice - (meta.chartPreviousClose || meta.regularMarketPrice),
                  marketCap: null,
                  marketCapRaw: null,
                  trailingPE: null,
                  forwardPE: null,
                  fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
                  fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
                  volume: meta.regularMarketVolume ?? null,
                  shortName: meta.shortName || sym
                };
              }
            }
          } catch (err) {
            console.warn(`[/api/live-quotes] Fallback chart error for ${sym}:`, err);
          }
        }));
      }

      if (rawSymbols.includes('SQ') && quotes['XYZ']) {
        quotes['SQ'] = { ...quotes['XYZ'], symbol: 'SQ' };
      }

      return res.json({
        quotes,
        asOf: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("[/api/live-quotes] Unexpected error:", error);
      return res.status(500).json({ error: error?.message || "Internal server error" });
    }
  });

}
