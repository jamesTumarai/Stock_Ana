import type { Express, Request, Response } from 'express';
import { getGlobalSecCache, type SecCacheStats } from '../../src/services/sec/secCache.ts';

export interface PublicHealthResponse {
  ok: boolean;
  status: 'healthy' | 'degraded';
  service: 'lumina';
  timestamp: string;
}

export interface DetailedHealthStatusResponse extends PublicHealthResponse {
  uptimeSecs: number;
  runtime: 'express-server' | 'vercel-function';
  services: {
    gemini: {
      configured: boolean;
      modelDefault: string;
    };
    sec: {
      configured: boolean;
      cache: SecCacheStats | null;
    };
    firebase: {
      configured: boolean;
      projectId?: string;
    };
  };
  system?: {
    memoryRssMb: number;
    memoryHeapUsedMb: number;
    memoryHeapTotalMb: number;
    nodeVersion: string;
  };
}

export type HealthStatusResponse = DetailedHealthStatusResponse;

export function buildHealthReport(runtime: 'express-server' | 'vercel-function' = 'express-server'): HealthStatusResponse {
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
  const secConfigured = Boolean(process.env.SEC_USER_AGENT?.trim());
  const firebaseConfigured = Boolean(process.env.FIREBASE_PROJECT_ID?.trim() || process.env.VITE_FIREBASE_PROJECT_ID?.trim());
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID?.trim() || process.env.VITE_FIREBASE_PROJECT_ID?.trim() || undefined;

  const isHealthy = geminiConfigured && secConfigured;
  const mem = typeof process !== 'undefined' && process.memoryUsage ? process.memoryUsage() : null;
  const secCache = getGlobalSecCache();

  return {
    status: isHealthy ? 'healthy' : 'degraded',
    ok: isHealthy,
    service: 'lumina',
    timestamp: new Date().toISOString(),
    uptimeSecs: typeof process !== 'undefined' && process.uptime ? Math.round(process.uptime()) : 0,
    runtime,
    services: {
      gemini: {
        configured: geminiConfigured,
        modelDefault: 'gemini-3.8-flash',
      },
      sec: {
        configured: secConfigured,
        cache: secCache.getStats(),
      },
      firebase: {
        configured: firebaseConfigured,
        projectId: firebaseProjectId,
      },
    },
    system: mem ? {
      memoryRssMb: Number((mem.rss / (1024 * 1024)).toFixed(1)),
      memoryHeapUsedMb: Number((mem.heapUsed / (1024 * 1024)).toFixed(1)),
      memoryHeapTotalMb: Number((mem.heapTotal / (1024 * 1024)).toFixed(1)),
      nodeVersion: process.version || 'unknown',
    } : undefined,
  };
}

export function handleHealthCheck(req: Request, res: Response) {
  const isDetailed = req.query.detailed === 'true';
  const report = buildHealthReport('express-server');

  if (isDetailed) {
    return res.status(200).json(report);
  }

  const minimal: PublicHealthResponse = {
    status: report.status,
    ok: report.ok,
    service: 'lumina',
    timestamp: report.timestamp,
  };
  return res.status(200).json(minimal);
}

export function registerHealthRoutes(app: Express) {
  app.get('/api/health', handleHealthCheck);
}
