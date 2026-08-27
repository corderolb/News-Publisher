import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import axios from 'axios';

const parser = new Parser();

export function normalizeExternalUrl(rawUrl: string): string | null {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return null;

  const withProtocol = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const isDuckDuckGoRedirect =
    (host === 'duckduckgo.com' || host.endsWith('.duckduckgo.com')) && parsed.pathname === '/l/';

  if (isDuckDuckGoRedirect) {
    const uddg = parsed.searchParams.get('uddg');
    if (!uddg) return parsed.toString();

    try {
      return decodeURIComponent(uddg);
    } catch {
      return uddg;
    }
  }

  return parsed.toString();
}

export async function fetchRSS(url: string) {
  try {
    const feed = await parser.parseURL(url);
    return feed.items.map(item => ({
      title: item.title || '',
      link: item.link || '',
      contentSnippet: item.contentSnippet || item.content || item.summary || '',
      pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
    }));
  } catch (error) {
    console.error(`Error fetching RSS from ${url}:`, error);
    return [];
  }
}

// Hard cap on extracted article text before it flows into an LLM prompt as
// ORIGINAL_TEXT. Truncates at the last clean paragraph/sentence boundary at
// or before the limit when one is available nearby, otherwise hard-cuts.
const MAX_SCRAPED_CONTENT_LENGTH = 10000;
const BOUNDARY_LOOKBACK_WINDOW = 1000;

function capContentLength(text: string, maxLength = MAX_SCRAPED_CONTENT_LENGTH): string {
  if (text.length <= maxLength) return text;

  const slice = text.slice(0, maxLength);
  const searchStart = Math.max(0, maxLength - BOUNDARY_LOOKBACK_WINDOW);

  const lastParagraphBreak = slice.lastIndexOf('\n\n');
  if (lastParagraphBreak >= searchStart) {
    return slice.slice(0, lastParagraphBreak).trim();
  }

  const lastSentenceEnd = slice.lastIndexOf('. ');
  if (lastSentenceEnd >= searchStart) {
    return slice.slice(0, lastSentenceEnd + 1).trim();
  }

  return slice.trim();
}

export async function fetchHTMLContent(url: string) {
  try {
    const normalizedUrl = normalizeExternalUrl(url);
    if (!normalizedUrl) {
      console.error(`Error fetching HTML from ${url}: invalid or unsupported URL`);
      return null;
    }

    const response = await axios.get(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });

    const $ = cheerio.load(response.data);

    // Remove unwanted elements
    $('script, style, nav, footer, header, iframe, noscript, aside').remove();

    // Try to find the main article text
    const articleText = $('article, main, .content, .post-content, .article-body')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    const extracted = articleText || $('body').text().replace(/\s+/g, ' ').trim();
    return capContentLength(extracted);
  } catch (error) {
    console.error(`Error fetching HTML from ${url}:`, error);
    return null;
  }
}

// Anchor text that reads as a headline (long enough to pass the length
// heuristic below) but is actually nav/utility chrome, not an article.
const NON_ARTICLE_TEXT_PATTERN = /^(sign up|log ?in|subscribe|newsletter|see my options|menu|search|home ?page|skip to)/i;

// Path segments that are never individual articles, even on an otherwise
// legitimate same-host link (subscription pages, tag/category archives, etc).
const NON_ARTICLE_PATH_PATTERN = /\/(subscri|newsletter|sign-?up|sign-?in|log-?in|register|account|search|tag|category|author|about-us|contact|privacy|terms)(\/|$)/i;

export async function extractLinksFromHTML(baseUrl: string) {
  try {
    const response = await axios.get(baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });

    const $ = cheerio.load(response.data);
    const baseHost = new URL(baseUrl).hostname;
    const links: { title: string, link: string }[] = [];

    $('a').each((i, el) => {
      const href = $(el).attr('href');
      let text = $(el).text().trim();

      // Fallback: Check inner headings if text is empty
      if (!text) {
         text = $(el).find('h1, h2, h3, h4').text().trim();
      }

      // Heuristic: If the link text is long enough, it's probably an article headline
      if (href && text.length > 25 && !NON_ARTICLE_TEXT_PATTERN.test(text)) {
         try {
           const absoluteUrl = new URL(href, baseUrl);

           // Off-host links (subscription portals, social widgets, ad
           // networks) are never the site's own articles.
           if (absoluteUrl.hostname !== baseHost) return;
           // The bare homepage/root is a nav link, never a specific article.
           if (absoluteUrl.pathname === '/' || absoluteUrl.pathname === '') return;
           if (NON_ARTICLE_PATH_PATTERN.test(absoluteUrl.pathname)) return;

           const href_ = absoluteUrl.href;
           // Ignore hash links or same-page links
           if (href_ !== baseUrl && !href_.includes('#')) {
             links.push({ title: text, link: href_ });
           }
         } catch {
           // Invalid URL, ignore
         }
      }
    });

    // Remove duplicates based on URL
    const uniqueLinks = Array.from(new Map(links.map(item => [item.link, item])).values());
    return uniqueLinks;
  } catch (error) {
    console.error(`Error extracting links from ${baseUrl}:`, error);
    return [];
  }
}
