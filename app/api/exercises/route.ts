import { NextResponse } from "next/server";

type ExerciseSide = {
  prompt: string;
  options?: string[];
};

type ExerciseItem = {
  id: number;
  type: "gist" | "detail" | "trueFalse" | "vocab" | "cloze" | "ordering";
  skill: string;
  answer: string | string[];
  standard: ExerciseSide;
  adapted: ExerciseSide;
};

type ExercisesRequestBody = {
  standardText: string;
  adaptedText: string;
  outputLanguage: string;
  level: string;
  outputType: string;
  includeGist: boolean;
  includeDetail: boolean;
  includeTrueFalse: boolean;
  includeVocab: boolean;
  includeCloze: boolean;
  includeOrdering: boolean;
};

type ExercisesResponseBody = {
  items: ExerciseItem[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ExercisesRequestBody;

    const {
      standardText,
      adaptedText,
      outputLanguage,
      level,
      outputType,
      includeGist,
      includeDetail,
      includeTrueFalse,
      includeVocab,
      includeCloze,
      includeOrdering,
    } = body;

    if (!standardText || !adaptedText) {
      return NextResponse.json(
        { error: "Both standardText and adaptedText are required." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY on the server." },
        { status: 500 }
      );
    }

    const enabledBlocks: string[] = [];
    if (includeGist) enabledBlocks.push("gist / main idea");
    if (includeDetail) enabledBlocks.push("detail questions");
    if (includeTrueFalse) enabledBlocks.push("true / false");
    if (includeVocab)
      enabledBlocks.push("vocabulary / connectors / reference words");
    if (includeCloze) enabledBlocks.push("cloze / gap-fill");
    if (includeOrdering) enabledBlocks.push("ordering / sequencing");

    if (enabledBlocks.length === 0) {
      return NextResponse.json(
        { error: "Select at least one exercise block." },
        { status: 400 }
      );
    }

    const systemPrompt = `
You are helping a teacher create inclusive reading comprehension exercises.

You are given:
- A STANDARD version of a text.
- An ADAPTED version of the same text (simplified language, same ideas).
- Information about the target CEFR level and output type.
- A list of which exercise blocks are enabled.

Your job:
- Create a SINGLE list of exercise items.
- Each item has:
  - an id (1, 2, 3, ...),
  - a "type" (block type),
  - a "skill" description,
  - an "answer" (string or array of strings),
  - a STANDARD prompt (possibly with options),
  - an ADAPTED prompt (possibly with options).
- STANDARD and ADAPTED versions of each item MUST target the SAME concept and share the SAME answer.
- Question numbers (ids) must match between standard and adapted prompts.
- All prompts and answers must be in the output language: ${outputLanguage}.

Inclusion goal:
- Imagine a class where some students use the STANDARD text and some use the ADAPTED text.
- The teacher should be able to call out: "Everyone answer Question 3!"
- Both groups answer the same QUESTION NUMBER and share the same ANSWER KEY, but with different scaffolding.

Allowed values for "type":
- "gist"
- "detail"
- "trueFalse"
- "vocab"
- "cloze"
- "ordering"

Use the "skill" field to describe the subtype, such as:
- "main idea"
- "matching headings to paragraphs"
- "detail questions"
- "information gap / table completion"
- "true/false comprehension"
- "word meaning"
- "reference word"
- "connector meaning"
- "cloze with word bank"
- "event ordering" 
etc.

BLOCK REQUIREMENTS
==================

1) GIST / MAIN IDEA (when gist is enabled)
   You MUST create:
   - At least ONE item with:
       type: "gist"
       skill: "main idea" (or similar)
       → a classic "what is the main idea" style question.
   - AND, IF the text has at least 3 clear paragraphs or sections, create ONE item with:
       type: "gist"
       skill: "matching headings to paragraphs"
       → students match headings (A, B, C, ...) to paragraph numbers.
       STANDARD: may include one extra heading.
       ADAPTED: simpler wording, fewer paragraphs/headings, no extra heading.

2) DETAIL QUESTIONS (when detail is enabled)
   You MUST create:
   - At least ONE item with:
       type: "detail"
       skill: "detail questions"
       → straightforward who/what/where/when/why/how questions.
   - AND, IF the text contains at least 3 distinct factual pieces of information about things like problems/solutions, people/actions, dates/places, create ONE item with:
       type: "detail"
       skill: "information gap / table completion"
       → students complete a small table.
       STANDARD: more open (students fill in cells with their own wording).
       ADAPTED: more support (options, word bank, or partial answers given).

3) TRUE / FALSE (when true/false is enabled)
   - Create 2–3 items with:
       type: "trueFalse"
       skill: "true/false comprehension" (or similar)
       → short statements clearly true or false.
       STANDARD: can add "If false, correct the sentence."
       ADAPTED: just ask for true/false, or include simple T/F choices.

4) VOCABULARY / CONNECTORS / REFERENCE WORDS (when vocab is enabled)
   Focus on:
   - Key content words (e.g. "dementia", "care home"),
   - Useful academic words (e.g. "impact", "challenge"),
   - Connectors / discourse markers (e.g. "however", "therefore"),
   - Reference words / pronouns in context (e.g. "they", "these problems").

   VERY IMPORTANT RULE:
   - Only create vocabulary items for words or phrases that appear IDENTICALLY in BOTH texts.
   - That means the SAME spelling and form (case-insensitive) appear in BOTH the STANDARD and ADAPTED texts.
   - Do NOT choose vocabulary that appears only in one version, or appears as a different word/phrase in each version.
   - If a useful term is only in one version, simply DO NOT use it for a vocabulary exercise.
   - For connectors and reference words, make sure the exact expression is present in BOTH versions.
   - In the prompt, clearly show the target word or phrase (e.g. by putting it in quotation marks).
   - In the answer, give the MEANING or EXPLANATION, not just the word again.

   When vocab is enabled, you MUST:
   - Create at least ONE item with:
       type: "vocab"
       skill: "word meaning" (or similar)
       → meaning of a key word that appears in both texts.
   - AND at least ONE item with either:
       type: "vocab"
       skill: "reference word"
       → ask what a pronoun or phrase like "these problems" refers to,
     OR:
       type: "vocab"
       skill: "connector meaning"
       → ask about the function/meaning of a connector like "however" or "therefore".
     (Only if suitable words/phrases exist in BOTH texts; if not, use extra "word meaning" items.)

   STANDARD: usually open questions.
   ADAPTED: multiple choice or strongly guided.

5) CLOZE / GAP-FILL (when cloze is enabled)
   - Create ONE item with:
       type: "cloze"
       skill: "cloze with word bank" (or similar)
       → 3–6 sentences based on the text with key words removed.
   - In the "answer" field, provide an array of the missing words in correct order.
   - STANDARD: gaps with NO word bank OR a small word bank.
   - ADAPTED: MUST provide a clear word bank; sentences shorter and clearer.
   - Use the same missing words for both STANDARD and ADAPTED.

6) ORDERING / SEQUENCING (when ordering is enabled)
   - Create ONE item with:
       type: "ordering"
       skill: "event ordering" (or similar)
       → students put events/steps in correct order.
   - STANDARD: "Put these events in the correct order (1–4)."
   - ADAPTED: simpler wording, but same items and same correct order.
   - "answer" is an array that shows the correct order.

Quantity overall:
- Aim for about 8–12 items total across all enabled blocks.
- Use the lower end if the text is very short.

Language / difficulty:
- Respect the CEFR level ${level}.
- STANDARD prompts may use more complex structures.
- ADAPTED prompts should use simpler wording, shorter sentences, and more support (options, word banks, etc.), but MUST still target the same concept and answer.

Output format:
- You must return ONLY valid JSON with this shape:

{
  "items": [
    {
      "id": 1,
      "type": "gist" | "detail" | "trueFalse" | "vocab" | "cloze" | "ordering",
      "skill": "short description of skill",
      "answer": "..." OR ["...", "..."],
      "standard": {
        "prompt": "string",
        "options": ["..."] // optional, for MCQs
      },
      "adapted": {
        "prompt": "string",
        "options": ["..."] // optional, for MCQs
      }
    },
    ...
  ]
}

- ids MUST be consecutive integers starting at 1.
- Do not include any explanations or commentary outside this JSON.
- All prompts, options, and answers must be in ${outputLanguage}.
`;

    const userPrompt = `
You are creating exercises for this pair of texts.

STANDARD TEXT:
"""
${standardText}
"""

ADAPTED TEXT:
"""
${adaptedText}
"""

Context:
- Output language: ${outputLanguage}
- CEFR level: ${level}
- Output text type: ${outputType}
- Enabled blocks: ${enabledBlocks.join(", ")}

Remember:
- Every item must have a STANDARD prompt and an ADAPTED prompt that share the same answer.
- Use the enabled blocks only.
- Obey the vocabulary rule strictly: only use vocabulary / connectors / reference expressions that appear IDENTICALLY in both texts.
- Follow the block requirements above.
- Return only JSON in the required format.
`;

    const completionRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      }
    );

    if (!completionRes.ok) {
      const errJson = await completionRes.json().catch(() => null);
      console.error("OpenAI API error:", completionRes.status, errJson);
      return NextResponse.json(
        {
          error:
            errJson?.error?.message ||
            `OpenAI API error: ${completionRes.status}`,
        },
        { status: 500 }
      );
    }

    const completionJson = (await completionRes.json()) as any;
    const raw = completionJson.choices?.[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(
        { error: "No response from model when generating exercises." },
        { status: 500 }
      );
    }

    let parsed: ExercisesResponseBody;
    try {
      parsed = JSON.parse(raw) as ExercisesResponseBody;
    } catch (err) {
      console.error("Failed to parse exercises JSON:", err, raw);
      return NextResponse.json(
        {
          error:
            "Failed to parse exercises JSON from model. Try again or simplify the input.",
        },
        { status: 500 }
      );
    }

    if (!parsed.items || !Array.isArray(parsed.items)) {
      return NextResponse.json(
        { error: "Model response did not contain a valid items array." },
        { status: 500 }
      );
    }

    // Ensure ids are consecutive: 1..N
    const items = parsed.items;
    const sorted = [...items].sort((a, b) => a.id - b.id);
    const idsOk = sorted.every((item, idx) => item.id === idx + 1);
    if (!idsOk) {
      sorted.forEach((item, idx) => {
        item.id = idx + 1;
      });
    }

    return NextResponse.json(
      { items: sorted },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error in /api/exercises:", err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          "An unexpected error occurred while generating exercises.",
      },
      { status: 500 }
    );
  }
}
