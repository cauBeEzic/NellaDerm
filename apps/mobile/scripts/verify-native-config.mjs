import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const expoCli = resolve(dirname(require.resolve('expo/package.json')), 'bin/cli');
const config = JSON.parse(execFileSync(process.execPath, [expoCli, 'config', '--type', 'introspect', '--json'], {
  cwd: projectRoot,
  encoding: 'utf8',
  env: { ...process.env, EXPO_NO_DOTENV: '1' },
}));

// Inspect the config plugins' native output, not just their app.json inputs.
const infoPlist = config._internal?.modResults?.ios?.infoPlist;
for (const key of ['NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription']) {
  assert.equal(typeof infoPlist?.[key], 'string', `Generated iOS configuration is missing ${key}; photo access would crash.`);
  assert.ok(infoPlist[key].trim(), `Generated iOS ${key} must explain why access is requested.`);
}
assert.equal(infoPlist.NSMicrophoneUsageDescription, undefined, 'Still-photo capture must not request microphone access.');

const permissions = config._internal?.modResults?.android?.manifest?.manifest?.['uses-permission'];
assert.ok(Array.isArray(permissions), 'Generated Android manifest permissions are unavailable.');
assert.ok(permissions.some((permission) => permission.$?.['android:name'] === 'android.permission.RECORD_AUDIO'
  && permission.$?.['tools:node'] === 'remove'), 'Android must block image-picker microphone permission.');

console.log('Native photo permission configuration verified for iOS and Android.');
