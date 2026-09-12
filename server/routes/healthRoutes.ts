import type { Express, Request, Response } from 'express';
import { getGlobalSecCache, type SecCacheStats } from '../../src/services/sec/secCache.ts';
import { resolveFirebaseAdminProjectId } from '../auth/firebaseProject.ts';

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

export function isInternalAdminAuthorized(req: Request): boolean {
  const adminSecret = process.env.ADMIN_SECRET?.trim() || process.env.INTERNAL_API_KEY?.trim();
  if (!adminSecret) {
    return false;
  }
  const headerKey = req.headers['x-admin-key'] || req.headers['x-internal-key'];
  if (typeof headerKey === 'string' && headerKey.trim() === adminSecret) {
    return true;
  }
  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.trim() === `Bearer ${adminSecret}`) {
    return true;
  }
  return false;
}

export function buildHealthReport(runtime: 'express-server' | 'vercel-function' = 'express-server'): HealthStatusResponse {
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
  const secConfigured = Boolean(process.env.SEC_USER_AGENT?.trim());

  let firebaseConfigured = false;
  let firebaseProjectId: string | undefined = undefined;
  try {
    const resolved = resolveFirebaseAdminProjectId(process.env);
    if (resolved && resolved.projectId) {
      firebaseConfigured = true;
      firebaseProjectId = resolved.projectId;
    }
  } catch {
    firebaseConfigured = false;
  }

  // Readiness: all core dependencies required for production analysis are configured
  const isHealthy = geminiConfigured && secConfigured && firebaseConfigured;
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

export function handleHealthCheck(req: Request | any, res: Response | any) {
  const urlObj = new URL(req.url || '', 'http://localhost');
  const isDetailedRequested = req.query?.detailed === 'true' || urlObj.searchParams.get('detailed') === 'true' || (typeof req.path === 'string' && req.path.endsWith('/detailed')) || urlObj.pathname.endsWith('/detailed');
  const runtime = (process.env.VERCEL || req.headers?.['x-vercel-id']) ? 'vercel-function' : 'express-server';
  const report = buildHealthReport(runtime);

  const minimal: PublicHealthResponse = {
    status: report.status,
    ok: report.ok,
    service: 'lumina',
    timestamp: report.timestamp,
  };

  if (isDetailedRequested) {
    if (!isInternalAdminAuthorized(req)) {
      if ((typeof req.path === 'string' && req.path.endsWith('/detailed')) || urlObj.pathname.endsWith('/detailed')) {
        return res.status(401).json({ error: 'Unauthorized: internal admin authorization required for detailed telemetry' });
      }
      // Public /api/health?detailed=true without authorization strictly returns minimal payload
      return res.status(200).json(minimal);
    }
    return res.status(200).json(report);
  }

  return res.status(200).json(minimal);
}

export function registerHealthRoutes(app: Express) {
  app.get('/api/health', handleHealthCheck);
  app.get('/api/health/detailed', handleHealthCheck);
}
