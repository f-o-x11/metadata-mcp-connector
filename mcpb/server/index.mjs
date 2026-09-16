import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema, ListToolsResultSchema,
  CallToolRequestSchema, CallToolResultSchema,
  ListResourcesRequestSchema, ListResourcesResultSchema,
  ListResourceTemplatesRequestSchema, ListResourceTemplatesResultSchema,
  ReadResourceRequestSchema, ReadResourceResultSchema,
  ListPromptsRequestSchema, ListPromptsResultSchema,
  GetPromptRequestSchema, GetPromptResultSchema,
} from '@modelcontextprotocol/sdk/types.js';

const token = process.env.METADATA_MCP_TOKEN?.trim();
if (!token || token.includes('${') || /[\r\n]/.test(token)) {
  console.error('Set your Metadata personal access token in the connector settings.');
  process.exit(1);
}

const upstream = new Client({ name: 'metadata-mcp-bundle', version: '1.0.0' });
const transport = new StreamableHTTPClientTransport(
  new URL('https://mcp-server.metadata.io/mcp'),
  { requestInit: { headers: { Authorization: token } } },
);
let server;
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await Promise.allSettled([upstream.close(), server?.close()]);
}
process.on('SIGINT', () => close().finally(() => process.exit(0)));
process.on('SIGTERM', () => close().finally(() => process.exit(0)));

try {
  await upstream.connect(transport);
  const available = upstream.getServerCapabilities() ?? {};
  const capabilities = {};
  for (const name of ['tools', 'resources', 'prompts']) {
    if (available[name]) capabilities[name] = {};
  }
  server = new Server(
    { name: 'metadata-mcp-connector', title: 'Metadata MCP Connector', version: '1.0.0' },
    { capabilities, instructions: 'Check get_account_details before other calls. Use the intended workspace. Reporting and planning do not authorize changes, launches, or spending. ' + (upstream.getInstructions() ?? '') },
  );
  const routes = [
    ['tools', ListToolsRequestSchema, ListToolsResultSchema],
    ['tools', CallToolRequestSchema, CallToolResultSchema],
    ['resources', ListResourcesRequestSchema, ListResourcesResultSchema],
    ['resources', ListResourceTemplatesRequestSchema, ListResourceTemplatesResultSchema],
    ['resources', ReadResourceRequestSchema, ReadResourceResultSchema],
    ['prompts', ListPromptsRequestSchema, ListPromptsResultSchema],
    ['prompts', GetPromptRequestSchema, GetPromptResultSchema],
  ];
  for (const [capability, requestSchema, resultSchema] of routes) {
    if (capabilities[capability]) {
      server.setRequestHandler(requestSchema, (request, extra) =>
        upstream.request(request, resultSchema, { signal: extra.signal, timeout: 180000 }),
      );
    }
  }
  const stdio = new StdioServerTransport();
  server.onclose = close;
  await server.connect(stdio);
} catch {
  console.error('Metadata connection failed. Check your token, account access, and network connection.');
  await close();
  process.exit(1);
}
