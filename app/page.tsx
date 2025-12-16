"use client";

import { FormEvent, useState } from "react";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";

import jsPDF from "jspdf";

type AdaptResponse = {
  standardOutput: string;
  adaptedOutput: string;
  error?: string;
  warning?: string;
};

type ExportFormat = "txt" | "docx" | "pdf";

type ExerciseSide = {
  prompt: string;
  options?: string[];
};

type ExerciseItem = {
  id: number;
  type: string;
  skill: string;
  answer: string | string[];
  standard: ExerciseSide;
  adapted: ExerciseSide;
};

type ExercisesResponse = {
  items?: ExerciseItem[];
  error?: string;
};

type QuestionGoal = "balanced" | "wh" | "vocab" | "structure" | "exam";
type Level = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
type BlockId = "gist" | "detail" | "trueFalse" | "vocab" | "cloze" | "ordering";

type BlockWeights = Partial<Record<BlockId, number>>;

type GoalScaffold = {
  label: string;
  description: string;
  defaultsByLevel: Record<Level, BlockWeights>;
};

type DebugSnapshot = {
  timestamp: string;
  appVersion: string;
  source: {
    articleUrl: string | null;
    articleTitle: string | null;
    inputTextLength: number;
  };
  settings: {
    outputLanguage: string;
    level: string;
    outputType: string;
    dyslexiaFriendly: boolean;
  };
  adaptation: {
    standardOutput: string;
    adaptedOutput: string;
    standardWordCount: number;
    adaptedWordCount: number;
  };
  exercisesConfig: {
    questionGoal: QuestionGoal;
    includeGist: boolean;
    includeDetail: boolean;
    includeTrueFalse: boolean;
    includeVocab: boolean;
    includeCloze: boolean;
    includeOrdering: boolean;
  };
  exercises?: ExerciseItem[] | null;
};

// Fixed list of output languages
const languageOptions = [
  "English (British)",
  "English (American)",
  "Irish",
  "French",
  "German",
  "Spanish",
  "Latin",
  "Italian",
  "Portuguese",
];

