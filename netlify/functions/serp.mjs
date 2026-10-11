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
  const countryName = url.searchParams.get("country") || "United States";
  const languageName = url.searchParams.get("language") || "English";
  const deviceName = url.searchParams.get("device") || "Desktop";

  if (!q) return reply({ code: "KEYWORD_REQUIRED", error: "Enter a keyword or search phrase." }, 400);
  if (q.length > 120) return reply({ code: "KEYWORD_TOO_LONG", error: "Keywords must be 120 characters or fewer." }, 400);
  if (!Object.hasOwn(COUNTRY_CODES, countryName)) return reply({ code: "INVALID_COUNTRY", error: "Choose a supported country." }, 400);
  if (!Object.hasOwn(LANGUAGE_CODES, languageName)) return reply({ code: "INVALID_LANGUAGE", error: "Choose a supported language." }, 400);
  if (!["Desktop", "Mobile"].includes(deviceName)) return reply({ code: "INVALID_DEVICE", error: "Choose desktop or mobile." }, 400);

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return reply({ code: "API_KEY_MISSING", error: "Live search is not configured yet. The site owner must add the SERPAPI_KEY environment variable in Netlify." }, 503);

  const apiUrl = new URL("https://serpapi.com/search.json");
  apiUrl.searchParams.set("engine", "google");
  apiUrl.searchParams.set("q", q);
  apiUrl.searchParams.set("api_key", apiKey);
  apiUrl.searchParams.set("gl", COUNTRY_CODES[countryName]);
  apiUrl.searchParams.set("hl", LANGUAGE_CODES[languageName]);
  apiUrl.searchParams.set("device", deviceName.toLowerCase());
  apiUrl.searchParams.set("num", "10");

  let upstream;
  try {
    upstream = await fetch(apiUrl, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  } catch {
    return reply({ code: "PROVIDER_UNREACHABLE", error: "Could not contact the search provider. Please try again shortly." }, 502);
  }
  let data;
  try { data = await upstream.json(); } catch { data = {}; }
  if (!upstream.ok || data.error) {
    const status = upstream.status === 429 ? 429 : 502;
    const message = upstream.status === 401 || upstream.status === 403
      ? "The search API rejected the configured key. Check SERPAPI_KEY in Netlify settings."
      : upstream.status === 429
      ? "The search provider quota or rate limit has been reached. Try again later."
      : "The search provider could not return results for this request.";
    return reply({ code: upstream.status === 429 ? "PROVIDER_RATE_LIMIT" : "PROVIDER_ERROR", error: message }, status);
  }

  const results = Array.isArray(data.organic_results)
    ? data.organic_results.slice(0, 10).map((r, i) => ({
        position: Number.isFinite(Number(r.position)) ? Number(r.position) : i + 1,
        title: String(r.title || ""),
        link: String(r.link || ""),
        snippet: String(r.snippet || ""),
        type: "Organic result"
      })).filter(r => /^https?:\/\//i.test(r.link))
    : [];

  return reply({ query: q, country: countryName, device: deviceName, language: languageName, source: "Google organic results via SerpApi", results }, 200, { "Cache-Control": "public, max-age=300" });
}
