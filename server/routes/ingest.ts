import { Router } from 'express';
import fetch from 'node-fetch';

export function createIngestRouter(): Router {
  const router = Router();

  // Web ingestion via Firecrawl (free tier, no API key needed)
  router.post('/api/ingest/web', async (req, res) => {
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
        signal: AbortSignal.timeout(15000),
      });

      if (fcResponse.ok) {
        const fcData = await fcResponse.json() as { success: boolean; data?: { markdown?: string } };
        if (fcData.success && fcData.data?.markdown) {
          const text = fcData.data.markdown
            .replace(/!\[.*?\]\(.*?\)/g, '') // Remove image links
            .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Convert links to text
            .replace(/#{1,6}\s/g, '') // Remove markdown headers
            .replace(/[*_`>]/g, '') // Remove formatting
            .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
            .trim();
          res.json({ text: text.slice(0, 10000), source: 'firecrawl' });
          return;
        }
      }

      // Fallback: basic fetch + HTML strip
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const html = await response.text();
      const text = html
        .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, '')
        .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      res.json({ text: text.slice(0, 10000), source: 'basic-fetch' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Failed to fetch URL: ${msg}` });
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

  // PDF ingestion (existing)
  router.post('/api/ingest/pdf', (req, res) => {
    res.json({ text: 'PDF ingestion placeholder' });
  });

  return router;
}