import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { createManifest, updateEndpoint, updaterConfig, versionInfo, verifyUpdate } from './release.mjs';
const entries = ['darwin-aarch64', 'darwin-x86_64', 'windows-x86_64'].map(platform => ({ platform, version: '0.1.0', file: `SongDocent_${platform}.zip`, signature: 'signed' }));
test('manifest uses the new repository and requires all three platforms', () => {
  const manifest = createManifest(entries, 'owner/songdocent', '0.1.0', '2026-10-07T00:00:00Z');
  assert.equal(manifest.platforms['darwin-aarch64'].url, 'https://github.com/owner/songdocent/releases/download/v0.1.0/SongDocent_darwin-aarch64.zip');
  assert.throws(() => createManifest(entries.slice(1), 'owner/songdocent', '0.1.0'));
  assert.throws(() => createManifest([...entries, entries[0]], 'owner/songdocent', '0.1.0'));
  assert.throws(() => createManifest([{ ...entries[0], signature: '' }, ...entries.slice(1)], 'owner/songdocent', '0.1.0'));
  assert.throws(() => createManifest([{ ...entries[0], version: '0.2.0' }, ...entries.slice(1)], 'owner/songdocent', '0.1.0'));
  assert.throws(() => createManifest([{ ...entries[0], file: '../secret' }, ...entries.slice(1)], 'owner/songdocent', '0.1.0'));
});
test('release config enables signatures with the committed public key', () => {
  const { config } = versionInfo(); const generated = updaterConfig(config, 'owner/songdocent');
  assert.equal(generated.bundle.createUpdaterArtifacts, true);
  assert.equal(generated.plugins.updater.pubkey, config.plugins.updater.pubkey);
  assert.equal(generated.plugins.updater.endpoints[0], updateEndpoint('owner/songdocent'));
  assert.throws(() => updateEndpoint(undefined)); assert.throws(() => updateEndpoint('https://github.com/owner/songdocent'));
});
test('version command updates every app version and rejects invalid input', () => {
  const directory = mkdtempSync(join(tmpdir(), 'songdocent-release-'));
  try {
    mkdirSync(join(directory, 'scripts')); mkdirSync(join(directory, 'src-tauri'));
    copyFileSync(new URL('./release.mjs', import.meta.url), join(directory, 'scripts/release.mjs'));
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ version: '0.1.0' }));
    writeFileSync(join(directory, 'src-tauri/tauri.conf.json'), JSON.stringify({ version: '0.1.0' }));
    writeFileSync(join(directory, 'src-tauri/Cargo.toml'), '[package]\nname = "songdocent"\nversion = "0.1.0"\n');
    writeFileSync(join(directory, 'src-tauri/Cargo.lock'), '[[package]]\nname = "songdocent"\nversion = "0.1.0"\n');
    const env = { ...process.env, GITHUB_REF_TYPE: '', SONGDOCENT_RELEASE_TAG: '' };
    execFileSync(process.execPath, [join(directory, 'scripts/release.mjs'), 'set-version', '0.10.12'], { env });
    assert.match(readFileSync(join(directory, 'src-tauri/Cargo.toml'), 'utf8'), /version = "0.10.12"/);
    assert.match(readFileSync(join(directory, 'src-tauri/Cargo.lock'), 'utf8'), /version = "0.10.12"/);
    assert.throws(() => execFileSync(process.execPath, [join(directory, 'scripts/release.mjs'), 'check'], { env: { ...env, SONGDOCENT_RELEASE_TAG: 'v0.1.0' }, stdio: 'pipe' }));
  } finally { rmSync(directory, { recursive: true }); }
});

test('updater signatures reject changed contents and wrong signing keys', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const keyId = Buffer.from('0102030405060708', 'hex');
  const rawKey = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const key = Buffer.from(`untrusted comment: test\n${Buffer.concat([Buffer.from('Ed'), keyId, rawKey]).toString('base64')}\n`).toString('base64');
  const bytes = Buffer.from('Release package');
  const signed = sign(null, createHash('blake2b512').update(bytes).digest(), privateKey);
  const comment = 'timestamp:1';
  const globalSignature = sign(null, Buffer.concat([signed, Buffer.from(comment)]), privateKey);
  const signature = Buffer.from(`untrusted comment: test\n${Buffer.concat([Buffer.from('ED'), keyId, signed]).toString('base64')}\ntrusted comment: ${comment}\n${globalSignature.toString('base64')}\n`).toString('base64');
  verifyUpdate(bytes, signature, key);
  assert.throws(() => verifyUpdate(Buffer.from('Changed release'), signature, key));
  assert.throws(() => verifyUpdate(bytes, signature, Buffer.from('invalid').toString('base64')));
});