const levels: Level[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const outputTypes = [
  "article",
  "essay",
  "blog post",
  "informal email",
  "formal email",
  "report",
  "social media chat",
];

const questionGoals: QuestionGoal[] = [
  "balanced",
  "wh",
  "vocab",
  "structure",
  "exam",
];

const goalConfig: Record<QuestionGoal, GoalScaffold> = {
  balanced: {
    label: "Balanced comprehension",
    description:
      "Mix of gist, detail and some vocabulary – a good all-round reading lesson.",
    defaultsByLevel: {
      A1: { gist: 1, detail: 3, trueFalse: 2, vocab: 2 },
      A2: { gist: 1, detail: 4, trueFalse: 2, vocab: 2, cloze: 1 },
      B1: { gist: 1, detail: 5, trueFalse: 1, vocab: 2, cloze: 2, ordering: 1 },
      B2: { gist: 1, detail: 5, vocab: 2, cloze: 2, ordering: 1 },
      C1: { gist: 1, detail: 4, vocab: 3, cloze: 3, ordering: 2 },
      C2: { gist: 1, detail: 4, vocab: 3, cloze: 3, ordering: 2 },
    },
  },
  wh: {
    label: "Who / what / where?",
    description:
      "Straightforward wh- questions about people, places and key facts.",
    defaultsByLevel: {
      A1: { gist: 1, detail: 4, trueFalse: 3 },
      A2: { gist: 1, detail: 5, trueFalse: 2, vocab: 1 },
      B1: { gist: 1, detail: 6, trueFalse: 1, vocab: 1 },
      B2: { gist: 1, detail: 6, vocab: 2 },
      C1: { gist: 1, detail: 6, vocab: 2 },
      C2: { gist: 1, detail: 6, vocab: 2 },
    },
  },
  vocab: {
    label: "Vocabulary & phrases",
    description:
      "Work on meanings in context, useful phrases and some form (parts of speech) where appropriate.",
    defaultsByLevel: {
      A1: { vocab: 4, trueFalse: 1, cloze: 1, detail: 2, gist: 1 },
      A2: { vocab: 5, cloze: 2, detail: 2, trueFalse: 1 },
      B1: { vocab: 4, cloze: 3, detail: 2, trueFalse: 1 },
      B2: { vocab: 4, cloze: 3, detail: 2 },
      C1: { vocab: 4, cloze: 3, detail: 2 },
      C2: { vocab: 4, cloze: 3, detail: 2 },
    },
  },
  structure: {
    label: "Text structure & sequencing",
    description:
      "Focus on ordering, paragraph flow and how the text is organised.",
    defaultsByLevel: {
      A1: { gist: 2, ordering: 2, detail: 2, trueFalse: 2 },
      A2: { gist: 1, ordering: 3, detail: 2, trueFalse: 2, cloze: 1 },
      B1: { gist: 1, ordering: 3, detail: 3, cloze: 1 },
      B2: { gist: 1, ordering: 4, detail: 3 },
      C1: { gist: 1, ordering: 4, detail: 3, cloze: 1 },
      C2: { gist: 1, ordering: 4, detail: 3, cloze: 1 },
    },
  },
  exam: {
    label: "Exam-style reading",
    description:
      "Closer to exam papers: more detail, cloze and options, tuned to the CEFR level.",
    defaultsByLevel: {
      A1: { detail: 4, trueFalse: 3, vocab: 1, cloze: 1, gist: 1 },
      A2: { detail: 5, trueFalse: 3, vocab: 1, cloze: 1, gist: 1 },
      B1: { detail: 5, cloze: 3, vocab: 2, gist: 1, ordering: 1 },
      B2: { detail: 5, cloze: 3, vocab: 2, gist: 1, ordering: 1 },
      C1: { detail: 4, cloze: 4, vocab: 3, gist: 1, ordering: 2 },
      C2: { detail: 4, cloze: 4, vocab: 3, gist: 1, ordering: 2 },
    },
  },
};

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export default function Home() {
  const [inputText, setInputText] = useState("");
  const [outputLanguage, setOutputLanguage] = useState(languageOptions[0]);
  const [level, setLevel] = useState<Level>("B1");
  const [outputType, setOutputType] = useState("article");
  const [dyslexiaFriendly, setDyslexiaFriendly] = useState(true);

  const [articleUrl, setArticleUrl] = useState("");
  const [articleTitle, setArticleTitle] = useState<string | null>(null);
  const [fetchingArticle, setFetchingArticle] = useState(false);
  const [articleError, setArticleError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdaptResponse | null>(null);

  const [exportFormat, setExportFormat] = useState<ExportFormat>("txt");

  // Exercise generation state
  const [includeGist, setIncludeGist] = useState(true);
  const [includeDetail, setIncludeDetail] = useState(true);
  const [includeTrueFalse, setIncludeTrueFalse] = useState(false);
  const [includeVocab, setIncludeVocab] = useState(true);
  const [includeCloze, setIncludeCloze] = useState(false);
  const [includeOrdering, setIncludeOrdering] = useState(false);

  const [questionGoal, setQuestionGoal] =
    useState<QuestionGoal>("balanced");

  const [exercises, setExercises] = useState<ExerciseItem[] | null>(null);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [exerciseError, setExerciseError] = useState<string | null>(null);

  // Separate export format for exercise sheets
  const [exerciseExportFormat, setExerciseExportFormat] =
    useState<ExportFormat>("docx");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setExercises(null);
    setExerciseError(null);

    try {
      const response = await fetch("/api/adapt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputText,
          outputLanguage,
          level,
          outputType,
          dyslexiaFriendly,
        }),
      });

      const data = (await response.json()) as AdaptResponse;

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      setResult(data);
    } catch (err: any) {
      setResult(null);
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFetchArticle() {
    if (!articleUrl.trim()) return;

    setFetchingArticle(true);
    setArticleError(null);
    setArticleTitle(null);

    try {
      const res = await fetch("/api/fetch-article", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: articleUrl.trim() }),
      });

      // Read body ONCE
      const raw = await res.text();
      let data: any = null;

      // Try to parse JSON, but don't crash if it's not JSON
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch (e) {
        console.error("Non-JSON response from /api/fetch-article:", raw);
        throw new Error(
          `Unexpected response from article service (status ${res.status}). Try pasting the text manually.`
        );
      }

      if (!res.ok) {
        throw new Error(
          data?.error ||
            `Failed to fetch article text (status ${res.status}).`
        );
      }

      if (!data?.text || !data.text.trim()) {
        throw new Error("Could not extract readable article text.");
      }

      setArticleTitle(data.title || null);
      setInputText(data.text);
    } catch (err: any) {
      setArticleError(
        err.message || "Something went wrong fetching the article."
      );
    } finally {
      setFetchingArticle(false);
    }
  }

  // === TEXT EXPORTS ===

  function buildExportLines() {
    if (!result) return [];

    const lines: string[] = [];

    lines.push("Aontas-10 export");
    lines.push(`Output language: ${outputLanguage}`);
    lines.push(`Level: ${level}`);
    lines.push(`Output type: ${outputType}`);
    lines.push(
      `Dyslexia-friendly: ${dyslexiaFriendly ? "yes" : "no"}`
    );
    if (articleUrl.trim()) {
      lines.push(`Source URL: ${articleUrl.trim()}`);
    }
    if (articleTitle) {
      lines.push(`Source title: ${articleTitle}`);
    }
    if (result.warning) {
      lines.push(`Warning: ${result.warning}`);
    }
    lines.push("");
    lines.push("===== STANDARD OUTPUT =====");
    lines.push("");
    result.standardOutput.split(/\r?\n/).forEach((line) => lines.push(line));
    lines.push("");
    lines.push("===== ADAPTED OUTPUT =====");
    lines.push("");
    result.adaptedOutput.split(/\r?\n/).forEach((line) => lines.push(line));
    lines.push("");

    return lines;
  }

  function downloadTxt(lines: string[], filename: string) {
    const content = lines.join("\n");
    const blob = new Blob([content], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

     // Updated DOCX export with nicer formatting + real tables
  async function downloadDocx(lines: string[], filename: string) {
    const blocks: (Paragraph | Table)[] = [];

    // Turn a single text line into a styled paragraph
    function makeParagraph(line: string): Paragraph {
      const trimmed = line.trim();
      let text = line || " ";

      // Banner-style headings (top titles etc.)
      const isBannerHeading =
        trimmed.startsWith("Aontas-10") ||
        trimmed.startsWith("Standard Reading") ||
        trimmed.startsWith("Adapted Reading") ||
        trimmed.startsWith("Standard Question Sheet") ||
        trimmed.startsWith("Adapted Question Sheet") ||
        trimmed.startsWith("Aontas-10 – Standard") ||
        trimmed.startsWith("Aontas-10 – Adapted") ||
        trimmed.startsWith("Aontas-10 – Teacher Key") ||
        trimmed.startsWith("Teacher Key");

      // Section headings like "=== Reading text (STANDARD version) ==="
      let isSectionHeading = false;
      if (/^===.*===\s*$/.test(trimmed)) {
        text = trimmed.replace(/^===\s*/, "").replace(/\s*===\s*$/, "");
        isSectionHeading = true;
      }

      const isHeading = isBannerHeading || isSectionHeading;

      // Smaller meta text
      const isMeta =
        trimmed.startsWith("Source:") ||
        trimmed.startsWith("Source title:") ||
        trimmed.startsWith("Source URL:") ||
        trimmed.startsWith("Exercise blocks:") ||
        trimmed.startsWith("Output language:") ||
        trimmed.startsWith("Level (CEFR):") ||
        trimmed.startsWith("Output type:") ||
        trimmed.startsWith("Standard text length:") ||
        trimmed.startsWith("Note:");

      // Font sizes (half-points)
      let fontSize = 22; // ~11pt body
      if (isHeading) fontSize = 26; // ~13pt heading
      if (isMeta) fontSize = 20; // ~10pt meta

      const paragraphOptions: any = {
        alignment: AlignmentType.LEFT,
        spacing: {
          line: 320, // ~1.3 line spacing
          after: isHeading ? 160 : 80,
          before: isHeading ? 120 : 0,
        },
        children: [
          new TextRun({
            text: text || " ",
            font: "Arial",
            size: fontSize,
            bold: isHeading,
          }),
        ],
      };

      // Underline section headings with a light border
      if (isSectionHeading) {
        paragraphOptions.border = {
          bottom: {
            color: "CCCCCC",
            size: 6,
            space: 1,
            value: "single",
          },
        };
      }

      return new Paragraph(paragraphOptions);
    }

    // Convert a Markdown-style table block into a real DOCX table
    function buildTableFromMarkdown(tableLines: string[]): Table {
      const rows: TableRow[] = [];
      let headerDone = false;

      tableLines.forEach((raw) => {
        const parts = raw
          .split("|")
          .slice(1, -1)
          .map((p) => p.trim());

        if (!parts.length) return;

        // Skip separator row like |----|-----|
        const isSeparatorRow = parts.every((cell) =>
          /^-+$/.test(cell.replace(/:/g, ""))
        );
        if (isSeparatorRow) return;

        const isHeader = !headerDone;
        if (!headerDone) headerDone = true;

        const cells = parts.map(
          (cellText) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: cellText || " ",
                      bold: isHeader,
                      font: "Arial",
                      size: 22,
                    }),
                  ],
                }),
              ],
            })
        );

        rows.push(new TableRow({ children: cells }));
      });

      if (!rows.length) {
        // Fallback: stuff the raw lines into a single cell
        return new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: tableLines.map((l) => makeParagraph(l)),
                }),
              ],
            }),
          ],
        });
      }

      return new Table({
        width: {
          size: 100,
          type: WidthType.PERCENTAGE,
        },
        rows,
      });
    }

    // Walk through all lines and decide: paragraph or table?
    let i = 0;
    while (i < lines.length) {
      const raw = lines[i];
      const trimmed = raw.trim();

      // Markdown table block: consecutive lines starting with "|"
      if (trimmed.startsWith("|") && trimmed.indexOf("|", 1) !== -1) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) {
          tableLines.push(lines[i].trim());
          i++;
        }
        blocks.push(buildTableFromMarkdown(tableLines));
        continue;
      }

      // Normal paragraph line
      blocks.push(makeParagraph(raw));
      i++;
    }

    // Narrow margins: ~2cm top/bottom, 1.5cm left/right
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1134, // ~2cm
                bottom: 1134,
                left: 850, // ~1.5cm
                right: 850,
              },
            },
          },
          children: blocks,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }


  function downloadPdf(
    lines: string[],
    filename: string,
    opts?: {
      fontSize?: number;
      lineHeight?: number;
      marginLeft?: number;
      marginTop?: number;
      maxWidth?: number;
    }
  ) {
    const doc = new jsPDF();
    const marginLeft = opts?.marginLeft ?? 20;
    const marginTop = opts?.marginTop ?? 20;
    const maxWidth = opts?.maxWidth ?? 170;
    const lineHeight = opts?.lineHeight ?? 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(opts?.fontSize ?? 11);

    let y = marginTop;

    lines.forEach((line) => {
      const split = doc.splitTextToSize(line || " ", maxWidth);
      split.forEach((txtLine: string) => {
        if (y > 280) {
          doc.addPage();
          y = marginTop;
        }
        doc.text(txtLine, marginLeft, y);
        y += lineHeight;
      });
      y += 2;
    });

    doc.save(filename);
  }

  // === FILENAME HELPERS ===

  function getSafeSlug() {
    const safeType = outputType.replace(/\s+/g, "-").toLowerCase();
    const safeLevel = level.toLowerCase();
    return { safeType, safeLevel };
  }

  function buildBaseName(stem?: string) {
    const { safeType, safeLevel } = getSafeSlug();
    const prefix = "aontas10";
    if (!stem) {
      return `${prefix}-${safeType}-${safeLevel}`;
    }
    return `${prefix}-${stem}-${safeType}-${safeLevel}`;
  }

  async function handleDownload() {
    if (!result) return;
    const lines = buildExportLines();
    if (!lines.length) return;

    const baseName = buildBaseName();

    if (exportFormat === "txt") {
      downloadTxt(lines, `${baseName}.txt`);
    } else if (exportFormat === "docx") {
      await downloadDocx(lines, `${baseName}.docx`);
    } else if (exportFormat === "pdf") {
      downloadPdf(lines, `${baseName}.pdf`, {
        fontSize: 11,
        lineHeight: 7,
      });
    }
  }

  // === INTERACTIVE HTML EXPORT ===

  function downloadHtml(content: string, filename: string) {
    const blob = new Blob([content], {
      type: "text/html;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function buildInteractiveHtml(): string | null {
    if (!result || !exercises || !exercises.length) return null;

    const dataObj = {
      meta: {
        title: articleTitle,
        url: articleUrl.trim() || null,
        outputLanguage,
        level,
        outputType,
      },
      reading: {
        standard: result.standardOutput,
        adapted: result.adaptedOutput,
      },
      exercises,
    };

    // Prevent </script> from breaking the inline script
    const dataJson = JSON.stringify(dataObj).replace(/</g, "\\u003c");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Aontas-10 interactive worksheet</title>
<style>
  body {
    margin: 0;
    padding: 16px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #f4f4f4;
  }
  .page {
    max-width: 900px;
    margin: 0 auto;
    background: #ffffff;
    padding: 16px 24px 24px 24px;
    border-radius: 8px;
    box-shadow: 0 0 8px rgba(0,0,0,0.08);
    font-size: 14px;
  }
  .page.font-large {
    font-size: 16px;
  }
  .page.spacing-relaxed #reading p,
  .page.spacing-relaxed #questions p {
    line-height: 1.6;
  }
  .page.theme-offwhite {
    background: #fdf8e6;
  }
  .page.theme-yellow {
    background: #fffbe0;
  }
  .page.theme-blue {
    background: #eaf4ff;
  }
  header h1 {
    margin: 0 0 4px;
    font-size: 1.4em;
  }
  header .meta {
    margin: 2px 0;
    font-size: 0.85em;
    color: #555;
  }
  .mode-toggle {
    margin: 12px 0 4px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .mode-btn {
    padding: 6px 10px;
    font-size: 13px;
    border-radius: 999px;
    border: 1px solid #ccc;
    background: #f3f3f3;
    cursor: pointer;
  }
  .mode-btn.active {
    background: #0ea5e9;
    color: #ffffff;
    border-color: #0ea5e9;
  }
  .mode-note {
    font-size: 0.8em;
    color: #555;
    margin: 0 0 8px 0;
  }
  .toolbar {
    margin: 8px 0 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    align-items: center;
    font-size: 12px;
  }
  .toolbar-group {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .toolbar-label {
    font-weight: 600;
  }
  .toolbar select {
    font-size: 12px;
    padding: 2px 4px;
  }
  .small-btn {
    padding: 4px 8px;
    font-size: 12px;
    border-radius: 6px;
    border: 1px solid #d1d5db;
    background: #f9fafb;
    cursor: pointer;
  }
  .small-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .tts-status {
    font-size: 11px;
    color: #555;
    margin-left: 4px;
  }
  #reading h2,
  #questions h2 {
    margin-top: 8px;
    margin-bottom: 6px;
    font-size: 1.15em;
  }
  #reading p,
  #questions p {
    font-size: 1em;
    line-height: 1.4;
    margin: 4px 0;
    text-align: left;
  }
  #questions .meta {
    font-size: 0.85em;
    color: #555;
  }
  .question {
    border-top: 1px solid #e0e0e0;
    padding-top: 8px;
    margin-top: 8px;
  }
  .prompt {
    font-weight: 600;
    margin-bottom: 4px;
  }
  .options label {
    display: block;
    margin-bottom: 2px;
    font-size: 0.95em;
    padding: 1px 2px;
  }
  .options input[type="radio"] {
    margin-right: 4px;
  }
  .options label.correct-choice {
    background: #e6f9f0;
    border-radius: 4px;
  }
  .options label.incorrect-choice {
    background: #fae6e6;
    border-radius: 4px;
  }
  .blanks label {
    display: block;
    margin-bottom: 4px;
    font-size: 0.95em;
  }
  .blanks input[type="text"],
  .text-answer {
    padding: 3px 6px;
    font-size: 0.95em;
    width: 100%;
    max-width: 360px;
    box-sizing: border-box;
  }
  #check-btn {
    margin-top: 14px;
    padding: 8px 14px;
    font-size: 13px;
    border-radius: 6px;
    border: none;
    background: #0ea5e9;
    color: #ffffff;
    cursor: pointer;
  }
  #score {
    margin-top: 8px;
    font-size: 13px;
    font-weight: 600;
  }
  .feedback {
    margin-top: 4px;
    font-size: 12px;
  }
  .feedback.correct {
    color: #0a7a3b;
  }
  .feedback.incorrect {
    color: #b00020;
  }
  .feedback.neutral {
    color: #555555;
  }
  .dict-panel {
    margin-top: 8px;
    padding: 8px;
    font-size: 12px;
    border-radius: 4px;
    background: #f3f4f6;
    border: 1px solid #d1d5db;
  }
  .dict-panel p {
    margin: 2px 0;
  }
