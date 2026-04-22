# Rephonic MCP Server

Give AI agents and LLMs access to podcast data from [Rephonic](https://rephonic.com) — covering 3+ million podcasts with listener estimates, demographics, contact details, chart rankings, episodes, and more.

This is a remote Model Context Protocol (MCP) server that connects AI assistants like Claude, ChatGPT, and Cursor to the [Rephonic API](https://rephonic.com/developers).

## Ideas and Use Cases

- **Read, summarise and analyse transcripts** — grab a full-text transcript for almost any podcast episode
- **Search and discover podcasts** — find shows by topic, category, or audience fit
- **Research podcasts for guest pitching** — see listener numbers, audience demographics, and contact details without leaving your AI workflow
- **Monitor brand mentions** — track when your brand, competitors, or clients are mentioned across podcasts
- **Analyze audience demographics** — age, education, profession, income, and location breakdowns for any podcast
- **Track chart rankings** — daily Apple, Spotify, and YouTube chart data across countries and categories
- **Monitor sponsorships and promotions** — see who's advertising on which shows, with ad copy and promo codes
- **Build media lists** — pull verified email contacts, social accounts, and host/guest info at scale

## Tools

- **search_podcasts** — Search for podcasts by topic, title, or publisher with advanced filters.
- **search_episodes** — Search for episodes by keyword across titles, show notes, and transcripts.
- **autocomplete** — Get suggested keywords and matching podcasts for a search query.
- **find_podcast** — Resolve a Rephonic podcast from an Apple/iTunes ID, Spotify ID, YouTube channel ID, or RSS feed URL. Use this first when you already have one of those identifiers.
- **lookup_podcast** — Look up a podcast's metadata, chart rankings, and latest episodes by its Rephonic ID.
- **podcast_people** — Get hosts and guests of a podcast with contact details and social profiles.
- **podcast_demographics** — Get estimated listener demographics (age, education, profession, income, location).
- **podcast_promotions** — Get sponsors and cross-promotions from a podcast's episodes.
- **list_episodes** — List all episodes for a podcast in chronological order.
- **get_episode** — Look up metadata for an individual episode.
- **episode_transcript** — Get the full transcript for an episode.
- **contacts** — Get email contacts, contact pages, and social accounts for a podcast.
- **social_accounts** — Get social media accounts linked to a podcast with follower/engagement metrics.
- **feedback** — Get overall ratings and AI-generated review summaries for a podcast.
- **reviews** — Get individual listener reviews from various apps.
- **trends** — Get historical trends for podcast metrics over time.
- **shared_audience_graph** — Get podcasts with overlapping listeners.
- **chart_categories** — List available chart categories and countries for Apple, Spotify, or YouTube.
- **chart_rankings** — Get the latest chart rankings for a platform, country, and category.
- **list_categories** — List podcast categories (for use with search filters).
- **list_countries** — List countries (for use with search filters).
- **list_languages** — List languages (for use with search filters).
- **list_sponsors** — List commonly seen sponsors (for use with search filters).
- **list_professions** — List common listener professions (for use with search filters).
- **list_interests** — List common listener interests (for use with search filters).
- **api_quota** — Check your API request quota and usage.

## Setup

You need a Rephonic API key. [Get one here](https://rephonic.com/developers).

### ChatGPT

1. Go to **Settings** → **Apps** → **Advanced settings** and enable **Developer mode**
2. Then click **Create app**
3. Enter Name: Rephonic
4. Enter MCP Server URL: `https://mcp.rephonic.com`
3. Click **Create** and enter your Rephonic API key when prompted

### Claude.ai

1. Go to **Settings** → **Connectors**
2. Click **Add custom connector** and enter name `Rephonic` and MCP server URL `https://mcp.rephonic.com`
3. Click **Add** and enter your Rephonic API key when prompted

### Claude Desktop

Add to your config file and restart Claude Desktop:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "rephonic": {
      "url": "https://mcp.rephonic.com"
    }
  }
}
```

### Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "rephonic": {
      "type": "http",
      "url": "https://mcp.rephonic.com"
    }
  }
}
```

### Cursor

Go to **Settings** → **MCP** → **Add new MCP server**. Set type to **URL** and enter `https://mcp.rephonic.com`.

---
<details>
<summary><h3>Development</h3></summary>

If you want to fork or customize this MCP server for your own needs, here is how you can run or deploy it.

### Prerequisites

- Node.js
- A [Cloudflare account](https://dash.cloudflare.com) (for deployment)

### Local dev

```bash
npm install
npm start
```

The server runs at `http://localhost:8788`. Test with the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector@latest
```

### Type-check

```bash
npm run type-check
```

### Regenerate Cloudflare types

After changing `wrangler.jsonc`:

```bash
npm run cf-typegen
```

</details>
