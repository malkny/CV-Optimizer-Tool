import { request } from "undici";

const MAX_BYTES = 2_000_000;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function fetchJobDescription(url: string, timeoutMs = 12_000): Promise<string> {
  if (!/^https:\/\//i.test(url)) {
    throw new Error("Only https:// URLs are supported");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await request(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "user-agent": BROWSER_UA,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
      },
      maxRedirections: 5,
    });

    if (res.statusCode >= 400) {
      throw new Error(`Site returned HTTP ${res.statusCode}`);
    }

    const chunks: Buffer[] = [];
    let total = 0;
    let truncated = false;

    for await (const chunk of res.body) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buf.length;
      if (total > MAX_BYTES) {
        chunks.push(buf.slice(0, MAX_BYTES - (total - buf.length)));
        truncated = true;
        break;
      }
      chunks.push(buf);
    }

    if (!truncated) {
      // drain body to avoid socket leaks
      try { await res.body.dump(); } catch { /* ignore */ }
    }

    const html = Buffer.concat(chunks).toString("utf8");
    const text = extractText(html);
    if (text.length < 30) {
      throw new Error("Page returned insufficient readable text");
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function extractText(html: string): string {
  let s = html;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  s = s.replace(/<svg[\s\S]*?<\/svg>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<br\s*\/?\s*>/gi, "\n");
  s = s.replace(/<\/(p|div|li|h[1-6]|tr|section|article|header|footer|main|nav)>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&nbsp;/g, " ");
  s = s.replace(/&amp;/g, "&");
  s = s.replace(/&lt;/g, "<");
  s = s.replace(/&gt;/g, ">");
  s = s.replace(/&quot;/g, '"');
  s = s.replace(/&#39;/g, "'");
  s = s.replace(/&#x27;/g, "'");
  s = s.replace(/&#x2F;/g, "/");
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}
