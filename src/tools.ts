import { z } from "zod";
import type { McpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShape } from "zod";

export type ToolResult = {
	content: { type: "text"; text: string }[];
	isError?: boolean;
};

export type ApiFetch = (
	path: string,
	params?: Record<string, string | undefined>,
) => Promise<ToolResult>;

// Cross-tool guidance sent to clients at initialization, so they know the order to call tools in.
export const REPHONIC_INSTRUCTIONS =
	"Rephonic is a database of 4M+ podcasts and their episodes, with listener estimates, audience demographics, host and guest contacts, sponsors and chart rankings. " +
	"Typical flow: find shows with search_podcasts (or find_podcast if you already have an Apple, Spotify, YouTube or RSS identifier), then pass the returned podcast `id` to lookup_podcast, podcast_people, contacts, podcast_demographics, podcast_promotions and the other podcast tools. " +
	"Use search_episodes to find specific episodes, or mentions of a brand, person or topic. Valid search filter values come from the list_* tools. " +
	"Listener numbers are estimates, and people, contacts and promotions are extracted automatically, so mention that when the user relies on them. " +
	"When you mention a podcast, link to https://rephonic.com/podcasts/<id>.";

// Registers every Rephonic tool against an McpServer. Transport-agnostic: the
// Worker passes an apiFetch bound to the OAuth-provided key, the stdio entry
// passes one bound to REPHONIC_API_KEY. Keep tool defs here so both stay in sync.
export function registerRephonicTools(server: McpServer, apiFetch: ApiFetch) {
	// Every tool only reads from Rephonic's own podcast database, so they all
	// share one annotation set. Revisit per tool if a write or web-fetching
	// tool is ever added.
	const registerTool = <Args extends ZodRawShape>(
		name: string,
		title: string,
		description: string,
		inputSchema: Args,
		handler: ToolCallback<Args>,
	) =>
		server.registerTool(
			name,
			{
				title,
				description,
				inputSchema,
				annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
				_meta: { securitySchemes: [{ type: "oauth2" }] },
			},
			handler,
		);

	// 1. Search Podcasts
	registerTool(
		"search_podcasts",
		"Search podcasts",
		"Search for podcasts by topic, title, or publisher with advanced filters. Returns estimated listeners per episode in the `downloads_per_episode` field. Specify either `query` or `filters` or both. Filters are comma-separated, e.g. `listeners:gte:5000,active:is:true`. See list_categories, list_countries, list_languages, list_sponsors, list_professions, list_interests for valid filter values.",
		{
			query: z.string().optional().describe("Search query. Supports parentheses for grouping, quotes for exact match, AND, OR and -negation."),
			mode: z.enum(["topics", "titles", "publishers"]).optional().describe("Search mode. Default: topics."),
			per_page: z.number().optional().describe("Results per page, max 100. Default: 50."),
			page: z.number().optional().describe("Page number, starts at 1."),
			filters: z.string().optional().describe("Advanced search filters, comma-separated. E.g. `listeners:gte:5000,active:is:true,categories:in:1482`."),
		},
		async ({ query, mode, per_page, page, filters }) => {
			return apiFetch("/api/search/podcasts/", {
				query, mode, per_page: per_page?.toString(), page: page?.toString(), filters,
			});
		},
	);

	// 2. Search Episodes
	registerTool(
		"search_episodes",
		"Search episodes",
		"Search for episodes. Matches against episode titles, show notes, and full transcripts. Specify either `query` or `filters` or both.",
		{
			query: z.string().optional().describe("Search query. Supports parentheses, quotes, AND, OR and -negation."),
			per_page: z.number().optional().describe("Results per page, max 100. Default: 50."),
			page: z.number().optional().describe("Page number, starts at 1."),
			filters: z.string().optional().describe("Advanced search filters, comma-separated."),
			highlight: z.boolean().optional().describe("If true, query matches in title, show notes and transcript are returned with HTML <b> tags."),
			podcast_id: z.string().optional().describe("Scope results to a single podcast by its Rephonic ID (e.g. 'the-daily')."),
			threshold: z.number().optional().describe("Only return episodes published within the last N seconds. Max 1209600 (14 days)."),
		},
		async ({ query, per_page, page, filters, highlight, podcast_id, threshold }) => {
			return apiFetch("/api/search/episodes/", {
				query, per_page: per_page?.toString(), page: page?.toString(), filters,
				highlight: highlight?.toString(), podcast_id, threshold: threshold?.toString(),
			});
		},
	);

	// 3. Autocomplete
	registerTool(
		"autocomplete",
		"Autocomplete search",
		"Returns suggested keywords and matching podcasts for a search query.",
		{
			mode: z.enum(["topics", "titles", "publishers", "episodes"]).describe("Search mode."),
			query: z.string().describe("Search query."),
		},
		async ({ mode, query }) => {
			return apiFetch("/api/search/autocomplete/", { mode, query });
		},
	);

	// 4a. Find Podcast (by external identifier)
	registerTool(
		"find_podcast",
		"Find podcast by external ID",
		"Find a Rephonic podcast from an external identifier: Apple/iTunes ID, Spotify ID, YouTube channel ID, or RSS feed URL. Use this whenever you already have one of those values — there is no need to call search_podcasts first. Pass exactly one of the four parameters. Returns `{podcasts: [...]}` — empty when no match; may contain multiple entries when a feed_url or youtube_channel_id is shared. Use the returned `id` with lookup_podcast and the other podcast tools.",
		{
			itunes_id: z.union([z.string(), z.number()]).optional().describe("Apple Podcasts / iTunes ID (numeric)."),
			feed_url: z.string().optional().describe("Full RSS feed URL. Case-insensitive, trailing slashes ignored."),
			spotify_id: z.string().optional().describe("Spotify show ID (the 22-character identifier, not the URL)."),
			youtube_channel_id: z.string().optional().describe("YouTube channel ID (starts with 'UC')."),
		},
		async ({ itunes_id, feed_url, spotify_id, youtube_channel_id }) => {
			return apiFetch("/api/podcasts/lookup/", {
				itunes_id: itunes_id?.toString(),
				feed_url,
				spotify_id,
				youtube_channel_id,
			});
		},
	);

	// 4b. Get Podcast (by Rephonic slug)
	registerTool(
		"lookup_podcast",
		"Get podcast details",
		"Look up a podcast's metadata, chart rankings, and latest episodes by its Rephonic ID (e.g. 'huberman-lab'). If you have an Apple/iTunes ID, Spotify ID, YouTube channel ID, or RSS feed URL instead of a Rephonic ID, use find_podcast first to resolve it. If you only know the name, use search_podcasts.",
		{ podcast_id: z.string().describe("The Rephonic podcast ID, e.g. 'huberman-lab'.") },
		async ({ podcast_id }) => {
			return apiFetch(`/api/podcasts/${encodeURIComponent(podcast_id)}/`);
		},
	);

	// 5. Podcast People (Hosts & Guests)
	registerTool(
		"podcast_people",
		"Get hosts and guests",
		"Returns hosts and guests of a podcast with names, descriptions, affiliations, contact emails, contact pages, and social media profiles. Data is extracted from transcripts and may have occasional inaccuracies.",
		{ podcast_id: z.string().describe("The Rephonic podcast ID.") },
		async ({ podcast_id }) => {
			return apiFetch(`/api/podcasts/${encodeURIComponent(podcast_id)}/people/`);
		},
	);

	// 6. Podcast Demographics
	registerTool(
		"podcast_demographics",
		"Get listener demographics",
		"Returns estimated demographic information about a podcast's listeners including age groups, education levels, professions, interests, household income, and country-level geographic distribution.",
		{ podcast_id: z.string().describe("The Rephonic podcast ID.") },
		async ({ podcast_id }) => {
			return apiFetch(`/api/podcasts/${encodeURIComponent(podcast_id)}/demographics/`);
		},
	);

	// 7. Podcast Promotions (Sponsors & Ads)
	registerTool(
		"podcast_promotions",
		"Get sponsors and promotions",
		"Returns sponsors and cross-promotions from a podcast's episodes. May include product/service details, full ad read text, call to action, URLs, and promo codes. Data is extracted from transcripts and may have occasional inaccuracies.",
		{ podcast_id: z.string().describe("The Rephonic podcast ID.") },
		async ({ podcast_id }) => {
			return apiFetch(`/api/podcasts/${encodeURIComponent(podcast_id)}/promotions/`);
		},
	);

	// 8. List Episodes
	registerTool(
		"list_episodes",
		"List episodes",
		"Returns every episode for a given podcast in chronological order, including YouTube videos if found.",
		{
			podcast_id: z.string().describe("The Rephonic podcast ID (e.g. 'the-daily')."),
			query: z.string().optional().describe("Filter episodes by search query. Matches titles, show notes, and transcripts."),
			per_page: z.number().optional().describe("Results per page, max 25. Default: 25."),
			page: z.number().optional().describe("Page number, starts at 1."),
		},
		async ({ podcast_id, query, per_page, page }) => {
			return apiFetch("/api/episodes/", {
				podcast_id, query, per_page: per_page?.toString(), page: page?.toString(),
			});
		},
	);

	// 9. Get Episode
	registerTool(
		"get_episode",
		"Get episode details",
		"Look up metadata for an individual episode including topics, locations, guests, and memorable moments. Use an ID from the episode search or list_episodes tool.",
		{ episode_id: z.string().describe("The Rephonic episode ID.") },
		async ({ episode_id }) => {
			return apiFetch(`/api/episodes/${encodeURIComponent(episode_id)}/`);
		},
	);

	// 10. Episode Transcript
	registerTool(
		"episode_transcript",
		"Get episode transcript",
		"Get the full transcript for an individual episode. Not available for all episodes. May include speaker name mapping.",
		{ episode_id: z.string().describe("The Rephonic episode ID.") },
		async ({ episode_id }) => {
			return apiFetch(`/api/episodes/${encodeURIComponent(episode_id)}/transcript/`);
		},
	);

	// 11. Contacts
	registerTool(
		"contacts",
		"Get podcast contacts",
		"Returns email contacts, contact pages, and social media accounts for a podcast. Includes quality indicators: `concierge` (manually verified), `warning` (likely invalid), and `upvotes`/`downvotes`.",
		{ podcast_id: z.string().describe("The Rephonic podcast ID.") },
		async ({ podcast_id }) => {
			return apiFetch("/api/contacts/", { podcast_id });
		},
	);

	// 12. Social Accounts
	registerTool(
		"social_accounts",
		"Get social accounts",
		"Returns social media accounts linked to a podcast (Instagram, Facebook, X/Twitter, Patreon, TikTok, LinkedIn, etc.) with follower counts and engagement metrics.",
		{ podcast_id: z.string().describe("The Rephonic podcast ID.") },
		async ({ podcast_id }) => {
			return apiFetch("/api/social/accounts/", { podcast_id });
		},
	);

	// 13. Feedback (Ratings)
	registerTool(
		"feedback",
		"Get ratings summary",
		"Returns overall rating, total ratings/reviews count across various apps, and AI-generated summary insights of listener reviews.",
		{ podcast_id: z.string().describe("The Rephonic podcast ID.") },
		async ({ podcast_id }) => {
			return apiFetch("/api/feedback/", { podcast_id });
		},
	);

	// 14. Reviews
	registerTool(
		"reviews",
		"Get listener reviews",
		"Returns individual listener reviews from various apps in chronological order.",
		{
			podcast_id: z.string().describe("The Rephonic podcast ID."),
			platform: z.enum(["all", "apple", "podchaser", "castbox", "audible", "podaddict"]).describe("Review platform to filter by."),
		},
		async ({ podcast_id, platform }) => {
			return apiFetch("/api/reviews/", { podcast_id, platform });
		},
	);

	// 15. Trends
	registerTool(
		"trends",
		"Get podcast trends",
		"Returns historical trends data for podcast metrics over time. Each metric returns an array of [unix_timestamp, value] pairs.",
		{
			podcast_ids: z.string().describe("Comma-separated list of podcast IDs. Maximum 3."),
			metrics: z.string().describe("Comma-separated list of metrics. Allowed: downloads_per_episode, social_reach, spotify_followers. Maximum 5."),
		},
		async ({ podcast_ids, metrics }) => {
			return apiFetch("/api/trends/", { podcast_ids, metrics });
		},
	);

	// 16. Shared Audience Graph
	registerTool(
		"shared_audience_graph",
		"Get shared audience",
		"Returns the shared audience graph for a podcast, showing other podcasts with overlapping listeners.",
		{ podcast_id: z.string().describe("The Rephonic podcast ID.") },
		async ({ podcast_id }) => {
			return apiFetch("/api/similar/graph/", { podcast_id });
		},
	);

	// 17. Chart Categories
	registerTool(
		"chart_categories",
		"List chart categories",
		"Get all available chart categories and countries for a platform. Use the returned slugs with the chart_rankings tool.",
		{ platform: z.enum(["apple", "spotify", "youtube"]).describe("Chart platform.") },
		async ({ platform }) => {
			return apiFetch(`/api/charts/${encodeURIComponent(platform)}/`);
		},
	);

	// 18. Chart Rankings
	registerTool(
		"chart_rankings",
		"Get chart rankings",
		"Returns the latest chart rankings for a given platform, country, and category (updated every 24 hours). Use chart_categories to get valid country and category slugs. Use category `all` for overall top charts.",
		{
			platform: z.enum(["apple", "spotify", "youtube"]).describe("Chart platform."),
			country: z.string().describe("Country slug from chart_categories."),
			category: z.string().describe("Category slug from chart_categories, or 'all' for overall top charts."),
		},
		async ({ platform, country, category }) => {
			return apiFetch(`/api/charts/${encodeURIComponent(platform)}/${encodeURIComponent(country)}/${encodeURIComponent(category)}/`);
		},
	);

	// 19. List Categories
	registerTool(
		"list_categories",
		"List podcast categories",
		"Returns a list of podcast categories. These IDs are used with the `categories` search filter.",
		{},
		async () => {
			return apiFetch("/api/common/categories/");
		},
	);

	// 20. List Countries
	registerTool(
		"list_countries",
		"List countries",
		"Returns a list of countries. These IDs are used with the `locations` search filter.",
		{},
		async () => {
			return apiFetch("/api/common/countries/");
		},
	);

	// 21. List Languages
	registerTool(
		"list_languages",
		"List languages",
		"Returns a list of languages. These codes are used with the `languages` search filter.",
		{},
		async () => {
			return apiFetch("/api/common/languages/");
		},
	);

	// 22. List Sponsors
	registerTool(
		"list_sponsors",
		"List sponsors",
		"Returns commonly seen sponsors, optionally filtered by name. These names are used with the `sponsors` search filter.",
		{ query: z.string().optional().describe("Filter sponsors by name.") },
		async ({ query }) => {
			return apiFetch("/api/common/sponsors/", { query });
		},
	);

	// 23. List Professions
	registerTool(
		"list_professions",
		"List listener professions",
		"Returns common listener professions, optionally filtered by name. These names are used with the `professions` search filter.",
		{ query: z.string().optional().describe("Filter professions by name.") },
		async ({ query }) => {
			return apiFetch("/api/common/professions/", { query });
		},
	);

	// 24. List Interests
	registerTool(
		"list_interests",
		"List listener interests",
		"Returns common listener interests, optionally filtered by name. These names are used with the `interests` search filter.",
		{ query: z.string().optional().describe("Filter interests by name.") },
		async ({ query }) => {
			return apiFetch("/api/common/interests/", { query });
		},
	);

	// 25. API Quota
	registerTool(
		"api_quota",
		"Check API quota",
		"Check your API request quota and usage for the current month.",
		{},
		async () => {
			return apiFetch("/api/accounts/quota/");
		},
	);
}
