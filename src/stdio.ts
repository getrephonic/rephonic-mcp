// Local stdio MCP server. The Worker (index.ts) is the real deployment; this
// entrypoint exists so the server can also run as a plain process (e.g. Glama's
// Docker build harness, which wraps a stdio server with mcp-proxy). It shares
// the tool definitions in tools.ts and reads the API key from the environment
// instead of the OAuth flow.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerRephonicTools, type ToolResult } from "./tools";

declare const process: {
	env: Record<string, string | undefined>;
	exit(code?: number): never;
};

const BASE_URL = "https://api.rephonic.com";
const API_KEY = process.env.REPHONIC_API_KEY ?? "";

async function apiFetch(
	path: string,
	params?: Record<string, string | undefined>,
): Promise<ToolResult> {
	const url = new URL(`${BASE_URL}${path}`);
	if (params) {
		for (const [k, v] of Object.entries(params)) {
			if (v !== undefined && v !== "") url.searchParams.set(k, v);
		}
	}
	const resp = await fetch(url.toString(), {
		headers: {
			"X-Rephonic-Api-Key": API_KEY,
			"X-Rephonic-Api-Version": "1.1",
		},
	});
	if (!resp.ok) {
		const text = await resp.text();
		return {
			content: [{ type: "text", text: `Error ${resp.status}: ${text}` }],
			isError: true,
		};
	}
	const data = await resp.json();
	return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

const server = new McpServer({ name: "Rephonic", version: "1.0.0" });
registerRephonicTools(server, apiFetch);

// No top-level await: tsx transpiles this to CommonJS (package.json has no
// "type": "module"), which disallows it. connect() keeps the process alive by
// listening on stdin, so firing it and handling errors is enough.
server.connect(new StdioServerTransport()).catch((err) => {
	console.error(err);
	process.exit(1);
});
