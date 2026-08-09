import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync('node_modules')) run('npm', ['install']);
if (!existsSync('ios')) run('npx', ['cap', 'add', 'ios']);
run('npx', ['cap', 'sync', 'ios']);
run('npx', ['cap', 'open', 'ios']);
