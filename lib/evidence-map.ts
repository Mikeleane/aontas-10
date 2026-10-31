/**
 * Aontas ESL evidence-map gate v1.
 * Mechanical checks only: evidence must be copied verbatim from each route.
 * A matching quotation is NOT proof that the answer is semantically justified.
 * Inference and equivalence decisions require a separate semantic review.
 */
export type EvidenceItem = {
  id: number;
  type: string;
  skill: string;
  answer: string | string[];
  standard: { prompt: string; options?: string[] };
  adapted: { prompt: string; options?: string[] };
  evidence?: {
    standard?: string[];
    adapted?: string[];
    targetTerms?: string[];
    reasoning?: "explicit" | "inference" | "grammar" | "vocabulary" | "external";
  };
};
export type EvidenceIssue = {
  id: number;
  code: string;
  message: string;
  severity: "fail" | "review";
};
const norm = (s: string) => s.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase();
const contains = (text: string, excerpt: string) => norm(text).includes(norm(excerpt));

export function validateEvidenceMap(
  items: EvidenceItem[],
  standardText: string,
  supportedText: string
): { status: "pass" | "review" | "fail"; issues: EvidenceIssue[] } {
  const issues: EvidenceIssue[] = [];
  const add = (id: number, code: string, message: string, severity: "fail" | "review" = "fail") =>
    issues.push({ id, code, message, severity });
  if (!Array.isArray(items) || items.length === 0) {
    add(0, "EMPTY_EXERCISES", "No exercise items to validate.");
    return { status: "fail", issues };
  }
  const seen = new Set<number>();
  for (const [i, q] of items.entries()) {
    const id = Number.isInteger(q?.id) ? q.id : i + 1;
    if (!Number.isInteger(q?.id) || q.id < 1 || seen.has(q.id)) add(id, "INVALID_ID", "Question IDs must be unique positive integers.");
    seen.add(q?.id);
    if (!q || !q.standard?.prompt?.trim() || !q.adapted?.prompt?.trim() ||
        !(typeof q.answer === "string" && q.answer.trim() ||
          Array.isArray(q.answer) && q.answer.length && q.answer.every(a => typeof a === "string" && a.trim()))) {
      add(id, "INVALID_SHARED_ITEM", "Question must have two nonempty prompts and a shared nonempty answer.");
    }
    for (const route of ["standard", "adapted"] as const) {
      const excerpts = q?.evidence?.[route];
      const source = route === "standard" ? standardText : supportedText;
      if (!Array.isArray(excerpts) || excerpts.length === 0) {
        add(id, "EVIDENCE_MISSING", `Missing ${route} evidence.`);
      } else for (const excerpt of excerpts) {
        if (typeof excerpt !== "string" || excerpt.trim().length < 4 || !contains(source, excerpt))
          add(id, "EVIDENCE_NOT_IN_TEXT", `${route} evidence is not an exact excerpt of the corresponding reading.`);
      }
    }
    if (!q?.evidence?.reasoning) add(id, "EVIDENCE_TYPE_MISSING", "Identify the reasoning needed for this question.");
    if (q?.evidence?.reasoning === "inference" || q?.evidence?.reasoning === "external")
      add(id, "SEMANTIC_REVIEW_REQUIRED", "An exact excerpt alone cannot establish inference or external-knowledge equivalence.", "review");
    if (q?.type === "vocab" && (!q.evidence?.targetTerms?.length))
      add(id, "LEXICAL_TARGET_UNDECLARED", "Vocabulary questions must declare assessed terms.");
    for (const term of q?.evidence?.targetTerms ?? []) {
      if (typeof term !== "string" || !term.trim() ||
          !contains(standardText, term) || !contains(supportedText, term))
        add(id, "LEXICAL_TARGET_MISSING", "Assessed vocabulary or grammar target is missing from one reading.");
    }
  }
  if (items.some((q, i) => q.id !== i + 1))
    add(0, "NONSEQUENTIAL_IDS", "Question IDs must be 1..N in original order.");
  return {
    status: issues.some(i => i.severity === "fail") ? "fail" : issues.length ? "review" : "pass",
    issues
  };
}
