import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const result = spawnSync(process.execPath, [require.resolve('expo/bin/cli'), 'start', '--localhost', '--port', '8086', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, EXPO_PUBLIC_SYNTHETIC_DEMO: '1' },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
