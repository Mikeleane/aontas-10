import { NextResponse } from "next/server";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export const runtime = "nodejs";

type FetchRequestBody = {
  url: string;
};

export async function POST(request: Request) {
  try {
    const { url } = (await request.json()) as FetchRequestBody;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'url' field." },
        { status: 400 }
      );
    }

    // Fetch the raw HTML
    const res = await fetch(url);
    if (!res.ok) {
      console.error("Failed to fetch URL:", url, res.status, res.statusText);
      return NextResponse.json(
        { error: `Failed to fetch URL (status ${res.status}).` },
        { status: 500 }
      );
    }

    const html = await res.text();

    // Use Readability to extract the main article
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    let title =
      article?.title || dom.window.document.title || url;
    let content = article?.textContent || "";

    if (!content.trim()) {
      // Fallback: basic textContent of the body
      content = dom.window.document.body?.textContent || "";
    }

    const cleaned = content
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!cleaned) {
      return NextResponse.json(
        { error: "Could not extract article text from that page." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      title: title?.trim() || null,
      text: cleaned,
    });
  } catch (err) {
    console.error("Error in /api/fetch-article:", err);
    return NextResponse.json(
      { error: "Failed to fetch or parse article." },
      { status: 500 }
    );
  }
}
