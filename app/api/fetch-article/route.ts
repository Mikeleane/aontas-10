import { NextResponse } from "next/server";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // 1) Parse request body safely
    let body: any;
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

    // 2) Fetch the article HTML with a browser-like user agent
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      console.error("Upstream fetch failed", url, res.status, res.statusText);
      return NextResponse.json(
        {
          error: `Failed to fetch article (status ${res.status} ${res.statusText}).`,
        },
        { status: 502 }
      );
    }

    const html = await res.text();
    if (!html || !html.trim()) {
      return NextResponse.json(
        { error: "Empty response from article URL." },
        { status: 502 }
      );
    }

    // 3) Use JSDOM + Readability to extract the main article
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.textContent || !article.textContent.trim()) {
      return NextResponse.json(
        { error: "Could not extract readable article text from that page." },
        { status: 422 }
      );
    }

    // 4) Always return JSON
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