</style>
</head>
<body>
<div class="page">
  <header id="header"></header>
  <div class="mode-toggle">
    <button class="mode-btn active" data-mode="standard">Standard</button>
    <button class="mode-btn" data-mode="adapted">Adapted</button>
  </div>
  <p class="mode-note" id="mode-note">
    Standard = fuller, more complex text and tasks. Adapted = same ideas with reduced cognitive load.
  </p>
  <div class="toolbar">
    <div class="toolbar-group">
      <span class="toolbar-label">Read aloud:</span>
      <button id="tts-play" class="small-btn">Play</button>
      <button id="tts-pause" class="small-btn">Pause/Resume</button>
      <button id="tts-stop" class="small-btn">Stop</button>
      <label>
        Speed
        <select id="tts-speed">
          <option value="0.9">Slow</option>
          <option value="1" selected>Normal</option>
          <option value="1.1">Fast</option>
        </select>
      </label>
      <label>
        Voice
        <select id="tts-voice">
          <option value="">Default</option>
        </select>
      </label>
      <span id="tts-status" class="tts-status"></span>
    </div>
    <div class="toolbar-group">
      <span class="toolbar-label">View:</span>
      <label>
        Font
        <select id="view-font">
          <option value="normal" selected>Normal</option>
          <option value="large">Large</option>
        </select>
      </label>
      <label>
        Spacing
        <select id="view-spacing">
          <option value="standard" selected>Standard</option>
          <option value="relaxed">Relaxed</option>
        </select>
      </label>
      <label>
        Background
        <select id="view-theme">
          <option value="default" selected>Default</option>
          <option value="offwhite">Off-white</option>
          <option value="yellow">Yellow</option>
          <option value="blue">Blue</option>
        </select>
      </label>
    </div>
    <div class="toolbar-group">
      <span class="toolbar-label">Word help:</span>
      <button id="define-selection-btn" class="small-btn">Define</button>
      <button id="lookup-selection-btn" class="small-btn">Look up</button>
      <button id="translate-selection-btn" class="small-btn">Translate</button>
      <button id="image-selection-btn" class="small-btn">Picture</button>
      <button id="pronounce-selection-btn" class="small-btn">Pronounce</button>
    </div>
  </div>
  <section id="reading"></section>
  <section id="questions"></section>
  <button id="check-btn">Check answers</button>
  <div id="score" aria-live="polite"></div>
  <div id="dict-panel" class="dict-panel" aria-live="polite"></div>
  <div id="pronounce-panel" class="dict-panel" aria-live="polite"></div>
</div>
<script>
const data = ${dataJson};

