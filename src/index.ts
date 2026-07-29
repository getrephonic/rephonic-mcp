import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { ApiKeyHandler } from "./api-key-handler";
import { registerRephonicTools } from "./tools";

type Props = {
	apiKey: string;
};

const BASE_URL = "https://api.rephonic.com";

export class MyMCP extends McpAgent<Env, Record<string, never>, Props> {
	server = new McpServer({
		name: "Rephonic",
		version: "1.0.0",
	});

	private async apiFetch(path: string, params?: Record<string, string | undefined>) {
		const url = new URL(`${BASE_URL}${path}`);
		if (params) {
			for (const [k, v] of Object.entries(params)) {
				if (v !== undefined && v !== "") url.searchParams.set(k, v);
			}
		}
		const resp = await fetch(url.toString(), {
			headers: {
				"X-Rephonic-Api-Key": this.props!.apiKey,
				"X-Rephonic-Api-Version": "1.1",
			},
		});
		if (!resp.ok) {
			const text = await resp.text();
			return { content: [{ type: "text" as const, text: `Error ${resp.status}: ${text}` }], isError: true };
		}
		const data = await resp.json();
		return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
	}

	async init() {
		registerRephonicTools(this.server, (path, params) => this.apiFetch(path, params));
	}
}

const provider = new OAuthProvider({
	apiHandler: MyMCP.serve("/mcp"),
	apiRoute: "/mcp",
	authorizeEndpoint: "/authorize",
	clientRegistrationEndpoint: "/register",
	defaultHandler: ApiKeyHandler as any,
	tokenEndpoint: "/token",
});

// Wrap the provider so users can connect with just https://mcp.rephonic.com
// without apiRoute "/" catching /authorize and /submit-api-key
export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);
		if (url.pathname === "/") {
			const rewritten = new Request(new URL("/mcp", url.origin).toString(), request);
			return provider.fetch(rewritten, env, ctx);
		}
		return provider.fetch(request, env, ctx);
	},
};
