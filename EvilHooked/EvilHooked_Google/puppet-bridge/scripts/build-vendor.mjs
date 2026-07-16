import { mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vendor = join(root, 'public', 'vendor');
mkdirSync(vendor, { recursive: true });

copyFileSync(
  join(root, 'node_modules', 'socket.io', 'client-dist', 'socket.io.min.js'),
  join(vendor, 'socket.io.min.js'),
);

execSync(
  'npx esbuild node_modules/diff-dom/dist/module.js --bundle --format=iife --global-name=diffDOM --outfile=public/vendor/diff-dom.min.js',
  { cwd: root, stdio: 'inherit' },
);

console.log('[puppet-bridge] vendor assets built → public/vendor/');
