const COUNTRY_CODES = {
  "United States": "us", "United Kingdom": "uk", Canada: "ca",
  Australia: "au", Pakistan: "pk", India: "in", Germany: "de"
};
const LANGUAGE_CODES = { English: "en", Urdu: "ur", German: "de", French: "fr", Spanish: "es" };

function reply(body, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extraHeaders }
  });
}

export default async function handler(request) {
  if (request.method !== "GET") return reply({ code: "METHOD_NOT_ALLOWED", error: "Use a GET request." }, 405);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().replace(/\s+/g, " ");
  const country = url.searchParams.get("country") || "United States";
  const language = url.searchParams.get("language") || "English";
  if (!q) return reply({ code: "KEYWORD_REQUIRED", error: "Enter a topic or seed keyword." }, 400);
  if (q.length > 120) return reply({ code: "KEYWORD_TOO_LONG", error: "Keywords must be 120 characters or fewer." }, 400);
  if (!Object.hasOwn(COUNTRY_CODES, country)) return reply({ code: "INVALID_COUNTRY", error: "Choose a supported country." }, 400);
  if (!Object.hasOwn(LANGUAGE_CODES, language)) return reply({ code: "INVALID_LANGUAGE", error: "Choose a supported language." }, 400);

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return reply({ code: "API_KEY_MISSING", error: "Live keyword suggestions are not configured yet. Add SERPAPI_KEY in Netlify environment variables." }, 503);

  const apiUrl = new URL("https://serpapi.com/search.json");
  apiUrl.searchParams.set("engine", "google_autocomplete");
  apiUrl.searchParams.set("q", q);
  apiUrl.searchParams.set("api_key", apiKey);
  apiUrl.searchParams.set("gl", COUNTRY_CODES[country]);
  apiUrl.searchParams.set("hl", LANGUAGE_CODES[language]);
  let upstream;
  try {
    upstream = await fetch(apiUrl, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  } catch {
    return reply({ code: "PROVIDER_UNREACHABLE", error: "Could not contact the keyword suggestion provider. Try again shortly." }, 502);
  }
  let data;
  try { data = await upstream.json(); } catch { data = {}; }
  if (!upstream.ok || data.error) {
    const status = upstream.status === 429 ? 429 : 502;
    const message = upstream.status === 401 || upstream.status === 403
      ? "The search API rejected the configured key. Check SERPAPI_KEY in Netlify settings."
      : upstream.status === 429
      ? "The search provider quota or rate limit has been reached. Try again later."
      : "The search provider could not return keyword suggestions.";
    return reply({ code: upstream.status === 429 ? "PROVIDER_RATE_LIMIT" : "PROVIDER_ERROR", error: message }, status);
  }
  const suggestions = Array.isArray(data.suggestions)
    ? data.suggestions.slice(0, 15).map(s => ({ value: String(s.value || "") })).filter(s => s.value)
    : [];
  return reply({ query: q, country, language, source: "Google Autocomplete via SerpApi", suggestions }, 200, { "Cache-Control": "public, max-age=1800" });
}
