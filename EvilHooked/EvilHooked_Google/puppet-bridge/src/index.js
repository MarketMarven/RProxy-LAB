#!/usr/bin/env node
import { startFromArgv } from './server.js';

const configPath = process.argv[2] || process.env.PHISHFORGE_PUPPET_CONFIG;

startFromArgv(configPath).catch((err) => {
  console.error('[puppet-bridge] fatal:', err.message);
  process.exit(1);
});
