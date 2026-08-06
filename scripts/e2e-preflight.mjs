import { execFileSync } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = process.env.WECHAT_DEVTOOLS_CLI || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const artifactDir = path.join(projectRoot, '.artifacts', 'e2e');
const reportPath = path.join(artifactDir, 'preflight.json');

const report = {
  checkedAt: new Date().toISOString(),
  cliPath,
  projectRoot,
  status: 'checking',
  checks: {},
};

await mkdir(artifactDir, { recursive: true });

async function fail(code, message) {
  report.status = 'blocked';
  report.blocker = code;
  report.message = message;
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.error(`E2E 预检未通过：${message}`);
  console.error(`详情：${reportPath}`);
  throw new Error(`E2E_BLOCKED:${code}`);
}

try {
  await access(cliPath);
  report.checks.devtoolsCli = 'ok';

  const projectConfig = JSON.parse(
    await readFile(path.join(projectRoot, 'project.config.json'), 'utf8'),
  );
  if (projectConfig.miniprogramRoot !== 'dist/') {
    await fail('invalid_miniprogram_root', 'project.config.json 的 miniprogramRoot 必须指向 dist/');
  } else {
    report.checks.projectConfig = 'ok';
  }

  await access(path.join(projectRoot, 'dist', 'app.json'));
  report.checks.compiledApp = 'ok';

  const output = execFileSync(cliPath, ['islogin'], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 30_000,
  });
  const loginMatch = output.match(/\{"login":(true|false)\}/);
  const loggedIn = loginMatch?.[1] === 'true';
  report.checks.devtoolsLogin = loggedIn ? 'ok' : 'blocked';

  if (!loggedIn) {
    await fail(
      'wechat_devtools_login_required',
      '微信开发者工具尚未登录。请先执行开发者工具登录，再重新运行 pnpm test:e2e',
    );
  } else {
    report.status = 'ready';
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log('E2E 预检通过：微信开发者工具、登录状态和小程序产物均可用。');
  }
} catch (error) {
  if (error instanceof Error && error.message.startsWith('E2E_BLOCKED:')) {
    process.exitCode = 2;
  } else {
    await fail(
      'preflight_error',
      error instanceof Error ? error.message : String(error),
    ).catch(() => {
      process.exitCode = 2;
    });
  }
}
