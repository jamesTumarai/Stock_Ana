import type { Express } from 'express';
import { handleSecPreview, handleSecCompare, handleSecDiff } from '../secPreviewHandler.ts';

export function registerSecRoutes(app: Express) {
  app.get('/api/sec-preview', handleSecPreview);
  app.post('/api/sec-compare', handleSecCompare);
  app.get('/api/sec-diff', handleSecDiff);
}