(function(){
  var modeButtons = document.querySelectorAll(".mode-btn");
  var readingEl = document.getElementById("reading");
  var questionsEl = document.getElementById("questions");
  var headerEl = document.getElementById("header");
  var scoreEl = document.getElementById("score");
  var checkBtn = document.getElementById("check-btn");
  var pageEl = document.querySelector(".page");
  var dictPanel = document.getElementById("dict-panel");
  var pronouncePanel = document.getElementById("pronounce-panel");
  var voiceSel = document.getElementById("tts-voice");

  var synthSupported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  var currentUtterance = null;
  var voices = [];

  var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var recogSupported = !!Recognition;
  var recognizer = recogSupported ? new Recognition() : null;
  var currentTargetPhrase = "";

  function setTtsStatus(msg) {
    var el = document.getElementById("tts-status");
    if (!el) return;
    el.textContent = msg || "";
  }

  function guessLangCode() {
    var lang = (data.meta.outputLanguage || "").toLowerCase();
    if (lang.indexOf("irish") !== -1) return "ga-IE";
    if (lang.indexOf("french") !== -1) return "fr-FR";
    if (lang.indexOf("german") !== -1) return "de-DE";
    if (lang.indexOf("spanish") !== -1) return "es-ES";
    if (lang.indexOf("italian") !== -1) return "it-IT";
    if (lang.indexOf("portuguese") !== -1) return "pt-PT";
    if (lang.indexOf("latin") !== -1) return "la";
    if (lang.indexOf("american") !== -1) return "en-US";
    if (lang.indexOf("british") !== -1) return "en-GB";
    if (lang.indexOf("english") !== -1) return "en-GB";
    return "";
  }

  function getCurrentMode() {
    var activeBtn = document.querySelector(".mode-btn.active");
    return (activeBtn && activeBtn.getAttribute("data-mode")) || "standard";
  }

  function getReadingTextForMode(mode) {
    var text = (data.reading && data.reading[mode]) || "";
    return text;
  }

  function populateVoices() {
    if (!synthSupported || !window.speechSynthesis) return;
    var all = window.speechSynthesis.getVoices();
    if (!all || !all.length) return;

    var langCode = guessLangCode();
    var primary = [];
    var fallback = [];

    all.forEach(function(v) {
      if (langCode && v.lang && v.lang.toLowerCase().indexOf(langCode.toLowerCase().slice(0,2)) === 0) {
        primary.push(v);
      } else {
        fallback.push(v);
      }
    });

    voices = primary.length ? primary : all;

    if (!voiceSel) return;
    voiceSel.innerHTML = "";
    var defaultOpt = document.createElement("option");
    defaultOpt.value = "";
    defaultOpt.textContent = "Default";
    voiceSel.appendChild(defaultOpt);

    voices.forEach(function(v, idx) {
      var opt = document.createElement("option");
      opt.value = v.name;
      opt.textContent = v.name + " (" + v.lang + ")";
      voiceSel.appendChild(opt);
    });
  }

  if (synthSupported && window.speechSynthesis) {
    populateVoices();
    window.speechSynthesis.onvoiceschanged = populateVoices;
  }

  function speakText(text) {
    if (!synthSupported || !text || !text.trim()) return;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    var rateSel = document.getElementById("tts-speed");
    var rate = 1;
    if (rateSel) {
      var val = parseFloat(rateSel.value);
      if (!isNaN(val)) rate = val;
    }
    u.rate = rate;
    var langCode = guessLangCode();
    if (langCode) u.lang = langCode;

    if (voiceSel && voiceSel.value && voices && voices.length) {
      var chosen = null;
      voices.forEach(function(v) {
        if (v.name === voiceSel.value) chosen = v;
      });
      if (chosen) {
        u.voice = chosen;
      }
    }

    currentUtterance = u;
    u.onstart = function(){ setTtsStatus("Reading..."); };
    u.onend = function(){ setTtsStatus("Done"); };
    u.onerror = function(){ setTtsStatus("Error"); };
    window.speechSynthesis.speak(u);
  }

  function levenshtein(a, b) {
    a = a || "";
    b = b || "";
    var m = a.length, n = b.length;
    var dp = [];
    for (var i = 0; i <= m; i++) {
      dp[i] = [];
      dp[i][0] = i;
    }
    for (var j = 0; j <= n; j++) {
      dp[0][j] = j;
    }
    for (var i2 = 1; i2 <= m; i2++) {
      for (var j2 = 1; j2 <= n; j2++) {
        var cost = a.charAt(i2-1) === b.charAt(j2-1) ? 0 : 1;
        dp[i2][j2] = Math.min(
          dp[i2-1][j2] + 1,
          dp[i2][j2-1] + 1,
          dp[i2-1][j2-1] + cost
        );
      }
    }
    return dp[m][n];
  }

  function similarity(a, b) {
    var s1 = (a || "")
      .toLowerCase()
      .replace(/[^a-zà-ÿœæçñüß0-9\s]/g, "")
      .trim();
    var s2 = (b || "")
      .toLowerCase()
      .replace(/[^a-zà-ÿœæçñüß0-9\s]/g, "")
      .trim();
    if (!s1 || !s2) return 0;
    var dist = levenshtein(s1, s2);
    var maxLen = Math.max(s1.length, s2.length);
    return 1 - dist / maxLen;
  }

  function buildVocabIndex() {
    var vocab = {};
    (data.exercises || []).forEach(function(item) {
      if (item.type === "vocab") {
        var ans = item.answer;
        var meaning = Array.isArray(ans) ? ans.join("; ") : String(ans || "");
        var prompt = (item.standard && item.standard.prompt) || "";
        var match = prompt.match(/["“”'‘’](.+?)["“”'‘’]/);
        if (match && match[1]) {
          var word = match[1].trim();
          if (word) {
            vocab[word.toLowerCase()] = { word: word, meaning: meaning };
          }
        }
      }
    });
    return vocab;
  }

  var vocabIndex = buildVocabIndex();

  function renderHeader() {
    headerEl.innerHTML = "";
    var hTitle = document.createElement("h1");
    hTitle.textContent = data.meta.title || "Aontas-10 reading";
    headerEl.appendChild(hTitle);

    if (data.meta.url) {
      var pUrl = document.createElement("p");
      pUrl.className = "meta";
      pUrl.textContent = "Source: " + data.meta.url;
      headerEl.appendChild(pUrl);
    }

    var metaBits = [];
    if (data.meta.outputLanguage) metaBits.push(data.meta.outputLanguage);
    if (data.meta.level) metaBits.push(data.meta.level);
    if (data.meta.outputType) metaBits.push(data.meta.outputType);

    if (metaBits.length) {
      var pMeta = document.createElement("p");
      pMeta.className = "meta";
      pMeta.textContent = metaBits.join(" · ");
      headerEl.appendChild(pMeta);
    }
  }

  function renderReading(mode) {
    readingEl.innerHTML = "";
    var title = document.createElement("h2");
    title.textContent = "Reading text (" + (mode === "standard" ? "standard" : "adapted") + " version)";
    readingEl.appendChild(title);

    var text = (data.reading && data.reading[mode]) || "";
        var paragraphs = text.split(/[\\r\\n]+/);

    paragraphs.forEach(function(line) {
      if (!line.trim()) return;
      var p = document.createElement("p");
      p.textContent = line;
      readingEl.appendChild(p);
    });
  }

  function renderQuestions(mode) {
    questionsEl.innerHTML = "";
    var title = document.createElement("h2");
    title.textContent = "Questions (" + (mode === "standard" ? "standard" : "adapted") + ")";
    questionsEl.appendChild(title);

    var instr = document.createElement("p");
    instr.className = "meta";
    instr.textContent = "Read the text, then answer the questions. Click 'Check answers' to see feedback.";
    questionsEl.appendChild(instr);

    (data.exercises || []).forEach(function(item) {
      var container = document.createElement("div");
      container.className = "question";
      container.setAttribute("data-qid", String(item.id));

      var prompt = document.createElement("div");
      prompt.className = "prompt";
      var side = mode === "standard" ? item.standard : item.adapted;
      prompt.textContent = "Q" + item.id + ". " + side.prompt;
      container.appendChild(prompt);

      if (side.options && side.options.length) {
        var opts = document.createElement("div");
        opts.className = "options";
        side.options.forEach(function(opt, idx) {
          var id = "q" + item.id + "_opt" + idx;
          var label = document.createElement("label");
          label.setAttribute("for", id);
          var input = document.createElement("input");
          input.type = "radio";
          input.name = "q" + item.id;
          input.id = id;
          input.value = opt;
          label.appendChild(input);
          var span = document.createElement("span");
          span.textContent = " " + opt;
          label.appendChild(span);
          opts.appendChild(label);
        });
        container.appendChild(opts);
      } else {
        var ans = item.answer;
        if (Array.isArray(ans)) {
          var blanks = document.createElement("div");
          blanks.className = "blanks";
          ans.forEach(function(_, idx) {
            var lab = document.createElement("label");
            lab.textContent = "Answer " + (idx + 1) + ": ";
            var input = document.createElement("input");
            input.type = "text";
            input.setAttribute("data-blank", String(idx));
            input.name = "q" + item.id + "_blank" + idx;
            lab.appendChild(input);
            blanks.appendChild(lab);
          });
          container.appendChild(blanks);
        } else {
          var input = document.createElement("input");
          input.type = "text";
          input.name = "q" + item.id + "_text";
          input.className = "text-answer";
          container.appendChild(input);
        }
      }

      var fb = document.createElement("div");
      fb.className = "feedback";
      container.appendChild(fb);

      questionsEl.appendChild(container);
    });
  }

  function normalize(str) {
    return String(str || "").trim().toLowerCase();
  }

  function checkAnswers() {
    var correct = 0;
    var total = 0;

    (data.exercises || []).forEach(function(item) {
      var container = questionsEl.querySelector('[data-qid="' + item.id + '"]');
      if (!container) return;
      var fb = container.querySelector(".feedback");
      var ans = item.answer;
      var isCorrect = false;
      var auto = true;
      var qType = (item.type || "").toLowerCase();
      var qSkill = (item.skill || "").toLowerCase();

      // Hard-code some question types as teacher-checked:
      // matching headings, ordering / sequencing etc.
      if (qType.indexOf("matching") !== -1 ||
          qSkill.indexOf("matching") !== -1 ||
          qType.indexOf("order") !== -1 ||
          qSkill.indexOf("order") !== -1) {
        auto = false;
      }

      if (auto) {
        if (Array.isArray(ans)) {
          // Multi-blank exact answers
          var inputs = container.querySelectorAll('input[type="text"][data-blank]');
          if (!inputs.length || inputs.length !== ans.length) {
            auto = false;
          } else {
            total++;
            isCorrect = true;
            inputs.forEach(function(input, idx) {
              var val = normalize(input.value);
              var target = normalize(ans[idx]);
              if (!val || val !== target) {
                isCorrect = false;
              }
            });
          }
        } else {
          // Single answer: either MCQ or free text
          var radios = container.querySelectorAll('input[type="radio"][name="q' + item.id + '"]');
          if (radios.length) {
            // Multiple-choice
            var optionsList = [];
            if (item.standard && item.standard.options && item.standard.options.length) {
              optionsList = item.standard.options;
            } else if (item.adapted && item.adapted.options && item.adapted.options.length) {
              optionsList = item.adapted.options;
            }
            var normalizedAns = normalize(ans);
            var hasExactOption = optionsList.some(function(opt) {
              return normalize(opt) === normalizedAns;
            });

            // If the shared answer text doesn't exactly match any option,
            // fall back to teacher-checked instead of pretending to auto-mark.
            if (!hasExactOption) {
              auto = false;
            } else {
              total++;
              var chosen = "";
              radios.forEach(function(r) {
                var lab = r.parentElement;
                if (lab && lab.classList) {
                  lab.classList.remove("correct-choice", "incorrect-choice");
                }
                if (r.checked) chosen = r.value;
              });
              isCorrect = normalize(chosen) === normalizedAns;
              radios.forEach(function(r) {
                if (r.checked) {
                  var lab = r.parentElement;
                  if (lab && lab.classList) {
                    lab.classList.add(isCorrect ? "correct-choice" : "incorrect-choice");
                  }
                }
              });
            }
          } else {
            // Free-text single answer
            var textInput = container.querySelector('input[type="text"]');
            if (!textInput) {
              auto = false;
            } else {
              total++;
              var val = normalize(textInput.value);
              var target = normalize(ans);
              isCorrect =
                !!val &&
                (val === target ||
                  target.indexOf(val) !== -1 ||
                  val.indexOf(target) !== -1);
            }
          }
        }
      }

      if (!fb) return;

      if (!auto) {
        fb.textContent = "Answer: " + (Array.isArray(ans) ? ans.join(", ") : ans);
        fb.className = "feedback neutral";
      } else if (isCorrect) {
        correct++;
        fb.textContent = "✓ Correct";
        fb.className = "feedback correct";
      } else {
        fb.textContent = "✗ Check again. Answer: " + (Array.isArray(ans) ? ans.join(", ") : ans);
        fb.className = "feedback incorrect";
      }
    });

    scoreEl.textContent = "Score: " + correct + " / " + total + " (auto-marked questions)";
  }

  function setMode(mode) {
    renderReading(mode);
    renderQuestions(mode);
    modeButtons.forEach(function(btn) {
      if (btn.getAttribute("data-mode") === mode) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
    scoreEl.textContent = "";
    if (synthSupported && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setTtsStatus("");
    }
  }

  // View settings
  var viewFontSel = document.getElementById("view-font");
  var viewSpacingSel = document.getElementById("view-spacing");
  var viewThemeSel = document.getElementById("view-theme");

  function applyViewSettings() {
    if (!pageEl) return;
    pageEl.classList.toggle("font-large", viewFontSel && viewFontSel.value === "large");
    pageEl.classList.toggle("spacing-relaxed", viewSpacingSel && viewSpacingSel.value === "relaxed");

    pageEl.classList.remove("theme-offwhite", "theme-yellow", "theme-blue");
    var themeVal = (viewThemeSel && viewThemeSel.value) || "default";
    if (themeVal === "offwhite") pageEl.classList.add("theme-offwhite");
    else if (themeVal === "yellow") pageEl.classList.add("theme-yellow");
    else if (themeVal === "blue") pageEl.classList.add("theme-blue");
  }

  if (viewFontSel) viewFontSel.addEventListener("change", applyViewSettings);
  if (viewSpacingSel) viewSpacingSel.addEventListener("change", applyViewSettings);
  if (viewThemeSel) viewThemeSel.addEventListener("change", applyViewSettings);

  applyViewSettings();

  function showDictMessage(title, body) {
    if (!dictPanel) return;
    dictPanel.innerHTML = "";
    var strong = document.createElement("strong");
    strong.textContent = title;
    dictPanel.appendChild(strong);
    var p = document.createElement("p");
    p.textContent = body;
    dictPanel.appendChild(p);
  }

  function showPronounceMessage(title, body) {
    if (!pronouncePanel) return;
    pronouncePanel.innerHTML = "";
    var strong = document.createElement("strong");
    strong.textContent = title;
    pronouncePanel.appendChild(strong);
    var p = document.createElement("p");
    p.textContent = body;
    pronouncePanel.appendChild(p);
  }

  function buildLookupUrl(word) {
    var base = "https://www.google.com/search?q=";
    var lang = (data.meta.outputLanguage || "");
    var query = "define " + word + " in " + lang;
    return base + encodeURIComponent(query);
  }

  function buildTranslateUrl(text) {
    var base = "https://translate.google.com/?sl=auto&op=translate&text=";
    return base + encodeURIComponent(text);
  }

  function buildImageSearchUrl(text) {
    var base = "https://www.google.com/search?tbm=isch&q=";
    return base + encodeURIComponent(text);
  }

  renderHeader();
  setMode("standard");

  modeButtons.forEach(function(btn) {
    btn.addEventListener("click", function() {
      setMode(btn.getAttribute("data-mode") || "standard");
    });
  });

  checkBtn.addEventListener("click", function() {
    checkAnswers();
  });

  // TTS controls
  var ttsPlay = document.getElementById("tts-play");
  var ttsPause = document.getElementById("tts-pause");
  var ttsStop = document.getElementById("tts-stop");

  if (synthSupported) {
    if (ttsPlay) {
      ttsPlay.addEventListener("click", function() {
        var sel = window.getSelection().toString();
        var txt = sel && sel.trim()
          ? sel
          : getReadingTextForMode(getCurrentMode());
        speakText(txt);
      });
    }
    if (ttsPause) {
      ttsPause.addEventListener("click", function() {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          setTtsStatus("Paused");
        } else if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
          setTtsStatus("Reading...");
        }
      });
    }
    if (ttsStop) {
      ttsStop.addEventListener("click", function() {
        window.speechSynthesis.cancel();
        setTtsStatus("Stopped");
      });
    }
  } else {
    if (ttsPlay) ttsPlay.disabled = true;
    if (ttsPause) ttsPause.disabled = true;
    if (ttsStop) ttsStop.disabled = true;
    setTtsStatus("Read-aloud not supported in this browser.");
  }

  // Dictionary / lookup / translate / image / pronunciation controls
  var defineBtn = document.getElementById("define-selection-btn");
  var lookupBtn = document.getElementById("lookup-selection-btn");
  var translateBtn = document.getElementById("translate-selection-btn");
  var imageBtn = document.getElementById("image-selection-btn");
  var pronounceBtn = document.getElementById("pronounce-selection-btn");

  if (defineBtn) {
    defineBtn.addEventListener("click", function() {
      var sel = window.getSelection().toString().trim();
      if (!sel) {
        showDictMessage("No selection", "Highlight a word in the text, then click 'Define'.");
        return;
      }
      var key = sel.toLowerCase();
      var entry = vocabIndex[key];
      if (entry) {
        showDictMessage(entry.word, entry.meaning || "No stored definition.");
      } else {
        showDictMessage(sel, "No stored definition in this worksheet. Try 'Look up' or 'Translate'.");
      }
    });
  }

  if (lookupBtn) {
    lookupBtn.addEventListener("click", function() {
      var sel = window.getSelection().toString().trim();
      if (!sel) {
        showDictMessage("No selection", "Highlight a word in the text, then click 'Look up'.");
        return;
      }
      var url = buildLookupUrl(sel);
      window.open(url, "_blank");
    });
  }

  if (translateBtn) {
    translateBtn.addEventListener("click", function() {
      var sel = window.getSelection().toString().trim();
      if (!sel) {
        showDictMessage("No selection", "Highlight a word or phrase, then click 'Translate'.");
        return;
      }
      var url = buildTranslateUrl(sel);
      window.open(url, "_blank");
    });
  }

  if (imageBtn) {
    imageBtn.addEventListener("click", function() {
      var sel = window.getSelection().toString().trim();
      if (!sel) {
        showDictMessage("No selection", "Highlight a word or phrase, then click 'Picture'.");
        return;
      }
      var url = buildImageSearchUrl(sel);
      window.open(url, "_blank");
    });
  }

  if (recognizer) {
    var langCode = guessLangCode();
    recognizer.lang = langCode || (navigator.language || "en-US");
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 1;

    recognizer.onresult = function(event) {
      var transcript = "";
      if (event.results && event.results[0] && event.results[0][0]) {
        transcript = event.results[0][0].transcript || "";
      }
      var sim = similarity(currentTargetPhrase, transcript);
      var percent = Math.round(sim * 100);
      var title = "You said:";
      var body = "'" + transcript + "'. Similarity to target: " + percent + "%.";
      if (percent > 80) {
        body += " Nice pronunciation!";
      } else if (percent > 50) {
        body += " Close! Try again, listening carefully to the sounds.";
      } else {
        body += " The recognition might be off, or you may need to try again more clearly.";
      }
      showPronounceMessage(title, body);
    };

    recognizer.onerror = function(event) {
      showPronounceMessage("Recognition error", event.error || "Something went wrong.");
    };

    recognizer.onend = function() {
      // no-op
    };
  }

  if (pronounceBtn) {
    if (!recogSupported) {
      pronounceBtn.disabled = true;
      showPronounceMessage("Pronunciation practice", "Speech recognition is not supported in this browser.");
    } else {
      pronounceBtn.addEventListener("click", function() {
        var sel = window.getSelection().toString().trim();
        if (!sel) {
          showPronounceMessage("No selection", "Highlight a word or short phrase, then click 'Pronounce' and speak.");
          return;
        }
        currentTargetPhrase = sel;
        showPronounceMessage("Listening...", "When prompted by the browser, allow microphone access and say: '" + sel + "'.");
        try {
          recognizer.start();
        } catch (e) {
          // Some browsers throw if already started
        }
      });
    }
  }
})();
</script>
</body>
</html>`;

    return html;
  }

  function handleDownloadInteractiveHtml() {
    const html = buildInteractiveHtml();
    if (!html) return;
    const baseName = buildBaseName("interactive");
    downloadHtml(html, `${baseName}.html`);
  }

  // === DEBUG SNAPSHOT ===

  function buildDebugSnapshot(): DebugSnapshot | null {
    if (!result) return null;

    return {
      timestamp: new Date().toISOString(),
      appVersion: "aontas-10 v0.1",
      source: {
        articleUrl: articleUrl.trim() || null,
        articleTitle: articleTitle || null,
        inputTextLength: countWords(inputText),
      },
      settings: {
        outputLanguage,
        level,
        outputType,
        dyslexiaFriendly,
      },
      adaptation: {
        standardOutput: result.standardOutput,
        adaptedOutput: result.adaptedOutput,
        standardWordCount: countWords(result.standardOutput),
        adaptedWordCount: countWords(result.adaptedOutput),
      },
      exercisesConfig: {
        questionGoal,
        includeGist,
        includeDetail,
        includeTrueFalse,
        includeVocab,
        includeCloze,
        includeOrdering,
      },
      exercises,
    };
  }

  function downloadDebugJson() {
    const snapshot = buildDebugSnapshot();
    if (!snapshot) return;

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const baseName = buildBaseName("debug");
    a.href = url;
    a.download = `${baseName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // === EXERCISE GENERATION ===

  function applyGoalDefaults(goal: QuestionGoal, lvl: Level) {
    const cfg = goalConfig[goal];
    const weights = cfg.defaultsByLevel[lvl];

    setIncludeGist(!!weights.gist);
    setIncludeDetail(!!weights.detail);
    setIncludeTrueFalse(!!weights.trueFalse);
    setIncludeVocab(!!weights.vocab);
    setIncludeCloze(!!weights.cloze);
    setIncludeOrdering(!!weights.ordering);
  }

  async function handleGenerateExercises() {
    if (!result) return;

    if (
      !includeGist &&
      !includeDetail &&
      !includeTrueFalse &&
      !includeVocab &&
      !includeCloze &&
      !includeOrdering
    ) {
      setExerciseError("Select at least one exercise block.");
      return;
    }

    setLoadingExercises(true);
    setExerciseError(null);
    setExercises(null);

    try {
      const response = await fetch("/api/exercises", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          standardText: result.standardOutput,
          adaptedText: result.adaptedOutput,
          outputLanguage,
          level,
          outputType,
          questionGoal,
          blockWeights: {
            gist: includeGist ? 1 : 0,
            detail: includeDetail ? 1 : 0,
            trueFalse: includeTrueFalse ? 1 : 0,
            vocab: includeVocab ? 1 : 0,
            cloze: includeCloze ? 1 : 0,
            ordering: includeOrdering ? 1 : 0,
          },
          includeGist,
          includeDetail,
          includeTrueFalse,
          includeVocab,
          includeCloze,
          includeOrdering,
        }),
      });

      const data = (await response.json()) as ExercisesResponse;

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      setExercises(data.items || []);
    } catch (err: any) {
      setExerciseError(
        err.message || "Something went wrong generating exercises."
      );
      setExercises(null);
    } finally {
      setLoadingExercises(false);
    }
  }

   // === EXERCISE EXPORT HELPERS ===

  function splitPromptLines(raw: string | undefined | null): string[] {
    if (!raw) return [];
    return raw
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => line.trim() !== "");
  }

  function addQuestionBlock(
    lines: string[],
    item: ExerciseItem,
    side: "standard" | "adapted"
  ) {
    const sideData = side === "standard" ? item.standard : item.adapted;
    const promptLines = splitPromptLines(sideData.prompt);

    if (!promptLines.length) {
      lines.push(`Q${item.id}.`);
    } else {
      // First line with Q number
      lines.push(`Q${item.id}. ${promptLines[0]}`);
      // Subsequent lines indented (so “Headings: A. …” etc don’t sit in a single clump)
      for (let i = 1; i < promptLines.length; i++) {
        lines.push(`   ${promptLines[i]}`);
      }
    }

    // Multiple-choice options, if present
    if (sideData.options && sideData.options.length) {
      sideData.options.forEach((opt, idx) => {
        const label = String.fromCharCode(97 + idx); // a, b, c...
        lines.push(`   ${label}) ${opt}`);
      });
    }

    lines.push("");
  }

  function addPromptBlock(
    lines: string[],
    label: string,
    prompt: string | undefined
  ) {
    const promptLines = splitPromptLines(prompt || "");
    const baseIndent = "  ";

    if (!promptLines.length) {
      lines.push(`${baseIndent}${label}:`);
      return;
    }

    // First line with label
    lines.push(`${baseIndent}${label}: ${promptLines[0]}`);
    // Subsequent lines further indented
    for (let i = 1; i < promptLines.length; i++) {
      lines.push(`${baseIndent}   ${promptLines[i]}`);
    }
  }

  function buildSelectedBlocksLabel(): string {
    const blocks: string[] = [];
    if (includeGist) blocks.push("Gist / main idea");
    if (includeDetail) blocks.push("Detail questions");
    if (includeTrueFalse) blocks.push("True / False");
    if (includeVocab) blocks.push("Vocabulary");
    if (includeCloze) blocks.push("Cloze / gap-fill");
    if (includeOrdering) blocks.push("Ordering");
    return blocks.length ? blocks.join(", ") : "None";
  }

  // STUDENT-FACING: standard question sheet (no reading)
  function buildStandardExerciseLines(): string[] {
    if (!exercises || !exercises.length) return [];
    const lines: string[] = [];

    lines.push("Aontas-10 – Standard Question Sheet");
    lines.push("");
    if (articleTitle) {
      lines.push(articleTitle);
    }
    if (articleUrl.trim()) {
      lines.push(`Source: ${articleUrl.trim()}`);
    }
    lines.push(
      `Exercise blocks: ${buildSelectedBlocksLabel()}`
    );
    lines.push("");
    lines.push(
      "Instructions: Answer the questions below. Use the STANDARD version of the text."
    );
    lines.push("");

    const sorted = [...exercises].sort((a, b) => a.id - b.id);
    sorted.forEach((item) => addQuestionBlock(lines, item, "standard"));

    return lines;
  }

  // STUDENT-FACING: adapted question sheet (no reading)
  function buildAdaptedExerciseLines(): string[] {
    if (!exercises || !exercises.length) return [];
    const lines: string[] = [];

    lines.push("Aontas-10 – Adapted Question Sheet");
    lines.push("");
    if (articleTitle) {
      lines.push(articleTitle);
    }
    if (articleUrl.trim()) {
      lines.push(`Source: ${articleUrl.trim()}`);
    }
    lines.push(
      `Exercise blocks: ${buildSelectedBlocksLabel()}`
    );
    lines.push("");
    lines.push(
      "Instructions: Answer the questions below. Use the ADAPTED version of the text."
    );
    lines.push("");

    const sorted = [...exercises].sort((a, b) => a.id - b.id);
    sorted.forEach((item) => addQuestionBlock(lines, item, "adapted"));

    return lines;
  }

  // TEACHER KEY: full metadata stays
  function buildTeacherKeyLines(): string[] {
    if (!exercises || !exercises.length || !result) return [];
    const lines: string[] = [];

    const standardWords = countWords(result.standardOutput);
    const adaptedWords = countWords(result.adaptedOutput);

    lines.push("Aontas-10 – Teacher Key");
    lines.push("");
    lines.push(`Output language: ${outputLanguage}`);
    lines.push(`Level (CEFR): ${level}`);
    lines.push(`Output type: ${outputType}`);
    if (articleTitle) {
      lines.push(`Source title: ${articleTitle}`);
    }
    if (articleUrl.trim()) {
      lines.push(`Source URL: ${articleUrl.trim()}`);
    }
    lines.push(`Exercise blocks: ${buildSelectedBlocksLabel()}`);
    lines.push(
      `Standard text length: ~${standardWords} words · Adapted text length: ~${adaptedWords} words`
    );
    lines.push(
      "Note: Standard and adapted question sheets share this answer key. Question numbers match across both versions."
    );
    lines.push(
      "Adapted questions use simpler language and more support, but target the same concepts and answers as the standard questions."
    );
    lines.push("");

    const sorted = [...exercises].sort((a, b) => a.id - b.id);

    sorted.forEach((item) => {
      lines.push(`Q${item.id} – type: ${item.type}, skill: ${item.skill}`);
      lines.push("");

      addPromptBlock(lines, "Standard prompt", item.standard.prompt);
      if (item.standard.options && item.standard.options.length) {
        lines.push("  Standard options:");
        item.standard.options.forEach((opt, idx) => {
          const label = String.fromCharCode(97 + idx);
          lines.push(`    ${label}) ${opt}`);
        });
      }

      lines.push("");
      addPromptBlock(lines, "Adapted prompt", item.adapted.prompt);
      if (item.adapted.options && item.adapted.options.length) {
        lines.push("  Adapted options:");
        item.adapted.options.forEach((opt, idx) => {
          const label = String.fromCharCode(97 + idx);
          lines.push(`    ${label}) ${opt}`);
        });
      }

      const answerText = Array.isArray(item.answer)
        ? item.answer.join(" | ")
        : item.answer;
      lines.push(`  Answer: ${answerText}`);
      lines.push("");
    });

    return lines;
  }

  // === COMBINED READING + QUESTIONS (student sheets) ===

  function buildStandardCombinedLines(): string[] {
    if (!result || !exercises || !exercises.length) return [];
    const lines: string[] = [];

    lines.push("Aontas-10 – Standard Reading & Questions");
    lines.push("");
    if (articleTitle) {
      lines.push(articleTitle);
    }
    if (articleUrl.trim()) {
      lines.push(`Source: ${articleUrl.trim()}`);
    }
    lines.push(
      `Exercise blocks: ${buildSelectedBlocksLabel()}`
    );
    lines.push("");
    lines.push("=== Reading text (STANDARD version) ===");

    result.standardOutput.split(/\r?\n/).forEach((line) => lines.push(line));
    lines.push("");
    lines.push("=== Questions (STANDARD) ===");
    lines.push("");
    lines.push(
      "Instructions: Read the text above, then answer the questions below."
    );
    lines.push("");

    const sorted = [...exercises].sort((a, b) => a.id - b.id);
    sorted.forEach((item) => addQuestionBlock(lines, item, "standard"));

    return lines;
  }

  function buildAdaptedCombinedLines(): string[] {
    if (!result || !exercises || !exercises.length) return [];
    const lines: string[] = [];

    lines.push("Aontas-10 – Adapted Reading & Questions");
    lines.push("");
    if (articleTitle) {
      lines.push(articleTitle);
    }
    if (articleUrl.trim()) {
      lines.push(`Source: ${articleUrl.trim()}`);
    }
    lines.push(
      `Exercise blocks: ${buildSelectedBlocksLabel()}`
    );
    lines.push("");
    lines.push("=== Reading text (ADAPTED version) ===");

    result.adaptedOutput.split(/\r?\n/).forEach((line) => lines.push(line));
    lines.push("");
    lines.push("=== Questions (ADAPTED) ===");
    lines.push("");
    lines.push(
      "Instructions: Read the text above, then answer the questions below."
    );
    lines.push("");

    const sorted = [...exercises].sort((a, b) => a.id - b.id);
    sorted.forEach((item) => addQuestionBlock(lines, item, "adapted"));

    return lines;
  }

  // === DOWNLOAD HANDLERS FOR EXERCISES / COMBINED SHEETS ===

  async function handleDownloadStandardExercises() {
    if (!exercises || !exercises.length) return;
    const lines = buildStandardExerciseLines();
    if (!lines.length) return;

    const baseName = buildBaseName("exercises-standard");

    if (exerciseExportFormat === "txt") {
      downloadTxt(lines, `${baseName}.txt`);
    } else if (exerciseExportFormat === "docx") {
      await downloadDocx(lines, `${baseName}.docx`);
    } else {
      downloadPdf(lines, `${baseName}.pdf`, {
        fontSize: 11,
        lineHeight: 7,
      });
    }
  }

  async function handleDownloadAdaptedExercises() {
    if (!exercises || !exercises.length) return;
    const lines = buildAdaptedExerciseLines();
    if (!lines.length) return;

    const baseName = buildBaseName("exercises-adapted");

    if (exerciseExportFormat === "txt") {
      downloadTxt(lines, `${baseName}.txt`);
    } else if (exerciseExportFormat === "docx") {
      await downloadDocx(lines, `${baseName}.docx`);
    } else {
      downloadPdf(lines, `${baseName}.pdf`, {
        fontSize: 11,
        lineHeight: 7,
      });
    }
  }

  async function handleDownloadTeacherKey() {
    if (!exercises || !exercises.length) return;
    const lines = buildTeacherKeyLines();
    if (!lines.length) return;

    const baseName = buildBaseName("exercises-key");

    if (exerciseExportFormat === "txt") {
      downloadTxt(lines, `${baseName}.txt`);
    } else if (exerciseExportFormat === "docx") {
      await downloadDocx(lines, `${baseName}.docx`);
    } else {
      downloadPdf(lines, `${baseName}.pdf`, {
        fontSize: 11,
        lineHeight: 7,
      });
    }
  }

  async function handleDownloadStandardCombined() {
    if (!exercises || !exercises.length || !result) return;
    const lines = buildStandardCombinedLines();
    if (!lines.length) return;

    const baseName = buildBaseName("reading-questions-standard");

    if (exerciseExportFormat === "txt") {
      downloadTxt(lines, `${baseName}.txt`);
    } else if (exerciseExportFormat === "docx") {
      await downloadDocx(lines, `${baseName}.docx`);
    } else {
      downloadPdf(lines, `${baseName}.pdf`, {
        fontSize: 10,
        lineHeight: 6.5,
        marginLeft: 15,
        marginTop: 15,
        maxWidth: 180,
      });
    }
  }

  async function handleDownloadAdaptedCombined() {
    if (!exercises || !exercises.length || !result) return;
    const lines = buildAdaptedCombinedLines();
    if (!lines.length) return;

    const baseName = buildBaseName("reading-questions-adapted");

    if (exerciseExportFormat === "txt") {
      downloadTxt(lines, `${baseName}.txt`);
    } else if (exerciseExportFormat === "docx") {
      await downloadDocx(lines, `${baseName}.docx`);
    } else {
      downloadPdf(lines, `${baseName}.pdf`, {
        fontSize: 10,
        lineHeight: 6.5,
        marginLeft: 15,
        marginTop: 15,
        maxWidth: 180,
      });
    }
  }

  // === JSX ===

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center p-6">
      <div className="w-full max-w-4xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold">Aontas-10</h1>
          <p className="text-sm text-slate-300">
            Prototype: turn any text into standard and adapted classroom
            materials.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 border border-slate-800 rounded-lg p-4 bg-slate-900/50"
        >
          {/* URL input + fetch button */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Article URL (optional)
            </label>
            <div className="flex flex-col gap-2 md:flex-row">
              <input
                className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                value={articleUrl}
                onChange={(e) => setArticleUrl(e.target.value)}
                placeholder="Paste a link to an article in any language..."
              />
              <button
                type="button"
                onClick={handleFetchArticle}
                disabled={!articleUrl.trim() || fetchingArticle}
                className="md:w-auto w-full inline-flex items-center justify-center rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 disabled:opacity-40"
              >
                {fetchingArticle ? "Fetching..." : "Fetch text"}
              </button>
            </div>
            <p className="text-xs text-slate-400">
              We&apos;ll fetch the page, strip ads and navigation, and drop the
              main article text into the box below.
            </p>
            {articleError && (
              <p className="text-xs text-red-400">{articleError}</p>
            )}
            {articleTitle && (
              <p className="text-xs text-emerald-300">
                Extracted title:{" "}
                <span className="font-semibold">{articleTitle}</span>
              </p>
            )}
          </div>

          {/* Manual / fetched text */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Input text</label>
            <textarea
              className="w-full h-40 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste an article, paragraph, or any classroom text here, or fetch it from a URL above..."
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {/* Output language dropdown */}
            <div className="space-y-1">
              <label className="block text-sm font-medium">
                Output language
              </label>
              <select
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                value={outputLanguage}
                onChange={(e) => setOutputLanguage(e.target.value)}
              >
                {languageOptions.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                The article can be in any language; we always write the outputs
                in the language you choose here.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium">
                Level (CEFR)
              </label>
              <select
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                value={level}
                onChange={(e) => setLevel(e.target.value as Level)}
              >
                {levels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium">Output type</label>
              <select
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                value={outputType}
                onChange={(e) => setOutputType(e.target.value)}
              >
                {outputTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                id="dyslexiaFriendly"
                type="checkbox"
                className="h-4 w-4"
                checked={dyslexiaFriendly}
                onChange={(e) => setDyslexiaFriendly(e.target.checked)}
              />
              <label htmlFor="dyslexiaFriendly" className="text-sm">
                Adapted version should be dyslexia-friendly / reduced cognitive
                load
              </label>
            </div>

            <div className="space-y-1 text-sm">
              <label className="block text-xs font-medium">
                Text export format
              </label>
              <select
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-sky-500"
                value={exportFormat}
                onChange={(e) =>
                  setExportFormat(e.target.value as ExportFormat)
                }
              >
                <option value="txt">Text (.txt)</option>
                <option value="docx">Word (.docx)</option>
                <option value="pdf">PDF (.pdf)</option>
              </select>
              <p className="text-xs text-slate-400">
                H5P / SCORM exports will come later once we define activity
                types.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="inline-flex items-center justify-center rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"
            >
              {loading ? "Generating..." : "Generate outputs"}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={!result}
              className="inline-flex items-center justify-center rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 disabled:opacity-40"
            >
              Download outputs ({exportFormat.toUpperCase()})
            </button>

            <button
              type="button"
              onClick={downloadDebugJson}
              disabled={!result}
              className="inline-flex items-center justify-center rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 disabled:opacity-40"
            >
              Download debug snapshot (.json)
            </button>

            {result?.warning && (
              <p className="text-xs text-amber-300">{result.warning}</p>
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>

        {result && (
          <section className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 border border-slate-800 rounded-lg p-4 bg-slate-900/40">
              <h2 className="text-sm font-semibold text-sky-300">
                Standard output
              </h2>
              <pre className="whitespace-pre-wrap text-xs bg-slate-950/60 border border-slate-800 rounded-md p-3 overflow-auto">
                {result.standardOutput}
              </pre>
            </div>

            <div className="space-y-2 border border-slate-800 rounded-lg p-4 bg-slate-900/40">
              <h2 className="text-sm font-semibold text-emerald-300">
                Adapted output
              </h2>
              <pre className="whitespace-pre-wrap text-xs bg-slate-950/60 border border-slate-800 rounded-md p-3 overflow-auto">
                {result.adaptedOutput}
              </pre>
            </div>
          </section>
        )}

        {result && (
          <section className="space-y-3 border border-slate-800 rounded-lg p-4 bg-slate-900/60">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-violet-300">
                  Exercise blocks
                </h2>
                <p className="text-xs text-slate-300">
                  Choose which blocks of questions to generate. Each item has a
                  STANDARD and an ADAPTED version, but they all share a single
                  answer key so the whole class can work together.
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Selected blocks: {buildSelectedBlocksLabel()}
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateExercises}
                disabled={loadingExercises}
                className="inline-flex items-center justify-center rounded-md bg-violet-500 px-3 py-2 text-xs font-medium text-slate-950 disabled:opacity-50"
              >
                {loadingExercises
                  ? "Generating exercises..."
                  : "Generate exercises"}
              </button>
            </div>

            {/* Question focus + presets */}
            <div className="grid gap-3 md:grid-cols-2 text-xs mt-2">
              <div className="space-y-1">
                <label className="block font-medium">Question focus</label>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-sky-500"
                  value={questionGoal}
                  onChange={(e) =>
                    setQuestionGoal(e.target.value as QuestionGoal)
                  }
                >
                  {questionGoals.map((goalKey) => (
                    <option key={goalKey} value={goalKey}>
                      {goalConfig[goalKey].label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">
                  {goalConfig[questionGoal].description}
                </p>
              </div>
              <div className="space-y-1">
                <label className="block font-medium">Quick presets</label>
                <button
                  type="button"
                  onClick={() => applyGoalDefaults(questionGoal, level)}
                  className="inline-flex items-center justify-center rounded-md bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-slate-100"
                >
                  Apply for level {level}
                </button>
                <p className="text-[10px] text-slate-400">
                  This toggles the blocks below based on your focus and CEFR
                  level. You can still tweak them manually.
                </p>
              </div>
            </div>

            {/* Block checkboxes */}
            <div className="grid gap-2 md:grid-cols-3 text-xs mt-2">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeGist}
                  onChange={(e) => setIncludeGist(e.target.checked)}
                  className="h-4 w-4"
                />
                <span>Gist / main idea</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeDetail}
                  onChange={(e) => setIncludeDetail(e.target.checked)}
                  className="h-4 w-4"
                />
                <span>Detail questions</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeTrueFalse}
                  onChange={(e) => setIncludeTrueFalse(e.target.checked)}
                  className="h-4 w-4"
                />
                <span>True / False</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeVocab}
                  onChange={(e) => setIncludeVocab(e.target.checked)}
                  className="h-4 w-4"
                />
                <span>Vocabulary</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeCloze}
                  onChange={(e) => setIncludeCloze(e.target.checked)}
                  className="h-4 w-4"
                />
                <span>Cloze / gap-fill</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeOrdering}
                  onChange={(e) => setIncludeOrdering(e.target.checked)}
                  className="h-4 w-4"
                />
                <span>Ordering</span>
              </label>
            </div>

            {exerciseError && (
              <p className="text-xs text-red-400 mt-1">{exerciseError}</p>
            )}

            {exercises && exercises.length > 0 && (
              <>
                <div className="flex flex-wrap items-center gap-4 mt-3">
                  <div className="space-y-1 text-xs">
                    <label className="block font-medium">
                      Exercise export format
                    </label>
                    <select
                      className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-sky-500"
                      value={exerciseExportFormat}
                      onChange={(e) =>
                        setExerciseExportFormat(
                          e.target.value as ExportFormat
                        )
                      }
                    >
                      <option value="txt">Text (.txt)</option>
                      <option value="docx">Word (.docx)</option>
                      <option value="pdf">PDF (.pdf)</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadStandardExercises}
                    className="inline-flex items-center justify-center rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 disabled:opacity-40"
                  >
                    Download standard sheet
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadAdaptedExercises}
                    className="inline-flex items-center justify-center rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 disabled:opacity-40"
                  >
                    Download adapted sheet
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadTeacherKey}
                    className="inline-flex items-center justify-center rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 disabled:opacity-40"
                  >
                    Download teacher key
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadStandardCombined}
                    className="inline-flex items-center justify-center rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 disabled:opacity-40"
                  >
                    Standard reading + questions
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadAdaptedCombined}
                    className="inline-flex items-center justify-center rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 disabled:opacity-40"
                  >
                    Adapted reading + questions
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadInteractiveHtml}
                    disabled={!result || !exercises || !exercises.length}
                    className="inline-flex items-center justify-center rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 disabled:opacity-40"
                  >
                    Download interactive HTML
                  </button>
                </div>

                <div className="mt-3 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-sky-300">
                        Standard questions
                      </h3>
                      <ol className="space-y-2 text-xs list-decimal list-inside">
                        {exercises.map((item) => (
                          <li key={item.id} className="space-y-1">
                            <div className="font-medium">
                              {item.standard.prompt}
                            </div>
                            {item.standard.options && (
                              <ul className="list-disc list-inside pl-4">
                                {item.standard.options.map((opt, idx) => (
                                  <li key={idx}>{opt}</li>
                                ))}
                              </ul>
                            )}
                            <div className="text-[10px] text-slate-400">
                              Block: {item.type} · Skill: {item.skill}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-emerald-300">
                        Adapted questions
                      </h3>
                      <ol className="space-y-2 text-xs list-decimal list-inside">
                        {exercises.map((item) => (
                          <li key={item.id} className="space-y-1">
                            <div className="font-medium">
                              {item.adapted.prompt}
                            </div>
                            {item.adapted.options && (
                              <ul className="list-disc list-inside pl-4">
                                {item.adapted.options.map((opt, idx) => (
                                  <li key={idx}>{opt}</li>
                                ))}
                              </ul>
                            )}
                            <div className="text-[10px] text-slate-400">
                              Block: {item.type} · Skill: {item.skill}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-2">
                    <h3 className="text-xs font-semibold text-amber-300">
                      Answer key (shared for all students)
                    </h3>
                    <ol className="text-xs list-decimal list-inside space-y-1 mt-1">
                      {exercises.map((item) => (
                        <li key={item.id}>
                          <span className="font-semibold">Q{item.id}:</span>{" "}
                          {Array.isArray(item.answer)
                            ? item.answer.join(" | ")
                            : item.answer}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
