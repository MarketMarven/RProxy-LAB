import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export function ensureCaptureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

export function saveCapture(captureDir, sessionId, payload) {
  ensureCaptureDir(captureDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = join(captureDir, `${sessionId}_${stamp}`);
  const out = {
    captured_at: new Date().toISOString(),
    sessionId,
    ...payload,
  };
  writeFileSync(`${base}.json`, JSON.stringify(out, null, 2), 'utf8');
  if (payload.cookies?.length) {
    writeFileSync(`${base}_cookies.json`, JSON.stringify(payload.cookies, null, 2), 'utf8');
  }
  return `${base}.json`;
}
