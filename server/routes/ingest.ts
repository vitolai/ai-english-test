import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

export function createIngestRouter(uploadDir: string): Router {
  const router = Router();
  const upload = multer({ dest: uploadDir });

  const FALLBACK_TEXT = 'Recent international business and technology news topics for TOEIC exam generation.';

  // Rate limiter: max 5 requests per minute per IP (same as /api/generate)
  const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
  const RATE_LIMIT_MAX = parseInt(process.env.INGEST_RATE_LIMIT_MAX || '', 10) || 60;
  const RATE_LIMIT_WINDOW_MS = 60_000;

  function ingestRateLimit(req: Request, res: Response, next: NextFunction) {
    const ip = (req.ip || req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '');
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      next();
      return;
    }
    entry.count++;
    if (entry.count > RATE_LIMIT_MAX) {
      res.status(429).json({ error: 'Rate limit exceeded. Max 5 ingest requests per minute.' });
      return;
    }
    next();
  }

  // Web ingestion via Firecrawl (free tier, no API key needed)
  router.post('/api/ingest/web', ingestRateLimit, async (req, res) => {
    try {
      const { url } = req.body as { url?: string };
      if (!url) {
        res.status(400).json({ error: 'URL is required.' });
        return;
      }

      try {
        // Try Firecrawl first (handles JS rendering, returns clean markdown)
        const fcResponse = await fetch('https://api.firecrawl.dev/v2/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, formats: ['markdown'] }),
          signal: AbortSignal.timeout(20000),
        });

        if (fcResponse.ok) {
          const fcData = await fcResponse.json() as { success: boolean; data?: { markdown?: string } };
          if (fcData.success && fcData.data?.markdown) {
            const text = fcData.data.markdown
              .replace(/!\[.*?\]\(.*?\)/g, '')
              .replace(/\[(.*?)\]\(.*?\)/g, '$1')
              .replace(/#{1,6}\s/g, '')
              .replace(/[*_`>]/g, '')
              .replace(/\n{3,}/g, '\n\n')
              .trim();
            res.json({ text: text.slice(0, 10000), source: 'firecrawl' });
            return;
          }
        }
      } catch { /* Firecrawl failed, try fallback */ }

      try {
        // Fallback: basic fetch + HTML strip
        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(10000),
        });
        const html = await response.text();
        const text = html
          .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, '')
          .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (text.length > 50) {
          res.json({ text: text.slice(0, 10000), source: 'basic-fetch' });
          return;
        }
      } catch { /* basic fetch also failed */ }

      res.json({ text: FALLBACK_TEXT, source: 'fallback' });
    } catch {
      res.json({ text: FALLBACK_TEXT, source: 'fallback' });
    }
  });

  // Firecrawl web search (free tier)
  router.post('/api/ingest/search', ingestRateLimit, async (req, res) => {
    const { query, limit } = req.body as { query?: string; limit?: number };
    if (!query) {
      res.status(400).json({ error: 'Search query is required.' });
      return;
    }
    try {
      const fcResponse = await fetch('https://api.firecrawl.dev/v2/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: limit || 5 }),
        signal: AbortSignal.timeout(15000),
      });

      if (fcResponse.ok) {
        const fcData = await fcResponse.json() as { success: boolean; data?: { web?: Array<{ url: string; title: string; description: string }> } };
        if (fcData.success && fcData.data?.web) {
          res.json({ results: fcData.data.web, source: 'firecrawl' });
          return;
        }
      }
      res.status(502).json({ error: 'Search failed' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Search failed: ${msg}` });
    }
  });

  // PDF ingestion
  router.post('/api/ingest/pdf', ingestRateLimit, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No PDF file uploaded.' });
        return;
      }
      const pdfPath = req.file.path;
      try {
        const pdfParse = (await import('pdf-parse')).default;
        const buffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(buffer);
        const text = (data.text || '').trim();
        if (text.length > 50) {
          res.json({ text: text.slice(0, 10000), source: 'pdf-parse' });
          return;
        }
        console.warn('[PDF] Extracted text too short, using fallback');
        res.json({ text: FALLBACK_TEXT, source: 'fallback', warning: 'Extracted text too short' });
      } catch (pdfErr) {
        const msg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
        console.error('[PDF] Extraction failed:', msg);
        res.json({ text: FALLBACK_TEXT, source: 'fallback', warning: msg });
      } finally {
        try { fs.unlinkSync(pdfPath); } catch { /* temp file cleanup */ }
      }
    } catch {
      res.json({ text: FALLBACK_TEXT, source: 'fallback' });
    }
  });

  return router;
}