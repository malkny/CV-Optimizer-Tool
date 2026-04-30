import { request } from "undici";

const FETCH_TIMEOUT_MS = 3000;
const MAX_BYTES = 1_000_000;

export async function fetchJobDescription(url: string): Promise<string> {
  if (!/^https:\/\//i.test(url)) {
    throw new Error("Only https:// URLs are supported");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await request(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; ATS-CV-Optimizer/1.0; +https://replit.com)",
        accept: "text/html,application/xhtml+xml",
      },
      maxRedirections: 3,
    });
    if (res.statusCode >= 400) {
      throw new Error(`Upstream returned status ${res.statusCode}`);
    }
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of res.body) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buf.length;
      if (total > MAX_BYTES) {
        throw new Error("Response too large");
      }
      chunks.push(buf);
    }
    const html = Buffer.concat(chunks).toString("utf8");
    return extractText(html);
  } finally {
    clearTimeout(timer);
  }
}

function extractText(html: string): string {
  let s = html;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<br\s*\/?\s*>/gi, "\n");
  s = s.replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&nbsp;/g, " ");
  s = s.replace(/&amp;/g, "&");
  s = s.replace(/&lt;/g, "<");
  s = s.replace(/&gt;/g, ">");
  s = s.replace(/&quot;/g, '"');
  s = s.replace(/&#39;/g, "'");
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\n{2,}/g, "\n\n");
  return s.trim();
}
