import '../src/config.js';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const result=spawnSync(process.execPath,[path.resolve('../node_modules/vitest/vitest.mjs'),'run','src/integration.test.ts'],{stdio:'inherit',env:{...process.env,RUN_DB_TESTS:'true'}});
process.exit(result.status??1);
