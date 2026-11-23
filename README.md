# Rephonic MCP server

This MCP server lets AI assistants like Claude, ChatGPT and Cursor use the [Rephonic API](https://rephonic.com/developers). [Rephonic](https://rephonic.com) has data on over 4 million podcasts, including listener estimates, audience demographics, contacts, chart positions and episodes with transcripts.

## What you can do with it

- Read an episode's transcript, then ask the assistant to summarise or analyse it. Not every episode has a transcript.
- Find podcasts by topic, category or audience, e.g. shows with at least 10,000 listeners whose audience is mostly in the UK.
- Research a show before you pitch a guest to it. You can see its listener numbers, audience demographics, contacts and how it prefers to be pitched.
- Find podcast episodes that mention a brand, a person or a topic. You can limit the search to episodes from the last two weeks.
- See who advertises on a show, with the ad copy and promo codes.
- Check a podcast's position in the Apple Podcasts, Spotify and YouTube charts.
- Build a media list of shows with their contacts, hosts and social accounts.

## Tools

- `search_podcasts` searches podcasts by topic, title or publisher. You can filter by listeners, category, audience country, language, sponsors and more.
- `search_episodes` searches episode titles, show notes and transcripts.
- `autocomplete` suggests keywords and matching podcasts for a search query.
- `find_podcast` finds a podcast from its Apple Podcasts ID, Spotify ID, YouTube channel ID or RSS feed URL. Use it first when you already have one of these.
- `lookup_podcast` gets a podcast's details by its Rephonic ID, including its latest episode and how to pitch it a guest or buy ads on it.
- `podcast_people` gets a podcast's hosts, crew and guests, with their contacts and social accounts.
- `podcast_demographics` gets estimated listener demographics (age, education, profession, income and country).
- `podcast_promotions` gets the sponsors and cross-promotions heard in a podcast's episodes.
- `podcast_rankings` gets a podcast's current Apple Podcasts, Spotify and YouTube chart positions.
- `list_episodes` lists a podcast's episodes in date order.
- `get_episode` gets the details of one episode.
- `episode_transcript` gets an episode's full transcript.
- `contacts` gets a podcast's email addresses and contact pages, best first, plus its social accounts.
- `social_accounts` gets a podcast's social accounts with follower and engagement numbers.
- `feedback` gets a podcast's ratings in each app and a summary of its reviews.
- `reviews` gets listener reviews from Apple Podcasts, Podchaser, Castbox, Audible and Podcast Addict.
- `trends` gets the history of a podcast's listener estimate, social reach or Spotify followers.
- `shared_audience_graph` gets podcasts that share listeners with a podcast.
- `chart_categories` lists the chart categories and countries for Apple Podcasts, Spotify or YouTube.
- `chart_rankings` gets the latest chart for a platform, country and category.
- `list_categories`, `list_countries`, `list_languages`, `list_sponsors`, `list_professions` and `list_interests` list the values you can use in search filters.
- `api_quota` shows how many API requests you have used this month and your monthly quota.

## Setup

You need a Rephonic API key. [Get one here](https://rephonic.com/developers).

### ChatGPT

1. Go to **Settings** → **Apps** → **Advanced settings** and enable **Developer mode**
2. Then click **Create app**
3. Enter Name: Rephonic
4. Enter MCP Server URL: `https://mcp.rephonic.com`
5. Click **Create** and enter your Rephonic API key when prompted

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

To fork the server, run it locally or deploy it to your own Cloudflare account:

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
