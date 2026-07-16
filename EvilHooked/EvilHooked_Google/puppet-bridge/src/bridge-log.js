function timeLabel() {
  const t = new Date();
  const h = String(t.getHours()).padStart(2, '0');
  const m = String(t.getMinutes()).padStart(2, '0');
  const s = String(t.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function logEvilpuppet(message) {
  console.log(`[${timeLabel()}] [inf] Evilpuppet ${message}`);
}

export function logEvilpuppetWarn(message) {
  console.warn(`[${timeLabel()}] [war] Evilpuppet ${message}`);
}
