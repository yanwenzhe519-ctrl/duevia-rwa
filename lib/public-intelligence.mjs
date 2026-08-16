import { XMLParser } from "fast-xml-parser";

const riskTerms = ["default", "insolvent", "insolvency", "bankruptcy", "shutdown", "suspended", "missed payment", "wind down", "liquidation", "fraud"];

const normalizeArticle = (article) => {
  const title = String(article.title || "");
  return { title, url: String(article.url || article.link || ""), domain: String(article.domain || article.source?.["#text"] || article.source || ""), seenAt: String(article.seendate || article.pubDate || ""), language: String(article.language || ""), matchedRisks: riskTerms.filter((term) => title.toLowerCase().includes(term)) };
};

const parseRssArticles = (xml) => {
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml);
  const items = parsed?.rss?.channel?.item;
  return (Array.isArray(items) ? items : items ? [items] : []).slice(0, 20).map(normalizeArticle);
};

/** @param {{ query?: string, timespan?: string, fetchImpl?: typeof fetch }} options */
export async function searchPublicIntelligence({ query, timespan = "7d", fetchImpl = fetch } = {}) {
  const normalized = String(query || "").trim().slice(0, 160);
  if (!normalized) throw new Error("A public-intelligence query is required.");
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", normalized.replaceAll('"', ""));
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("maxrecords", "20");
  url.searchParams.set("format", "json");
  url.searchParams.set("timespan", timespan);
  let response;
  try { response = await fetchImpl(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6_000) }); } catch { response = null; }
  let source = "gdelt-doc-v2";
  let articles = [];
  if (response?.ok) {
    const payload = await response.json();
    articles = (Array.isArray(payload.articles) ? payload.articles : []).map(normalizeArticle);
  } else {
    let bingResponse;
    try { bingResponse = await fetchImpl(`https://www.bing.com/news/search?q=${encodeURIComponent(`"${normalized}"`)}&format=rss`, { headers: { Accept: "application/rss+xml, application/xml" }, signal: AbortSignal.timeout(6_000) }); } catch { bingResponse = null; }
    if (bingResponse?.ok) {
      articles = parseRssArticles(await bingResponse.text());
      source = "bing-news-rss";
    } else {
    let hnResponse;
    try { hnResponse = await fetchImpl(`https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(normalized)}&tags=story&hitsPerPage=20`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6_000) }); } catch { hnResponse = null; }
    if (hnResponse?.ok) {
      const payload = await hnResponse.json();
      articles = (Array.isArray(payload.hits) ? payload.hits : []).map((item) => normalizeArticle({ title: item.title, url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`, domain: "news.ycombinator.com", seendate: item.created_at, language: "English" }));
      source = "hacker-news-algolia";
    } else {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(normalized)}&hl=en-US&gl=US&ceid=US:en`;
      let rssResponse;
      try { rssResponse = await fetchImpl(rssUrl, { headers: { Accept: "application/rss+xml, application/xml" }, signal: AbortSignal.timeout(6_000) }); } catch { rssResponse = null; }
      if (!rssResponse?.ok) throw new Error("All configured public intelligence sources are currently unavailable.");
      articles = parseRssArticles(await rssResponse.text());
      source = "google-news-rss";
    }
    }
  }
  return { source, query: normalized, checkedAt: new Date().toISOString(), articleCount: articles.length, riskArticleCount: articles.filter((article) => article.matchedRisks.length).length, articles };
}
