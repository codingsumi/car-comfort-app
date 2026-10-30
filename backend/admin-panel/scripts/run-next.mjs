import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readEnvValue(key) {
  const envPath = join(root, '.env.local');
  if (existsSync(envPath)) {
    const match = readFileSync(envPath, 'utf8').match(new RegExp(`^${key}=(.+)$`, 'm'));
    if (match?.[1]) return match[1].trim();
  }
  return process.env[key]?.trim();
}

function readAppUrl() {
  const fromEnv = readEnvValue('NEXT_PUBLIC_APP_URL');
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const basePath = readEnvValue('NEXT_PUBLIC_BASE_PATH') || '/admin';
  const normalized = basePath.startsWith('/') ? basePath : `/${basePath}`;
  return `http://localhost:4002${normalized}`;
}

const appUrl = readAppUrl();

function patchLine(line) {
  if (!/^\s*- (Local|Network):/.test(line)) return line;
  return line.replace(/(https?:\/\/\S+)/, (url) => {
    if (url.startsWith(appUrl)) return url.endsWith('/') ? url : `${url}/`;
    const portMatch = url.match(/:(\d+)$/);
    if (portMatch && portMatch[1] === '4002') {
      return `${appUrl}/`;
    }
    return url;
  });
}

function patchOutput(chunk) {
  return chunk
    .toString()
    .split('\n')
    .map((line, i, lines) => {
      const patched = patchLine(line);
      return i < lines.length - 1 ? `${patched}\n` : patched;
    })
    .join('');
}

const nextArgs = process.argv.slice(2);
const child = spawn('npx', ['next', ...nextArgs], {
  cwd: root,
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
  env: process.env,
});

child.stdout.on('data', (data) => process.stdout.write(patchOutput(data)));
child.stderr.on('data', (data) => process.stderr.write(patchOutput(data)));
child.on('exit', (code) => process.exit(code ?? 0));
