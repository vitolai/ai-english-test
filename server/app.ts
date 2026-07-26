import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Response, Request } from 'express';
import { createGenerateRouter } from './routes/generate.js';
import { createIngestRouter } from './routes/ingest.js';
import { PROVIDERS } from '../src/lib/providers.js';

// ============================================================
// DIRECTORY SETUP
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const STORAGE_DIR = path.join(ROOT_DIR, 'storage', 'sessions');
const UPLOAD_DIR = path.join(ROOT_DIR, 'storage', 'uploads');
const SESSION_STATUS_FILE = path.join(ROOT_DIR, 'storage', 'session_status.json');
if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ============================================================
// SESSION STORES (shared across routes)
// ============================================================

export interface SessionStores {
  sseClients: Map<string, Response>;
  sessionStatus: Map<string, { phase: string; progress: number; message: string }>;
}

const sseClients = new Map<string, Response>();
const sessionStatus = new Map<string, { phase: string; progress: number; message: string }>();

function loadSessionStatus() {
  try {
    if (fs.existsSync(SESSION_STATUS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_STATUS_FILE, 'utf-8')) as Record<string, { phase: string; progress: number; message: string }>;
      for (const [k, v] of Object.entries(data)) {
        sessionStatus.set(k, v);
      }
      console.log(`[Session] Loaded ${sessionStatus.size} session(s) from disk`);
    }
  } catch (err) {
    console.warn('[Session] Failed to load session status:', err instanceof Error ? err.message : String(err));
  }
}

export function persistSessionStatus() {
  try {
    const obj: Record<string, { phase: string; progress: number; message: string }> = {};
    for (const [k, v] of sessionStatus) {
      obj[k] = v;
    }
    fs.writeFileSync(SESSION_STATUS_FILE, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.warn('[Session] Failed to persist session status:', err instanceof Error ? err.message : String(err));
  }
}

loadSessionStatus();

const stores: SessionStores = { sseClients, sessionStatus };

// ============================================================
// EXPRESS APP
// ============================================================

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.get('/storage/sessions/:sessionId/exam_data.json', (req: Request, res: Response) => {
  const filePath = path.join(STORAGE_DIR, req.params.sessionId, 'exam_data.json');
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Exam data not found. Generation may have failed or session does not exist.' });
    return;
  }
  res.sendFile(filePath);
});
app.use('/storage', express.static(path.join(ROOT_DIR, 'storage')));

// ============================================================
// ROUTES
// ============================================================

app.use(createGenerateRouter(stores, STORAGE_DIR));
app.use(createIngestRouter(UPLOAD_DIR));

// ============================================================
// SSE STREAMING ENDPOINT + HEARTBEAT
// ============================================================

// SSE clients are in-memory only (lost on server restart).
// Client-side reconnect logic handles restarts: if no message
// received in 60s, the client automatically reconnects.
// See src/App.tsx EventSource reconnect implementation.
const SSE_HEARTBEAT_MS = 30_000;
let sseHeartbeatTimer: ReturnType<typeof setInterval> | null = null;

function startSseHeartbeat() {
  if (sseHeartbeatTimer) return;
  sseHeartbeatTimer = setInterval(() => {
    for (const [sessionId, client] of sseClients) {
      if (client.destroyed) {
        sseClients.delete(sessionId);
        continue;
      }
      try {
        client.write(`: ping\n\n`);
      } catch {
        sseClients.delete(sessionId);
      }
    }
  }, SSE_HEARTBEAT_MS);
}

startSseHeartbeat();

app.get('/api/events/:sessionId', (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  const current = sessionStatus.get(sessionId);
  if (current) {
    res.write(`data: ${JSON.stringify({ type: 'progress', ...current })}\n\n`);
  }

  sseClients.set(sessionId, res);
  req.on('close', () => sseClients.delete(sessionId));
});

// ============================================================
// STATUS ENDPOINT (backward compat polling)
// ============================================================

app.get('/api/status/:sessionId', (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const status = sessionStatus.get(sessionId);
  if (!status) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json(status);
});

// ============================================================
// PROVIDER HEALTH CHECK ENDPOINT
// ============================================================

const PROVIDER_HEALTH_LIST = Object.values(PROVIDERS)
  .filter(p => !p.hidden && !p.userProvidesBaseUrl && p.baseUrl !== 'mock://local')
  .map(p => ({ id: p.id, name: p.name, baseURL: p.baseUrl }));

const PROVIDER_ENV_KEYS: Record<string, string> = {
  nvidia: 'NVIDIA_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  groq: 'GROQ_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_API_KEY',
  together: 'TOGETHER_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  cohere: 'COHERE_API_KEY',
  ollama: 'OLLAMA_API_KEY',
};

interface ProviderHealth {
  id: string;
  name: string;
  status: string;
  latencyMs: number;
  models: string[];
  error: string | null;
}

app.get('/api/health/providers', async (_req: Request, res: Response) => {
  const results = await Promise.allSettled(
    PROVIDER_HEALTH_LIST.map(async (p): Promise<ProviderHealth> => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(p.baseURL + '/models', {
          headers: { Authorization: 'Bearer ' + (process.env[PROVIDER_ENV_KEYS[p.id] || 'test') },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const data = (await response.json()) as { data?: Array<{ id: string }> };
        return {
          id: p.id,
          name: p.name,
          status: response.ok ? 'healthy' : 'unhealthy',
          latencyMs: 0,
          models: data.data?.map(m => m.id) || [],
          error: null,
        };
      } catch (e) {
        return {
          id: p.id,
          name: p.name,
          status: 'skipped',
          latencyMs: 0,
          models: [],
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }),
  );

  const providersHealth: ProviderHealth[] = results.map(r =>
    r.status === 'fulfilled' ? r.value : { id: 'unknown', name: 'unknown', status: 'error', latencyMs: 0, models: [], error: r.reason instanceof Error ? r.reason.message : String(r.reason) },
  );
  const healthyCount = providersHealth.filter(p => p.status === 'healthy').length;

  res.json({
    totalProviders: providersHealth.length,
    healthyCount,
    checkedAt: new Date().toISOString(),
    providers: providersHealth,
  });
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
  console.log(`TOEIC backend running at http://localhost:${PORT}`);
  console.log(`  AI SDK: Vercel AI SDK v4 (ai + @ai-sdk/openai + @ai-sdk/groq)`);
  console.log(`  Providers: NVIDIA Nemotron / OpenRouter / Groq (cloud only)`);
  console.log(`  Features: streaming, json-mode, retry, fallback`);
});
