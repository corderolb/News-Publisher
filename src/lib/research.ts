import axios from "axios";
import * as cheerio from "cheerio";
import { normalizeExternalUrl } from "@/lib/fetcher";

export type ResearchResult = {
  title: string;
  url: string;
  snippet: string;
};

// Brave Search API (official, non-scraping) is tried first when a key is
// configured - far more reliable than scraping DuckDuckGo's HTML results
// page, which silently degrades under rate limiting. DuckDuckGo scraping and
// the Wikipedia opensearch API remain as free, no-key fallbacks.

async function searchWithBrave(query: string, limit: number): Promise<ResearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return [];

  const response = await axios.get("https://api.search.brave.com/res/v1/web/search", {
    params: { q: query, count: Math.min(limit, 20) },
    timeout: 15000,
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
  });

  const results = Array.isArray(response.data?.web?.results) ? response.data.web.results : [];
  return results.slice(0, limit).map((r: any) => ({
    title: String(r?.title || "").trim(),
    url: String(r?.url || "").trim(),
    snippet: String(r?.description || "").replace(/<\/?strong>/g, "").trim(),
  })).filter((r: ResearchResult) => r.title && r.url);
}

async function searchWithDuckDuckGo(query: string, limit: number): Promise<ResearchResult[]> {
  const response = await axios.get("https://duckduckgo.com/html/", {
    params: { q: query },
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
  });

  const $ = cheerio.load(response.data);
  const results: ResearchResult[] = [];

  $(".result").each((_, element) => {
    if (results.length >= limit) return;

    const title = $(element).find(".result__title a").text().trim();
    const href = $(element).find(".result__title a").attr("href") || "";
    const snippet = $(element).find(".result__snippet").text().trim();

    if (!title || !href) return;

    const normalizedUrl = normalizeExternalUrl(href);
    if (!normalizedUrl) return;

    results.push({ title, url: normalizedUrl, snippet });
  });

  return results;
}

async function searchWithWikipedia(query: string, limit: number): Promise<ResearchResult[]> {
  const response = await axios.get("https://en.wikipedia.org/w/api.php", {
    params: {
      action: "opensearch",
      search: query,
      limit: Math.min(limit, 10),
      namespace: 0,
      format: "json",
    },
    timeout: 15000,
    headers: {
      "User-Agent": "NewsPublisherBot/1.0",
    },
  });

  const data = response.data;
  if (!Array.isArray(data) || data.length < 4) return [];

  const titles = Array.isArray(data[1]) ? data[1] : [];
  const snippets = Array.isArray(data[2]) ? data[2] : [];
  const urls = Array.isArray(data[3]) ? data[3] : [];

  const results: ResearchResult[] = [];
  for (let i = 0; i < titles.length && results.length < limit; i++) {
    const title = String(titles[i] || "").trim();
    const url = String(urls[i] || "").trim();
    const snippet = String(snippets[i] || "").trim();
    if (!title || !url) continue;
    results.push({ title, url, snippet });
  }

  return results;
}

export async function webResearch(query: string, limit = 5): Promise<ResearchResult[]> {
  try {
    const brave = await searchWithBrave(query, limit).catch((error) => {
      console.warn("[research] Brave Search failed, falling back", { message: error?.message });
      return [] as ResearchResult[];
    });
    if (brave.length > 0) return brave;

    const duckDuckGo = await searchWithDuckDuckGo(query, limit).catch(() => [] as ResearchResult[]);
    if (duckDuckGo.length > 0) return duckDuckGo;

    return await searchWithWikipedia(query, limit).catch(() => []);
  } catch (error) {
    console.error("Web research failed:", error);
    return [];
  }
}
