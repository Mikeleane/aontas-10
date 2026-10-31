import assert from "node:assert/strict";
import { test } from "node:test";
import { validateEvidenceMap, type EvidenceItem } from "../lib/evidence-map";

const item = (evidence: EvidenceItem["evidence"], type = "detail"): EvidenceItem => ({
  id: 1, type, skill: "factual reading", answer: "A box of clean glass jars",
  standard: { prompt: "What was Elena carrying?" },
  adapted: { prompt: "What was Elena carrying?" },
  evidence
});
test("passes evidence copied from both routes", () => {
  const q = item({ standard: ["a box of clean glass jars"], adapted: ["a box of clean glass jars"], reasoning: "explicit" });
  assert.equal(validateEvidenceMap([q], "Elena carried a box of clean glass jars.", "Elena carried a box of clean glass jars.").status, "pass");
});
test("rejects absent supported detail (the box)", () => {
  const q = item({ standard: ["a box of clean glass jars"], adapted: ["a box of clean glass jars"], reasoning: "explicit" });
  const result = validateEvidenceMap([q], "Elena carried a box of clean glass jars.", "Elena carried clean glass jars.");
  assert.equal(result.status, "fail");
  assert.ok(result.issues.some(i => i.code === "EVIDENCE_NOT_IN_TEXT"));
});
test("rejects a vocabulary target missing in supported", () => {
  const q = item({ standard: ["a sudden gust"], adapted: ["strong wind"], targetTerms: ["gust"], reasoning: "vocabulary" }, "vocab");
  const result = validateEvidenceMap([q], "A sudden gust moved the poster.", "Strong wind moved the poster.");
  assert.equal(result.status, "fail");
  assert.ok(result.issues.some(i => i.code === "LEXICAL_TARGET_MISSING"));
});
test("requires human review for inferential questions", () => {
  const q = item({ standard: ["another source"], adapted: ["another source"], reasoning: "inference" });
  const result = validateEvidenceMap([q], "Leo checks another source.", "Leo checks another source.");
  assert.equal(result.status, "review");
});
test("rejects missing evidence and duplicate IDs", () => {
  const q = item({standard: [], adapted: [], reasoning: "explicit"});
  assert.equal(validateEvidenceMap([q, q], "Text.", "Text.").status, "fail");
});
