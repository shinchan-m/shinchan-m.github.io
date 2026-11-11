import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

if (!process.argv[2]) {
  console.error('Usage: node reproduce.mjs <m365-copilot-proxy-path> [results.json]');
  process.exit(2);
}
const root = resolve(process.argv[2]);
const reportFile = process.argv[3];
const expectedCommit = '65905e881d6597040966aff9b087aa9a908b358a';
const targetCommit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (targetCommit !== expectedCommit) throw new Error('Target repository must be at ' + expectedCommit);
const sourceHashes = {};
function source(path) {
  const bytes = readFileSync(join(root, path));
  sourceHashes[path] = createHash('sha256').update(bytes).digest('hex');
  return bytes.toString('utf8');
}
const dataModule = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
const findings = {};

// Run the original live test body against deliberately non-agentic local responses.
// Only the test runner and app imports are replaced. No model command is executed.
const tests = [];
let posts = 0;
const describe = Object.assign((_name, run) => run(), {
  skipIf: skip => (_name, run) => { if (!skip) run(); },
});
globalThis.__researchHarness = {
  describe,
  it: (name, run) => tests.push({ name, run }),
  expect: actual => ({
    toBe: expected => assert.equal(actual, expected),
    toBeTruthy: () => assert.ok(actual),
    toBeGreaterThan: expected => assert.ok(actual > expected),
  }),
};
globalThis.__researchApp = {
  createApp: () => ({
    fetch: async request => {
      const path = new URL(request.url).pathname;
      if (path === '/v1/chat/completions') {
        posts++;
        return Response.json({ choices: [{ finish_reason: 'stop', message: {
          role: 'assistant', content: 'I can explain this, but I did not run any tool.',
        } }] });
      }
      if (path === '/v1/models') return Response.json({ object: 'list', data: [{ id: 'offline-fixture' }] });
      if (path === '/health') return Response.json({ status: 'ok' });
      throw new Error('Unexpected route in offline test');
    },
  }),
};
const previousLiveFlag = process.env.M365_LIVE;
try {
  process.env.M365_LIVE = '1';
  let suite = source('packages/proxy-lib/src/index.test.ts');
  suite = suite.replace('import { describe, it, expect } from "vitest";',
    'const { describe, it, expect } = globalThis.__researchHarness;');
  suite = suite.replace('import { createApp } from "./index.js";',
    'const { createApp } = globalThis.__researchApp;');
  await import(dataModule(stripTypeScriptTypes(suite)));
  const passed = [];
  for (const test of tests) { await test.run(); passed.push(test.name); }
  findings.liveTestCounterexample = { passed: passed.length, testNames: passed,
    chatRequests: posts, toolCalls: 0, executedTools: 0,
    scope: 'Original test assertions with a local fake app; not an upstream success-rate test.' };
  assert.equal(posts, 1);
  assert.equal(passed.length, 3);
} finally {
  if (previousLiveFlag === undefined) delete process.env.M365_LIVE;
  else process.env.M365_LIVE = previousLiveFlag;
  delete globalThis.__researchHarness;
  delete globalThis.__researchApp;
}

// Execute the original mapping function and constants, without loading authentication.
const routingSource = source('packages/core/src/copilot.ts');
const mapping = routingSource.slice(routingSource.indexOf('const MODEL_TONES:'),
  routingSource.indexOf('export function getToneForModel'));
const routing = routingSource.slice(routingSource.indexOf('export function getToneForModel'),
  routingSource.indexOf('// --- Scenario / licenseType routing'));
const patterns = routingSource.match(/^const SONNET_5(?:_5)?_PATTERN = .*;$/gm).join('\n');
const routingJs = stripTypeScriptTypes(mapping + '\n' + patterns + '\n' + routing)
  .replace('export function', 'function');
const getToneForModel = new Function(routingJs + '\nreturn getToneForModel;')();
findings.modelRouting = ['arbitrary-nonexistent-model', 'claude-entirely-made-up-model',
  'claude-sonnet-4.5', 'claude-sonnet-4.6', 'claude-opus-4.5', 'claude-opus-4.8']
  .map(model => ({ requestedModel: model, upstreamTone: getToneForModel(model) }));
assert.equal(getToneForModel('arbitrary-nonexistent-model'), 'magic');
assert.equal(getToneForModel('claude-entirely-made-up-model'), 'Claude_Sonnet');

// Execute the original advertised capability builder with a fixture model list.
const indexSource = source('packages/proxy-lib/src/index.ts');
const payloadSource = indexSource.slice(indexSource.indexOf('const CONTEXT_WINDOW_TOKENS'),
  indexSource.indexOf('// --- CORS'));
const payloadJs = stripTypeScriptTypes(payloadSource).replace('export function', 'function');
const fixtureEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  !['M365_CONTEXT_WINDOW', 'M365_MAX_OUTPUT_TOKENS'].includes(key)));
const buildModelsPayload = new Function('getAvailableModels', 'process',
  payloadJs + '\nreturn buildModelsPayload;')(() => ['offline-fixture'], { env: fixtureEnv });
findings.advertisedCapabilities = buildModelsPayload().data[0];
assert.equal(findings.advertisedCapabilities.max_output_tokens, 1000000);

// Run the original tool parser. Logging is disabled; model routing is replaced
// with a throwing stub to ensure this experiment stays within pure parsing.
const logUrl = dataModule('export function createLogger(){return {info(){},error(){},debug(){},warn(){}};}');
const routeUrl = dataModule('export function getToneForModel(){throw Error("Unexpected route use");} export function isSonnet55Model(){throw Error("Unexpected route use");}');
let fenced = stripTypeScriptTypes(source('packages/core/src/fenced.ts'));
fenced = fenced.replace('"./log.js"', JSON.stringify(logUrl))
  .replace('"./copilot.js"', JSON.stringify(routeUrl));
let toolsSource = stripTypeScriptTypes(source('packages/core/src/tools.ts'));
toolsSource = toolsSource.replace('"./log.js"', JSON.stringify(logUrl))
  .replace('"./fenced.js"', JSON.stringify(dataModule(fenced)));
const { parseToolCalls, isProseDocument } = await import(dataModule(toolsSource));
const tools = [{ type: 'function', function: { name: 'shell', parameters: {
  type: 'object', properties: { command: { type: 'string' } }, required: ['command'],
} } }];
findings.toolParsing = [
  ['explicit-fence', '```bash\nprintf hello\n```'],
  ['completion-claim', 'I already fixed the file successfully.'],
  ['short-advice-with-fence', 'You can run this command:\n```bash\nls -la\n```'],
].map(([sample, raw]) => {
  const parsed = parseToolCalls(raw, tools);
  return { sample, raw, hasToolCalls: parsed.hasToolCalls,
    toolCalls: parsed.toolCalls.map(call => ({ name: call.function.name,
      arguments: JSON.parse(call.function.arguments) })),
    remainingText: parsed.textContent, classifiedAsProseDocument: isProseDocument(parsed, raw, tools) };
});
assert.equal(findings.toolParsing[0].toolCalls[0].name, 'shell');
assert.equal(findings.toolParsing[1].toolCalls.length, 0);
assert.equal(findings.toolParsing[2].toolCalls[0].arguments.command, 'ls -la');

const report = { timestamp: new Date().toISOString(), node: process.version,
  upstreamRequests: 0, actualToolExecutions: 0, targetCommit, sourceHashes, findings };
if (reportFile) writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
