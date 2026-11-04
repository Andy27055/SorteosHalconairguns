const { spawn } = require('node:child_process');
const path = require('node:path');
const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/reset-password.ts', ...process.argv.slice(2)], { cwd: path.join(__dirname, 'backend'), stdio: 'inherit' });
child.on('exit', code => { process.exitCode = code || 0; });
