"use client";

import { FormEvent, useState } from "react";

type AdaptResponse = {
  standardOutput: string;
  adaptedOutput: string;
  error?: string;
};

const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
const outputTypes = [
  "article",
  "essay",
  "blog post",
  "informal email",
  "formal email",
  "report",
  "social media chat",
];

export default function Home() {
  const [inputText, setInputText] = useState("");
  const [outputLanguage, setOutputLanguage] = useState("English");
  const [level, setLevel] = useState("B1");
  const [outputType, setOutputType] = useState("article");
  const [dyslexiaFriendly, setDyslexiaFriendly] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdaptResponse | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

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

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Request failed");
      }

      const data = (await response.json()) as AdaptResponse;
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!result) return;

    const lines: string[] = [];

    lines.push("Aontas-10 export");
    lines.push(`Output language: ${outputLanguage}`);
    lines.push(`Level: ${level}`);
    lines.push(`Output type: ${outputType}`);
    lines.push(`Dyslexia-friendly: ${dyslexiaFriendly ? "yes" : "no"}`);
    lines.push("");
    lines.push("===== STANDARD OUTPUT =====");
    lines.push("");
    lines.push(result.standardOutput);
    lines.push("");
    lines.push("===== ADAPTED OUTPUT =====");
    lines.push("");
    lines.push(result.adaptedOutput);
    lines.push("");

    const content = lines.join("\n");

    // Create a downloadable text file in the browser
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    const safeType = outputType.replace(/\s+/g, "-").toLowerCase();
    const safeLevel = level.toLowerCase();
    a.href = url;
    a.download = `aontas10-${safeType}-${safeLevel}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

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

        <form onSubmit={handleSubmit} className="space-y-4 border border-slate-800 rounded-lg p-4 bg-slate-900/50">
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Input text
            </label>
            <textarea
              className="w-full h-40 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste an article, paragraph, or any classroom text here..."
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium">
                Output language
              </label>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                value={outputLanguage}
                onChange={(e) => setOutputLanguage(e.target.value)}
                placeholder="e.g. English, Spanish, French"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium">
                Level (CEFR)
              </label>
              <select
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
              >
                {levels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium">
                Output type
              </label>
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

          <div className="flex items-center gap-2">
            <input
              id="dyslexiaFriendly"
              type="checkbox"
              className="h-4 w-4"
              checked={dyslexiaFriendly}
              onChange={(e) => setDyslexiaFriendly(e.target.checked)}
            />
            <label htmlFor="dyslexiaFriendly" className="text-sm">
              Adapted version should be dyslexia-friendly / reduced cognitive load
            </label>
          </div>

          <div className="flex items-center gap-3">
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
              Download outputs (.txt)
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-400">
              {error}
            </p>
          )}
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
      </div>
    </main>
  );
}
