import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';

const bundleRoot = process.env.METADATA_BUNDLE_DIR ?? fileURLToPath(new URL('../', import.meta.url));
const entry = resolve(bundleRoot, 'server/index.mjs');
const empty = spawnSync(process.execPath, [entry], { env: getDefaultEnvironment(), encoding: 'utf8', timeout: 10000 });
assert.equal(empty.status, 1, 'Missing token must stop startup');
assert.equal(empty.stdout, '', 'Missing token must not produce protocol data');
assert.match(empty.stderr, /Set your Metadata personal access token/);
assert.ok(process.env.METADATA_MCP_TOKEN, 'Provide a token securely in the environment');

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [entry],
  env: { ...getDefaultEnvironment(), METADATA_MCP_TOKEN: process.env.METADATA_MCP_TOKEN },
  stderr: 'pipe',
});
let stderr = '';
transport.stderr?.on('data', chunk => { stderr += chunk; });
const client = new Client({ name: 'metadata-bundle-smoke', version: '1.0.0' });
try {
  await client.connect(transport);
  const tools = [];
  let cursor;
  do {
    const page = await client.listTools(cursor ? { cursor } : undefined);
    tools.push(...page.tools);
    cursor = page.nextCursor;
  } while (cursor);
  assert.ok(tools.some(tool => tool.name === 'get_account_details'));
  assert.ok(tools.every(tool => tool.inputSchema?.type === 'object'));
  const identity = await client.callTool({ name: 'get_account_details', arguments: {} });
  assert.ok(!identity.isError, 'Identity read must succeed');
  const text = identity.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
  assert.ok(!text.includes(process.env.METADATA_MCP_TOKEN), 'Response must not contain the credential');
  assert.ok(!stderr.includes(process.env.METADATA_MCP_TOKEN), 'Logs must not contain the credential');
  const capabilities = client.getServerCapabilities();
  const resources = capabilities.resources ? (await client.listResources()).resources : [];
  const prompts = capabilities.prompts ? (await client.listPrompts()).prompts : [];
  if (process.env.METADATA_SCHEMA_OUTPUT) {
    await writeFile(process.env.METADATA_SCHEMA_OUTPUT, JSON.stringify({ serverInfo: client.getServerVersion(), tools, resources, prompts }, null, 2) + '\n');
  }
  console.log(JSON.stringify({
    bundleRoot, timestamp: new Date().toISOString(), tools: tools.length,
    resources: resources.length, prompts: prompts.length,
    calls: ['get_account_details'], writeToolCalls: 0, missingTokenRejected: true,
    identity: text,
  }, null, 2));
} finally {
  await client.close();
}
