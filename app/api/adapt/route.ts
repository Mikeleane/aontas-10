import { NextResponse } from "next/server";

type AdaptRequestBody = {
  inputText: string;
  outputLanguage: string;
  level: string;
  outputType: string;
  dyslexiaFriendly?: boolean;
};

type ModelResult = {
  standard: string;
  adapted: string;
};

function simpleFallbackAdaptation(
  inputText: string,
  outputLanguage: string,
  level: string,
  outputType: string,
  dyslexiaFriendly?: boolean
) {
  const standardOutput = [
    "STANDARD VERSION (fallback – no API key configured)",
    `Language: ${outputLanguage}`,
    `Level: ${level}`,
    `Type: ${outputType}`,
    "",
    inputText.trim(),
  ].join("\n");

  const adaptedHeader = dyslexiaFriendly
    ? "ADAPTED VERSION (fallback – reduced cognitive load, extra spacing)"
    : "ADAPTED VERSION (fallback – reduced cognitive load)";

  const adaptedOutput = [
    adaptedHeader,
    `Language: ${outputLanguage}`,
    `Level: ${level}`,
    `Type: ${outputType}`,
    "",
    inputText
      .trim()
      .split(/(?<=[.!?])\s+/)
      .join("\n\n"),
  ].join("\n");

  return { standardOutput, adaptedOutput };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AdaptRequestBody;

    const { inputText, outputLanguage, level, outputType, dyslexiaFriendly } =
      body;

    if (!inputText || !outputLanguage || !level || !outputType) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    // If no API key, fall back to simple local adaptation.
    if (!apiKey) {
      console.warn("OPENAI_API_KEY missing – using fallback adaptation.");
      const { standardOutput, adaptedOutput } = simpleFallbackAdaptation(
        inputText,
        outputLanguage,
        level,
        outputType,
        dyslexiaFriendly
      );
      return NextResponse.json({ standardOutput, adaptedOutput });
    }

    const systemPrompt = `
You are Aontas-10, an assistant that adapts classroom texts.

Your job is to produce TWO versions of a given text:

1) STANDARD version:
   - Same CEFR level as requested.
   - Same output type/genre (article, report, email, etc.).
   - Clean, coherent text.
   - Fix obvious problems but keep structure broadly similar.

2) ADAPTED version:
   - Same content and CEFR level (do NOT significantly simplify level).
   - Keep all key ideas and technical terms needed for learning.
   - Reduce cognitive load:
     - Use mostly short, clear sentences (approx. 15–20 words).
     - Prefer active voice where it improves clarity.
     - One main idea per sentence.
     - Add a 1–2 sentence overview at the very top that explains the whole text in simple terms.
     - Organise with short paragraphs and, when appropriate, headings (e.g. "Background", "How it works", "Why it matters").
     - Use bullet points for lists or multi-step processes.
   - Remove non-essential metadata and clutter (wire credits, site navigation labels, random "+1", "Reuters", etc.).
   - Keep important technical vocabulary but give a brief in-line explanation the first time each difficult term appears.
   - Do NOT remove key facts, arguments, causes, consequences, or domain-specific terms that students must learn.
${
  dyslexiaFriendly
    ? "   - Write in a way that works well with dyslexia-friendly formatting: short paragraphs, clear headings, no very long unbroken blocks of text."
    : ""
}

Always write in the requested OUTPUT LANGUAGE.
Always respect the requested CEFR level and output type.
`;

    const userPrompt = `
INPUT TEXT (to adapt):

"""${inputText}"""

Output language: ${outputLanguage}
CEFR level: ${level}
Output type: ${outputType}

TASK:
1. Create the STANDARD version as described by the system instructions.
2. Create the ADAPTED version as described by the system instructions.

RESPONSE FORMAT (IMPORTANT):
Respond ONLY with valid JSON, with this exact structure:

{
  "standard": "STANDARD VERSION HERE",
  "adapted": "ADAPTED VERSION HERE"
}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1", // or any chat-capable model you prefer
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      // Fallback again if API call fails.
      const { standardOutput, adaptedOutput } = simpleFallbackAdaptation(
        inputText,
        outputLanguage,
        level,
        outputType,
        dyslexiaFriendly
      );
      return NextResponse.json(
        {
          standardOutput,
          adaptedOutput,
          warning:
            "AI API request failed – returned fallback adaptation instead.",
        },
        { status: 200 }
      );
    }

    const data = await response.json();

    const rawContent: string =
      data.choices?.[0]?.message?.content?.trim() ?? "";

    let parsed: ModelResult | null = null;

    try {
      const start = rawContent.indexOf("{");
      const end = rawContent.lastIndexOf("}");
      const jsonString =
        start >= 0 && end > start ? rawContent.slice(start, end + 1) : rawContent;

      parsed = JSON.parse(jsonString) as ModelResult;
    } catch (parseError) {
      console.error("Error parsing model JSON:", parseError, rawContent);
    }

    if (!parsed?.standard || !parsed?.adapted) {
      // If parsing failed or keys missing, fall back again.
      const { standardOutput, adaptedOutput } = simpleFallbackAdaptation(
        inputText,
        outputLanguage,
        level,
        outputType,
        dyslexiaFriendly
      );
      return NextResponse.json(
        {
          standardOutput,
          adaptedOutput,
          warning:
            "Could not parse AI response JSON – returned fallback adaptation instead.",
        },
        { status: 200 }
      );
    }

    const standardOutput = parsed.standard;
    const adaptedOutput = parsed.adapted;

    return NextResponse.json({
      standardOutput,
      adaptedOutput,
    });
  } catch (error) {
    console.error("Error in /api/adapt:", error);
    return NextResponse.json(
      { error: "Something went wrong processing the request." },
      { status: 500 }
    );
  }
}
