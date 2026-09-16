# Metadata local MCP bundle

This stdio adapter connects to https://mcp-server.metadata.io/mcp using your own Metadata personal access token. It requires Node.js 20 or newer and an existing Metadata account with MCP access. Enter the token in the host's sensitive connector setting; never paste it into chat. Account permissions and Metadata service charges still apply.

The adapter fetches current tools, prompts, and resources from Metadata at runtime. Requests and returned data travel directly between the local process and Metadata over HTTPS. It does not store credentials, read local files, open a local network port, or start a background service. The host is responsible for securely storing the sensitive setting.

Start with `get_account_details` and verify the workspace. Reporting does not authorize campaign changes, launches, spending, or account switching. Creative generation may consume account allowances. Tool execution errors are returned to the host. Resource subscriptions, task APIs, and server-initiated requests are not exposed by this adapter.

## Build

Run `npm ci --ignore-scripts --omit=dev` in this directory, then `npx @anthropic-ai/mcpb@2.1.2 validate manifest.json` and `npx @anthropic-ai/mcpb@2.1.2 pack . /absolute/output/metadata-mcp-connector.mcpb`. The bundle includes pinned production dependencies and requires no package download during startup.

Before publishing a changed adapter, run `METADATA_MCP_TOKEN=... node scripts/smoke.mjs` with the token supplied securely by your environment. This performs discovery and one account-identity read; it never calls campaign or advertising write tools. Review the returned account identity before further use.

Privacy: https://metadata.io/privacy-policy
Support: https://help.metadata.io
