import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const automator = require('miniprogram-automator');
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = process.env.WECHAT_DEVTOOLS_CLI || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const automationPort = process.env.WECHAT_AUTOMATION_PORT || '9420';
const wsEndpoint = `ws://127.0.0.1:${automationPort}`;
let ownedServer;

async function endpointHealthy() {
  let client;
  try {
    client = await automator.connect({ wsEndpoint });
    await client.currentPage();
    return true;
  } catch { return false; }
  finally { client?.disconnect(); }
}

async function apiHealthy() {
  try {
    const response = await fetch('http://127.0.0.1:3100/api/health');
    const body = await response.json();
    return response.ok && body.database === 'up';
  } catch { return false; }
}

async function waitFor(check, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

if (!(await apiHealthy())) {
  ownedServer = spawn('pnpm', ['server:dev'], { cwd: projectRoot, stdio: 'inherit', env: process.env });
  if (!(await waitFor(apiHealthy, 20_000))) throw new Error('本地 API 未就绪，请检查 MySQL 和 server/.env');
}

if (!(await endpointHealthy())) {
  execFileSync(cliPath, ['auto', '--project', projectRoot, '--auto-port', automationPort, '--trust-project'], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 30_000,
    stdio: 'inherit',
  });
  if (!(await waitFor(endpointHealthy, 20_000))) {
    throw new Error(`微信自动化端口无法响应：${wsEndpoint}`);
  }
}

const result = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-concurrency=1', path.join(projectRoot, 'tests/e2e/m1-core.test.mjs')], {
  cwd: projectRoot,
  env: { ...process.env, WECHAT_AUTOMATION_WS: wsEndpoint },
  stdio: 'inherit',
});

if (ownedServer) ownedServer.kill('SIGTERM');
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
