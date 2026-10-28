#!/usr/bin/env node
/** Verify the packed DSH bundle with published DSH packages and an unpaired local Ntfyx process. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeVersion = '0.2.2-alpha.2';
const runtimePackages = [
  'dsh-app-boot', 'dsh-tools', 'dsh-tool-executor-native', 'dsh-system-prompt',
  'dsh-skill', 'dsh-skill-filesystem', 'dsh-mcp-client',
];
const registry = 'https://registry.npmjs.org';

async function json(path) { return JSON.parse(await readFile(path, 'utf8')); }
async function save(path, value) { await writeFile(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); }
function hash(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

function options(argv) {
  const result = { output: join(pluginRoot, '.local/dsh-plugin-test'), bundle: pluginRoot };
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (flag === '--help') {
      console.log('node scripts/smoke.mjs [--runtime PATH] [--ntfyx PATH] [--output PATH] [--plugin PATH]\nUses official DSH 0.2.2-alpha.2 packages, a packed bundle, and local unpaired MCP validation. No model or notification calls.');
      process.exit(0);
    }
    assert.ok(['--runtime', '--ntfyx', '--output', '--plugin'].includes(flag), `Unknown option ${flag}`);
    assert.ok(argv[index + 1] && !argv[index + 1].startsWith('--'), `Missing value for ${flag}`);
    result[flag === '--plugin' ? 'bundle' : flag.slice(2)] = resolve(argv[++index]);
  }
  return result;
}

/** Child processes receive no production identities, API keys, or personal configuration. */
function environment(home, bin) {
  const env = {};
  for (const name of ['PATH', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy']) {
    if (process.env[name]) env[name] = process.env[name];
  }
  return {
    ...env,
    PATH: bin + (process.platform === 'win32' ? ';' : ':') + (env.PATH ?? ''),
    HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: join(home, 'config'), XDG_DATA_HOME: join(home, 'data'),
    XDG_STATE_HOME: join(home, 'state'), XDG_CACHE_HOME: join(home, 'cache'), DSH_HOME: join(home, 'dsh'),
    DSH_AGENTS_HOME: join(home, 'agents'), DSH_TELEMETRY_DISABLED: '1',
    NPM_CONFIG_USERCONFIG: join(home, 'npmrc'), NPM_CONFIG_GLOBALCONFIG: join(home, 'npm-globalrc'),
    NPM_CONFIG_CACHE: join(home, 'npm-cache'), NPM_CONFIG_REGISTRY: registry, NPM_CONFIG_UPDATE_NOTIFIER: 'false',
    TMPDIR: join(home, 'tmp'), TMP: join(home, 'tmp'), TEMP: join(home, 'tmp'),
    CI: '1', NO_COLOR: '1', LANG: 'C.UTF-8',
  };
}

/** Capture bounded command evidence and terminate the whole subprocess tree on timeout. */
async function command(program, args, { cwd, env, log, timeout = 180000 }) {
  const child = spawn(program, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32', windowsHide: true });
  let stdout = '', stderr = '', timedOut = false;
  const limit = 4 * 1024 * 1024;
  child.stdout.on('data', bytes => { stdout = (stdout + bytes).slice(-limit); });
  child.stderr.on('data', bytes => { stderr = (stderr + bytes).slice(-limit); });
  const timer = setTimeout(() => {
    timedOut = true;
    if (process.platform === 'win32') child.kill('SIGKILL');
    else { try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } }
  }, timeout);
  const result = await new Promise((done, fail) => { child.once('error', fail); child.once('close', (code, signal) => done({ code, signal })); }).finally(() => clearTimeout(timer));
  await save(log, { program, args, cwd, ...result, timedOut, stdout, stderr });
  assert.equal(timedOut, false, `Command timed out; see ${log}`);
  assert.equal(result.code, 0, `Command failed; see ${log}\n${stderr.slice(-1500)}`);
  return stdout;
}

async function installRuntime(runtime, env, evidence) {
  await mkdir(runtime, { recursive: true });
  const dependencies = Object.fromEntries(runtimePackages.map(name => ['@deepseek-ai/' + name, runtimeVersion]));
  const metadata = [];
  for (const [name, version] of Object.entries(dependencies)) {
    const response = await fetch(`${registry}/${encodeURIComponent(name)}/${version}`, { signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200, `Cannot read official package metadata for ${name}@${version}`);
    const pkg = await response.json();
    metadata.push({ name, version: pkg.version, unpacked_bytes: pkg.dist?.unpackedSize, dependencies: pkg.dependencies, peer_dependencies: pkg.peerDependencies });
  }
  await save(join(evidence, 'runtime-metadata.json'), metadata);
  await save(join(runtime, 'package.json'), { name: 'ntfyx-dsh-test-runtime', private: true, type: 'module', dependencies });
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const npmFlags = ['--ignore-scripts', '--no-audit', '--no-fund', `--registry=${registry}`];
  console.log('Planning the minimal published DSH runtime.');
  await command(npm, ['install', '--package-lock-only', ...npmFlags], { cwd: runtime, env, log: join(evidence, 'runtime-plan.json') });
  const lock = await json(join(runtime, 'package-lock.json'));
  const count = Object.keys(lock.packages).length - 1;
  await save(join(evidence, 'runtime-plan-summary.json'), { package_count: count, root_packages: metadata, install_scripts_enabled: false });
  assert.ok(count <= 250, `Runtime resolves ${count} packages; inspect the plan before installing a larger runtime.`);
  console.log(`Installing ${count} runtime packages with install scripts disabled.`);
  await command(npm, ['ci', ...npmFlags], { cwd: runtime, env, log: join(evidence, 'runtime-install.json') });
}

/** Run inside the isolated environment; the actual bundle patch remains unchanged. */
async function worker({ runtime, evidence, bundle, ntfyx }) {
  const require = createRequire(join(runtime, 'package.json'));
  const importPackage = name => import(pathToFileURL(require.resolve(name)).href);
  const boot = await importPackage('@deepseek-ai/dsh-app-boot');
  assert.equal(boot.getDshRuntimeVersion(), runtimeVersion, 'Runtime differs from the declared tested DSH release');
  const profileDir = join(process.env.DSH_HOME, 'profiles', 'ntfyx-smoke');
  await mkdir(profileDir, { recursive: true });
  const manifest = await json(join(bundle, 'package.json'));
  assert.equal(manifest.name, 'dsh-plugin-ntfyx');
  await save(join(profileDir, 'package.json'), { name: 'ntfyx-dsh-smoke-profile', private: true, type: 'module', dsh: { profile: { bundles: [manifest.name] } } });
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const packed = JSON.parse(await command(npm, ['pack', bundle, '--ignore-scripts', '--json', '--pack-destination', evidence], { cwd: profileDir, env: process.env, log: join(evidence, 'bundle-pack.json') }))[0];
  const tarball = join(evidence, packed.filename);
  await command(npm, ['install', tarball, '--ignore-scripts', '--legacy-peer-deps', '--no-audit', '--no-fund', `--registry=${registry}`], { cwd: profileDir, env: process.env, log: join(evidence, 'bundle-install.json') });
  const profile = boot.loadProfileDirectory('ntfyx-dsh-test', profileDir, join(runtime, 'package.json'));
  assert.deepEqual(profile.skippedBundles, [], 'DSH refused the installed bundle');
  assert.deepEqual(profile.layers.map(layer => layer.packageName), [manifest.name]);
  const patches = profile.layers.flatMap(layer => layer.patches);
  const rows = boot.composeEntries([patches]);
  assert.deepEqual(new Set(rows.map(row => row.name)), new Set(['@deepseek-ai/dsh-mcp-client', '@deepseek-ai/dsh-skill-filesystem']));
  assert.equal(rows.find(row => row.id === 'ntfyx-mcp')?.config.command, 'ntfyx');
  assert.deepEqual(rows.find(row => row.id === 'ntfyx-mcp')?.config.args, ['mcp']);
  await save(join(evidence, 'composed-bundle-rows.json'), rows);
  const installed = join(profileDir, 'node_modules', manifest.name);
  for (const file of packed.files) {
    assert.equal(hash(await readFile(join(installed, file.path))), hash(await readFile(join(bundle, file.path))), `Installed ${file.path} differs from source`);
  }
  const configuration = join(profileDir, 'cordis.yml');
  await writeFile(configuration, [
    '- id: system-prompt', "  name: '@deepseek-ai/dsh-system-prompt'",
    '- id: tools', "  name: '@deepseek-ai/dsh-tools'",
    '- id: executor', "  name: '@deepseek-ai/dsh-tool-executor-native'",
    '- id: skills', "  name: '@deepseek-ai/dsh-skill'", '',
  ].join('\n'));
  const ctx = await boot.boot('ntfyx-dsh-test', configuration, patches, undefined, pathToFileURL(join(runtime, 'package.json')).href);
  try {
    const toolNames = ctx.tools.schemas().map(tool => tool.name);
    const validationName = 'mcp__ntfyx__ntfyx_validate_message';
    assert.ok(toolNames.includes(validationName), 'Real MCP tools/list did not register local validation');
    assert.ok(toolNames.includes('mcp__ntfyx__ntfyx_send'), 'Expected Ntfyx MCP tool list is incomplete');
    const sample = { title: 'DSH 本地验证', summary: 'No notification sent', content: { version: 1, format: 'markdown', text: '**Local validation only.**' } };
    const batch = await ctx.tools.execute({ calls: [{ type: 'tool-call', id: 'ntfyx-dsh-local-validation', name: validationName, arguments: JSON.stringify(sample) }], signal: AbortSignal.timeout(30000) });
    const result = batch.results[0]?.result;
    assert.ok(result && !result.isError, 'DSH MCP local validation failed');
    const validated = JSON.parse(result.content.find(item => item.type === 'text').text);
    assert.equal(validated.valid, true);
    assert.deepEqual(validated.message, { type: 'message', title: sample.title, body: sample.summary, content: sample.content });
    const skills = await ctx.skills.snapshot({ cwd: profileDir });
    assert.equal(skills.complete, true, 'Skill catalog is incomplete');
    const skill = skills.skills.find(item => item.name === 'ntfyx');
    assert.ok(skill, 'Packaged Ntfyx skill was not discovered');
    assert.equal(skill.provider, 'ntfyx');
    assert.equal(skill.invocation.modelInvocable, true);
    assert.equal(skill.invocation.userInvocable, true);
    const definition = await ctx.skills.get('ntfyx', { cwd: profileDir });
    assert.ok(definition?.content.length > 100, 'Packaged skill body is missing');
    assert.ok(definition.path?.startsWith(join(installed, 'skills')), 'Skill resolved outside the installed bundle');
    const identities = await json(join(evidence, 'mcp-config.json'));
    assert.deepEqual(identities.profiles, {}, 'Local validation unexpectedly created a paired identity');
    const details = {
      dsh_version: boot.getDshRuntimeVersion(), plugin: { name: manifest.name, version: manifest.version, tarball_sha256: hash(await readFile(tarball)), files: packed.files.map(file => file.path) },
      installation: 'npm-packed tarball installed into an isolated DSH profile; official loadProfileDirectory and boot applied its bundle layer',
      tool_names: toolNames, local_validation: validated,
      skill: { name: skill.name, provider: skill.provider, path: definition.path, content_sha256: hash(definition.content), content_bytes: Buffer.byteLength(definition.content) },
      ntfyx_binary: { path: ntfyx, sha256: hash(await readFile(ntfyx)) },
      model_called: false, notification_sent: false, production_credentials_used: false, cli_forwarder_tested: false,
    };
    await save(join(evidence, 'runtime-result.json'), details);
    console.log('Real DSH Loader, Ntfyx MCP discovery/local validation, and installed skill discovery passed.');
  } finally { await ctx.fiber.dispose(); }
}

async function main() {
  const config = options(process.argv.slice(2));
  assert.ok(Number(process.versions.node.split('.')[0]) >= 24, 'Use Node 24 or newer');
  if (!config.ntfyx) {
    for (const directory of (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':')) {
      const candidate = join(directory, process.platform === 'win32' ? 'ntfyx.exe' : 'ntfyx');
      try { await access(candidate); config.ntfyx = candidate; break; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  assert.ok(config.ntfyx, 'Install Ntfyx first or pass --ntfyx /absolute/path/to/ntfyx');
  await access(config.ntfyx);
  await access(join(config.bundle, 'package.json'));
  await mkdir(config.output, { recursive: true });
  const evidence = join(config.output, 'runs', new Date().toISOString().replace(/[:.]/g, '-'));
  const home = join(evidence, 'home'), bin = join(evidence, 'bin');
  for (const path of [evidence, bin, home, join(home, 'tmp')]) await mkdir(path, { recursive: true, mode: 0o700 });
  for (const path of [join(home, 'npmrc'), join(home, 'npm-globalrc')]) await writeFile(path, '', { mode: 0o600 });
  const env = environment(home, bin);
  const runtime = config.runtime ?? join(config.output, 'runtime');
  const reportPath = join(config.output, 'report.json');
  const report = { status: 'failed', timestamp: new Date().toISOString(), evidence, runtime, node: process.version, model_called: false, notification_sent: false, production_credentials_used: false };
  try {
    if (!config.runtime) await installRuntime(runtime, env, evidence);
    const configPath = join(evidence, 'mcp-config.json');
    await save(configPath, { version: 1, profiles: {} });
    const launches = join(evidence, 'mcp-launches.jsonl');
    const wrapper = '#!/usr/bin/env node\n' + [
      "import {spawn} from 'node:child_process';import {appendFileSync} from 'node:fs';",
      "if(JSON.stringify(process.argv.slice(2))!==JSON.stringify(['mcp']))throw Error('Only MCP startup is permitted');",
      `appendFileSync(${JSON.stringify(launches)},JSON.stringify({argv:['mcp','--config','isolated'],timestamp:new Date().toISOString()})+'\\n');`,
      `const child=spawn(${JSON.stringify(config.ntfyx)},['mcp','--config',${JSON.stringify(configPath)}],{env:process.env,stdio:'inherit'});`,
      "for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));child.on('error',e=>{console.error(e.message);process.exitCode=1;});child.on('exit',(code)=>{process.exitCode=code??1;});", '',
    ].join('\n');
    await writeFile(join(bin, 'ntfyx'), wrapper, { mode: 0o700 });
    await chmod(join(bin, 'ntfyx'), 0o700);
    assert.notEqual(process.platform, 'win32', 'This smoke harness currently needs a POSIX executable wrapper');
    const workerInput = { ...config, runtime, evidence };
    await save(join(evidence, 'worker-input.json'), workerInput);
    console.log('Running the packed bundle against a real unpaired Ntfyx MCP process.');
    await command(process.execPath, [fileURLToPath(import.meta.url), '--worker', join(evidence, 'worker-input.json')], { cwd: evidence, env, log: join(evidence, 'worker.json'), timeout: 240000 });
    report.status = 'passed';
    report.details = await json(join(evidence, 'runtime-result.json'));
    report.mcp_process_launches = (await readFile(launches, 'utf8')).trim().split('\n').length;
  } catch (error) {
    report.error = error.stack ?? String(error);
    process.exitCode = 1;
  } finally {
    await save(reportPath, report);
    console.log(JSON.stringify({ status: report.status, report: reportPath, evidence }));
    if (report.error) console.error(report.error);
  }
}

if (process.argv[2] === '--worker') {
  await worker(await json(process.argv[3]));
} else {
  await main();
}
