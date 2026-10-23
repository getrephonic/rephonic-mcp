import type {
  AuthRequest,
  OAuthHelpers,
} from "@cloudflare/workers-oauth-provider";
import { env } from "cloudflare:workers";
import { Hono } from "hono";
import {
  addApprovedClient,
  bindStateToSession,
  createOAuthState,
  generateCSRFProtection,
  isClientApproved,
  OAuthError,
  validateCSRFToken,
  validateOAuthState,
} from "./workers-oauth-utils";

const app = new Hono<{ Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers } }>();

app.get("/authorize", async (c) => {
  const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  const { clientId } = oauthReqInfo;
  if (!clientId) {
    return c.text("Invalid request", 400);
  }

  // If the client was already approved, skip straight to the API key form
  if (await isClientApproved(c.req.raw, clientId, env.COOKIE_ENCRYPTION_KEY)) {
    const { stateToken } = await createOAuthState(oauthReqInfo, c.env.OAUTH_KV);
    const { setCookie: sessionBindingCookie } =
      await bindStateToSession(stateToken);
    return renderApiKeyForm(stateToken, { "Set-Cookie": sessionBindingCookie });
  }

  const { token: csrfToken, setCookie } = generateCSRFProtection();

  return renderApprovalPage(c.req.raw, {
    client: await c.env.OAUTH_PROVIDER.lookupClient(clientId),
    csrfToken,
    setCookie,
    state: { oauthReqInfo },
  });
});

// Step 1: User approves the MCP client → show the API key form
app.post("/authorize", async (c) => {
  try {
    const formData = await c.req.raw.formData();
    validateCSRFToken(formData, c.req.raw);

    const encodedState = formData.get("state");
    if (!encodedState || typeof encodedState !== "string") {
      return c.text("Missing state in form data", 400);
    }

    let state: { oauthReqInfo?: AuthRequest };
    try {
      state = JSON.parse(atob(encodedState));
    } catch (_e) {
      return c.text("Invalid state data", 400);
    }

    if (!state.oauthReqInfo || !state.oauthReqInfo.clientId) {
      return c.text("Invalid request", 400);
    }

    const approvedClientCookie = await addApprovedClient(
      c.req.raw,
      state.oauthReqInfo.clientId,
      c.env.COOKIE_ENCRYPTION_KEY,
    );

    const { stateToken } = await createOAuthState(
      state.oauthReqInfo,
      c.env.OAUTH_KV,
    );
    const { setCookie: sessionBindingCookie } =
      await bindStateToSession(stateToken);

    const headers = new Headers();
    headers.append("Set-Cookie", approvedClientCookie);
    headers.append("Set-Cookie", sessionBindingCookie);

    return renderApiKeyForm(stateToken, Object.fromEntries(headers));
  } catch (error: any) {
    if (error instanceof OAuthError) {
      return error.toResponse();
    }
    return c.text(`Internal server error: ${error.message}`, 500);
  }
});

// Step 2: User submits their Rephonic API key → complete the OAuth flow
app.post("/submit-api-key", async (c) => {
  try {
    const formData = await c.req.raw.formData();
    const apiKey = formData.get("api_key");
    const stateToken = formData.get("state");

    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      return c.text("API key is required", 400);
    }

    if (!stateToken || typeof stateToken !== "string") {
      return c.text("Missing state", 400);
    }

    // Verify the API key works before completing the OAuth flow
    const quotaResp = await fetch("https://api.rephonic.com/api/accounts/quota/", {
      headers: {
        "X-Rephonic-Api-Key": apiKey.trim(),
        "X-Origin-Auth": c.env.ORIGIN_SECRET,
      },
    });
    if (!quotaResp.ok) {
      return renderApiKeyForm(stateToken, {}, "Invalid API key. Please check your key and try again.");
    }

    // Validate the state token and get the original OAuth request
    // We need to reconstruct a request with the state as a query param
    const fakeUrl = new URL(c.req.url);
    fakeUrl.searchParams.set("state", stateToken);
    const fakeRequest = new Request(fakeUrl.toString(), {
      headers: c.req.raw.headers,
    });

    let oauthReqInfo: AuthRequest;
    let clearSessionCookie: string;

    try {
      const result = await validateOAuthState(fakeRequest, c.env.OAUTH_KV);
      oauthReqInfo = result.oauthReqInfo;
      clearSessionCookie = result.clearCookie;
    } catch (error: any) {
      if (error instanceof OAuthError) {
        return error.toResponse();
      }
      return c.text("Internal server error", 500);
    }

    if (!oauthReqInfo.clientId) {
      return c.text("Invalid OAuth request data", 400);
    }

    // Complete the authorization with the API key stored in props
    const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
      metadata: {
        label: "Rephonic API Key User",
      },
      props: {
        apiKey: apiKey.trim(),
      },
      request: oauthReqInfo,
      scope: oauthReqInfo.scope,
      userId: "api-key-user",
    });

    const headers = new Headers({ Location: redirectTo });
    if (clearSessionCookie) {
      headers.set("Set-Cookie", clearSessionCookie);
    }

    return new Response(null, { status: 302, headers });
  } catch (error: any) {
    return c.text(`Internal server error: ${error.message}`, 500);
  }
});

