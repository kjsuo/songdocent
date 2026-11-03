import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0').filter(Boolean);
const failures = [];
const privateFiles = /(^|\/)(?:\.env(?:\..+)?|\.DS_Store|node_modules|__pycache__|\.venv|\.audit|release-artifacts|installer-artifacts)(\/|$)|\.(?:key|p12|pfx|pyc)$|^src-tauri\/(?:target|gen)\/|^dist\/|^src-tauri\/tauri\.updater\.generated\.conf\.json$/;

for (const file of files) {
  if (privateFiles.test(file) && !file.endsWith('/.env.example') && file !== '.env.example') {
    failures.push(`Remove private or generated file from Git: ${file}`);
  }
  if (!file.endsWith('.md')) continue;
  const content = readFileSync(resolve(root, file), 'utf8');
  for (const match of content.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || /^[a-z][a-z\d+.-]*:/i.test(target)) continue;
    const path = resolve(root, dirname(file), decodeURIComponent(target));
    if (relative(root, path).startsWith('..') || !existsSync(path)) {
      failures.push(`Broken local documentation link in ${file}: ${target}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Public source checks passed for ${files.length} tracked files.`);
}
