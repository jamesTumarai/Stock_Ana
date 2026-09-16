import type { Express, Request, Response } from 'express';
import { getMaterialEventsForTickers, normalizeTicker } from '../services/materialNewsService';

function sendJson(res: Response, status: number, body: unknown) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(body);
  }
  if (typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  res.statusCode = status;
  return res.end(JSON.stringify(body));
}

const TICKER_REGEX = /^[A-Z0-9.-]{1,12}$/;

export async function handleMaterialEvents(req: Request, res: Response) {
  try {
    let symbolsParam = '';

    if (req.method === 'POST') {
      const body = req.body || {};
      if (Array.isArray(body.symbols)) {
        symbolsParam = body.symbols.join(',');
      } else if (typeof body.symbols === 'string') {
        symbolsParam = body.symbols;
      } else if (typeof body.tickers === 'string') {
        symbolsParam = body.tickers;
      }
    } else {
      const url = new URL(req.url || '/api/material-events', 'http://localhost');
      symbolsParam = (req.query?.symbols as string) || (req.query?.tickers as string) || url.searchParams.get('symbols') || url.searchParams.get('tickers') || '';
    }

    if (!symbolsParam || !symbolsParam.trim()) {
      return sendJson(res, 400, {
        error: "Missing 'symbols' parameter",
        code: 'MISSING_SYMBOLS',
        events: [],
        recentNews: [],
        checkedAt: new Date().toISOString(),
        requestedSymbols: [],
        successfulSymbols: [],
        failedSymbols: [],
      });
    }

    const rawList = symbolsParam.split(',').map(normalizeTicker).filter(Boolean);
    const validSymbols = rawList.filter(s => TICKER_REGEX.test(s));

    if (validSymbols.length === 0) {
      return sendJson(res, 400, {
        error: 'No valid ticker symbols provided',
        code: 'INVALID_SYMBOLS',
        events: [],
        recentNews: [],
        checkedAt: new Date().toISOString(),
        requestedSymbols: rawList,
        successfulSymbols: [],
        failedSymbols: rawList,
      });
    }

    const forceRefresh = req.query?.refresh === 'true' || req.body?.refresh === true;
    const result = await getMaterialEventsForTickers(validSymbols, { forceRefresh });

    return sendJson(res, 200, result);
  } catch (error: any) {
    console.error('[materialNewsRoutes] Error processing events:', error);
    return sendJson(res, 500, {
      error: error?.message || 'Failed to retrieve material events',
      code: 'INTERNAL_ERROR',
      events: [],
      recentNews: [],
      checkedAt: new Date().toISOString(),
      requestedSymbols: [],
      successfulSymbols: [],
      failedSymbols: [],
      sourceStatus: { sec: 'ERROR', news: 'ERROR' },
      cacheStatus: 'MISS',
    });
  }
}

export function registerMaterialNewsRoutes(app: Express) {
  app.get('/api/material-events', handleMaterialEvents as any);
  app.post('/api/material-events', handleMaterialEvents as any);
}