function renderApiKeyForm(
  stateToken: string,
  extraHeaders: Record<string, string> = {},
  error?: string,
): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Rephonic MCP - Enter API Key</title>
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
			line-height: 1.6;
			color: #333;
			background-color: #f9fafb;
			margin: 0;
			padding: 0;
		}
		.container {
			max-width: 500px;
			margin: 4rem auto;
			padding: 1rem;
		}
		.card {
			background: #fff;
			border-radius: 8px;
			box-shadow: 0 8px 36px 8px rgba(0,0,0,0.1);
			padding: 2rem;
		}
		h1 {
			font-size: 1.4rem;
			margin: 0 0 0.5rem 0;
			text-align: center;
		}
		p {
			color: #555;
			font-size: 0.95rem;
			text-align: center;
		}
		label {
			display: block;
			font-weight: 500;
			margin-bottom: 0.5rem;
			margin-top: 1.5rem;
		}
		input[type="text"] {
			width: 100%;
			padding: 0.75rem;
			border: 1px solid #d1d5db;
			border-radius: 6px;
			font-size: 1rem;
			font-family: SFMono-Regular, Menlo, Monaco, Consolas, monospace;
			box-sizing: border-box;
		}
		input[type="text"]:focus {
			outline: none;
			border-color: #0070f3;
			box-shadow: 0 0 0 3px rgba(0,112,243,0.1);
		}
		button {
			width: 100%;
			padding: 0.75rem;
			background: #0070f3;
			color: white;
			border: none;
			border-radius: 6px;
			font-size: 1rem;
			font-weight: 500;
			cursor: pointer;
			margin-top: 1.5rem;
		}
		button:hover {
			background: #005cc5;
		}
		.help {
			text-align: center;
			margin-top: 1rem;
			font-size: 0.85rem;
			color: #888;
		}
		.help a {
			color: #0070f3;
		}
		.error {
			background: #fef2f2;
			border: 1px solid #fecaca;
			color: #dc2626;
			padding: 0.75rem;
			border-radius: 6px;
			font-size: 0.9rem;
			margin-bottom: 0.5rem;
			text-align: center;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="card">
			<h1>Rephonic MCP Server</h1>
			<p>Enter your Rephonic API key to connect. You can find it on your <a href="https://rephonic.com/account/settings">account page</a>.</p>
			${error ? `<div class="error">${error}</div>` : ""}
			<form method="post" action="/submit-api-key">
				<input type="hidden" name="state" value="${stateToken}">
				<label for="api_key">API Key</label>
				<input type="text" id="api_key" name="api_key" placeholder="Paste your Rephonic API key" required autocomplete="off">
				<button type="submit">Connect</button>
			</form>
			<div class="help">
				<a href="https://rephonic.com/developers" target="_blank" rel="noopener noreferrer">Get an API key</a>
			</div>
		</div>
	</div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "frame-ancestors 'none'",
      "X-Frame-Options": "DENY",
      ...extraHeaders,
    },
  });
}

function renderApprovalPage(
  request: Request,
  options: {
    client: any;
    csrfToken: string;
    setCookie: string;
    state: Record<string, any>;
  },
): Response {
  const { client, csrfToken, setCookie, state } = options;
  const encodedState = btoa(JSON.stringify(state));
  const clientName = client?.clientName || "An MCP Client";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Authorize | Rephonic MCP</title>
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
			line-height: 1.6;
			color: #333;
			background-color: #f9fafb;
			margin: 0;
			padding: 0;
		}
		.container {
			max-width: 500px;
			margin: 4rem auto;
			padding: 1rem;
		}
		.card {
			background: #fff;
			border-radius: 8px;
			box-shadow: 0 8px 36px 8px rgba(0,0,0,0.1);
			padding: 2rem;
			text-align: center;
		}
		h1 { font-size: 1.4rem; margin: 0 0 1rem 0; }
		p { color: #555; }
		.actions {
			display: flex;
			gap: 1rem;
			justify-content: center;
			margin-top: 2rem;
		}
		.btn {
			padding: 0.75rem 1.5rem;
			border-radius: 6px;
			font-size: 1rem;
			font-weight: 500;
			cursor: pointer;
			border: none;
		}
		.btn-primary { background: #0070f3; color: white; }
		.btn-secondary { background: transparent; border: 1px solid #d1d5db; color: #333; }
	</style>
</head>
<body>
	<div class="container">
		<div class="card">
			<h1>Rephonic MCP Server</h1>
			<p><strong>${clientName}</strong> is requesting access to your <a href="https://rephonic.com/developers">Rephonic API</a> subscription</a>.</p>
			<form method="post" action="${new URL(request.url).pathname}">
				<input type="hidden" name="state" value="${encodedState}">
				<input type="hidden" name="csrf_token" value="${csrfToken}">
				<div class="actions">
					<button type="button" class="btn btn-secondary" onclick="window.history.back()">Cancel</button>
					<button type="submit" class="btn btn-primary">Approve</button>
				</div>
			</form>
		</div>
	</div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "frame-ancestors 'none'",
      "Set-Cookie": setCookie,
      "X-Frame-Options": "DENY",
    },
  });
}

export { app as ApiKeyHandler };
