/** Sidecar logs only errors — evilginx terminal shows captures/navigation. */

export function logMirrorOpen() {}

export function logMirrorNavigate() {}

export function logMirrorCapture() {}

export function logMirrorError(entry, context, err) {
  const text = err?.message || String(err);
  const key = entry?.key || entry?.sessionId || '?';
  const sid = key.length > 12 ? key.slice(0, 8) : key;
  console.warn(`[mirror] ${sid} ${context}: ${text}`);
}
