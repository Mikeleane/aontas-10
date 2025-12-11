// app/api/fetch-article/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Simple GET so you can check the route in a browser
export async function GET() {
  return NextResponse.json(
    { ok: true, route: "fetch-article", method: "GET" },
    { status: 200 }
  );
}

export async function POST(req: Request) {
  try {
    // ---- 1. Parse body safely ----
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body in request." },
        { status: 400 }
      );
    }

    const url = (body?.url || "").toString().trim();
    if (!url) {
      return NextResponse.json(
        { error: "Missing 'url' in request body." },
        { status: 400 }
      );
    }

    // ---- 2. Dynamically import jsdom + readability ----
    let JSDOM: any;
    let Readability: any;

    try {
      const jsdomMod = await import("jsdom");
      const readabilityMod = await import("@mozilla/readability");
      JSDOM = jsdomMod.JSDOM;
      Readability = readabilityMod.Readability;
    } catch (e) {
      console.error("Failed to import jsdom/readability:", e);
      return NextResponse.json(
        {
          error:
            "Server is missing HTML parsing modules (jsdom/readability). Please contact the site admin.",
        },
        { status: 500 }
      );
    }

    // ---- 3. Fetch the page HTML ----
    const upstream = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!upstream.ok) {
      console.error(
        "Upstream fetch failed",
        url,
        upstream.status,
        upstream.statusText
      );
      return NextResponse.json(
        {
          error: `Failed to fetch article (status ${upstream.status} ${upstream.statusText}).`,
        },
        { status: 502 }
      );
    }

    const html = await upstream.text();
    if (!html || !html.trim()) {
      return NextResponse.json(
        { error: "Empty response from article URL." },
        { status: 502 }
      );
    }

    // ---- 4. Extract main article with Readability ----
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.textContent || !article.textContent.trim()) {
      return NextResponse.json(
        { error: "Could not extract readable article text from that page." },
        { status: 422 }
      );
    }

    // ---- 5. Success ----
    return NextResponse.json(
      {
        title: article.title ?? null,
        text: article.textContent.trim(),
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("fetch-article route error", err);
    return NextResponse.json(
      { error: "Unexpected error while fetching article." },
      { status: 500 }
    );
  }
}
