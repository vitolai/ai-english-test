import { Router } from 'express';
import fetch from 'node-fetch';

export function createIngestRouter(): Router {
  const router = Router();

  const FALLBACK_TEXT = 'Recent international business and technology news topics for TOEIC exam generation.';

  // Web ingestion via Firecrawl (free tier, no API key needed)
  router.post('/api/ingest/web', async (req, res) => {
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
  router.post('/api/ingest/search', async (req, res) => {
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
  router.post('/api/ingest/pdf', (req, res) => {
    res.json({ text: FALLBACK_TEXT, source: 'fallback' });
  });

  return router;
}