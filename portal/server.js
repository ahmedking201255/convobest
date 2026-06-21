require('dotenv').config({ override: true });

process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '2';
process.env.NEXT_PRIVATE_WORKER_COUNT = process.env.NEXT_PRIVATE_WORKER_COUNT || '1';

const { createServer } = require('http');
const { spawn } = require('child_process');
const next = require('next');

const port = parseInt(process.env.PORT || '3000', 10);
const hostname = process.env.HOST || '0.0.0.0';
const engineHealthUrl = process.env.WHATSAPP_ENGINE_HEALTH_URL || 'http://127.0.0.1:8080/server/ok';
const engineEnsureScript = process.env.WHATSAPP_ENGINE_ENSURE_SCRIPT || '/home/u206521676/convobest-go/ensure-engine.sh';
const messageCleanupSecret = process.env.MESSAGE_CLEANUP_SECRET || process.env.JWT_SECRET;
const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

function ensureWhatsAppEngine() {
  if (process.platform !== 'linux') return;

  const child = spawn('/usr/bin/setsid', [engineEnsureScript], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

async function monitorWhatsAppEngine() {
  try {
    const response = await fetch(engineHealthUrl, {
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    });
    if (response.ok) return;
  } catch {
    // The ensure script owns the process lock, so concurrent checks stay harmless.
  }

  ensureWhatsAppEngine();
}

async function runMessageCleanup() {
  if (!messageCleanupSecret) {
    console.error('[Message Cleanup] MESSAGE_CLEANUP_SECRET or JWT_SECRET is required.');
    return;
  }

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/internal/message-cleanup`, {
      method: 'POST',
      headers: { 'x-cleanup-secret': messageCleanupSecret },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.error(`[Message Cleanup] Request failed with status ${response.status}.`);
    }
  } catch (error) {
    console.error('[Message Cleanup] Request failed:', error.message);
  }
}

app.prepare().then(() => {
  createServer((req, res) => {
    handle(req, res);
  }).listen(port, hostname, () => {
    console.log(`ConvoBest portal is running on http://${hostname}:${port}`);
    monitorWhatsAppEngine();
    const engineMonitor = setInterval(monitorWhatsAppEngine, 30000);
    engineMonitor.unref();

    const cleanupStart = setTimeout(runMessageCleanup, 10000);
    cleanupStart.unref();
    const cleanupMonitor = setInterval(runMessageCleanup, 60 * 60 * 1000);
    cleanupMonitor.unref();
  });
});
