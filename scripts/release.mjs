import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, realpathSync } from 'node:fs';
import { resolve, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, createPublicKey, verify } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const targets = {
  'aarch64-apple-darwin': { platform: 'darwin-aarch64', bundle: 'macos', extension: '.app.tar.gz', installer: '.dmg' },
  'x86_64-apple-darwin': { platform: 'darwin-x86_64', bundle: 'macos', extension: '.app.tar.gz', installer: '.dmg' },
  'x86_64-pc-windows-msvc': { platform: 'windows-x86_64', bundle: 'nsis', extension: '.exe', installer: '.exe' },
};
function readJson(file) { return JSON.parse(readFileSync(join(root, file), 'utf8')); }
export function versionInfo() {
  const pkg = readJson('package.json');
  const config = readJson('src-tauri/tauri.conf.json');
  const cargo = readFileSync(join(root, 'src-tauri/Cargo.toml'), 'utf8');
  const rustVersion = cargo.match(/\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m)?.[1];
  if (!stableVersion.test(pkg.version) || pkg.version !== config.version || pkg.version !== rustVersion) throw new Error('package.json, Cargo.toml and tauri.conf.json must have the same stable version.');
  const tag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : process.env.SONGDOCENT_RELEASE_TAG;
  if (tag && tag !== `v${pkg.version}`) throw new Error(`Release tag must be v${pkg.version}.`);
  return { version: pkg.version, tag: `v${pkg.version}`, config };
}
export function updateEndpoint(repository) {
  if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('Set GITHUB_REPOSITORY or SONGDOCENT_UPDATE_REPOSITORY to owner/repository.');
  return `https://github.com/${repository}/releases/latest/download/latest.json`;
}
export function updaterConfig(config, repository) {
  const pubkey = config.plugins?.updater?.pubkey;
  if (!pubkey || !Buffer.from(pubkey, 'base64').toString().includes('untrusted comment:')) throw new Error('A Tauri updater public key is required.');
  return { bundle: { createUpdaterArtifacts: true }, plugins: { updater: { pubkey, endpoints: [updateEndpoint(repository)], windows: { installMode: 'passive' } } } };
}
export function createManifest(entries, repository, version, pubDate = new Date().toISOString()) {
  updateEndpoint(repository);
  const required = Object.values(targets).map(({ platform }) => platform);
  const platforms = {};
  for (const entry of entries) {
    if (!required.includes(entry.platform) || platforms[entry.platform] || entry.version !== version || !entry.signature?.trim() || basename(entry.file) !== entry.file) throw new Error('Release artifacts have mismatched versions, duplicate platforms or missing signatures.');
    platforms[entry.platform] = { signature: entry.signature.trim(), url: `https://github.com/${repository}/releases/download/v${version}/${encodeURIComponent(entry.file)}` };
  }
  if (required.some((platform) => !platforms[platform])) throw new Error('Release requires macOS Apple Silicon, macOS Intel and Windows x64 artifacts.');
  return { version, notes: `SongDocent ${version}`, pub_date: pubDate, platforms };
}
// Tauri uses Minisign's prehashed Ed25519 format, including a signed comment.
export function verifyUpdate(bytes, encodedSignature, encodedPublicKey) {
  const keyLines = Buffer.from(encodedPublicKey, 'base64').toString('utf8').trim().split(/\r?\n/);
  const signatureLines = Buffer.from(encodedSignature, 'base64').toString('utf8').trim().split(/\r?\n/);
  const key = Buffer.from(keyLines[1] ?? '', 'base64');
  const signature = Buffer.from(signatureLines[1] ?? '', 'base64');
  const comment = signatureLines[2] ?? '';
  const globalSignature = Buffer.from(signatureLines[3] ?? '', 'base64');
  if (key.length !== 42 || signature.length !== 74 || globalSignature.length !== 64
      || signature.subarray(0, 2).toString() !== 'ED' || !comment.startsWith('trusted comment: ')
      || !key.subarray(2, 10).equals(signature.subarray(2, 10))) throw new Error('Updater signature does not match the committed public key.');
  const publicKey = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), key.subarray(10)]), format: 'der', type: 'spki' });
  const digest = createHash('blake2b512').update(bytes).digest();
  const signedComment = Buffer.concat([signature.subarray(10), Buffer.from(comment.slice(17))]);
  if (!verify(null, digest, publicKey, signature.subarray(10)) || !verify(null, signedComment, publicKey, globalSignature)) throw new Error('Updater artifact signature verification failed.');
}
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]);
}
function exactlyOne(files, extension) {
  const matching = files.filter((file) => file.endsWith(extension));
  if (matching.length !== 1) throw new Error(`Expected exactly one ${extension} artifact; found ${matching.length}.`);
  return matching[0];
}
export function run(command, argument) {
  if (command === 'set-version') {
    if (!stableVersion.test(argument ?? '')) throw new Error('Use a stable version such as 0.1.1.');
    const pkg = readJson('package.json'); pkg.version = argument;
    const config = readJson('src-tauri/tauri.conf.json'); config.version = argument;
    const cargoPath = join(root, 'src-tauri/Cargo.toml');
    const cargo = readFileSync(cargoPath, 'utf8').replace(/(\[package\][\s\S]*?^version\s*=\s*")[^"]+(".*$)/m, (_match, before, after) => before + argument + after);
    const lockPath = join(root, 'src-tauri/Cargo.lock');
    const lock = readFileSync(lockPath, 'utf8').replace(/(name = "songdocent"\nversion = ")[^"]+(")/, (_match, before, after) => before + argument + after);
    writeFileSync(join(root, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
    writeFileSync(join(root, 'src-tauri/tauri.conf.json'), JSON.stringify(config, null, 2) + '\n');
    writeFileSync(cargoPath, cargo); writeFileSync(lockPath, lock);
  }
  const { version, config } = versionInfo();
  if (command === 'check' || command === 'set-version') { console.log(`Release version verified: ${version}`); return; }
  const repository = process.env.SONGDOCENT_UPDATE_REPOSITORY || process.env.GITHUB_REPOSITORY;
  if (command === 'prepare') {
    const generated = updaterConfig(config, repository);
    writeFileSync(join(root, 'src-tauri/tauri.updater.generated.conf.json'), JSON.stringify(generated, null, 2) + '\n');
    console.log(`Release updater configured for ${repository}.`); return;
  }
  if (command === 'collect') {
    const target = targets[argument];
    if (!target) throw new Error('Unsupported release target.');
    const bundles = join(root, 'src-tauri/target', argument, 'release/bundle');
    const update = exactlyOne(walk(join(bundles, target.bundle)), target.extension);
    const installer = exactlyOne(walk(join(bundles, target.installer === '.dmg' ? 'dmg' : 'nsis')), target.installer);
    const out = join(root, 'release-artifacts', target.platform);
    mkdirSync(out, { recursive: true });
    const filename = `SongDocent_${version}_${target.platform}${target.extension}`;
    copyFileSync(update, join(out, filename));
    copyFileSync(`${update}.sig`, join(out, `${filename}.sig`));
    if (installer !== update) copyFileSync(installer, join(out, `SongDocent_${version}_${target.platform}${target.installer}`));
    const signature = readFileSync(`${update}.sig`, 'utf8').trim();
    verifyUpdate(readFileSync(update), signature, config.plugins.updater.pubkey);
    writeFileSync(join(out, 'platform.json'), JSON.stringify({ version, platform: target.platform, file: filename, signature }) + '\n');
    return;
  }
  if (command === 'manifest') {
    const directory = resolve(root, argument || 'release-artifacts');
    const entries = walk(directory).filter((file) => basename(file) === 'platform.json').map((file) => JSON.parse(readFileSync(file, 'utf8')));
    const manifest = createManifest(entries, repository, version);
    for (const entry of entries) verifyUpdate(readFileSync(join(directory, entry.platform, entry.file)), entry.signature, config.plugins.updater.pubkey);
    writeFileSync(join(directory, 'latest.json'), JSON.stringify(manifest, null, 2) + '\n'); return;
  }
  throw new Error('Use check, set-version <version>, prepare, collect <target>, or manifest [directory].');
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { run(process.argv[2], process.argv[3]); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
