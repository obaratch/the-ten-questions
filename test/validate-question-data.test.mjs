import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parse, stringify } from "yaml";
import { validateRepository } from "../scripts/validate-question-data.mjs";

async function createRepository(t, { language = "both", questionCount = 11 } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "ten-questions-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "questions"));

  for (let number = 1; number <= questionCount; number += 1) {
    const id = "Q-" + String(number).padStart(4, "0");
    const text = {};
    if (language === "both" || language === "ja") text.ja = "質問 " + number;
    if (language === "both" || language === "en") text.en = "Question " + number;
    await writeFile(
      path.join(root, "questions", id + ".yml"),
      stringify({ id, text, themes: ["theme"], rationale: { en: "Optional rationale." } }),
    );
  }

  const topTen = Array.from({ length: 10 }, (_, index) =>
    "Q-" + String(index + 1).padStart(4, "0"));
  const contenders = Array.from({ length: Math.max(0, questionCount - 10) }, (_, index) =>
    "Q-" + String(index + 11).padStart(4, "0"));
  await writeFile(path.join(root, "top-10.yml"), stringify(topTen));
  await writeFile(path.join(root, "contenders.yml"), stringify(contenders));
  return root;
}

async function replaceFile(root, relativePath, contents) {
  await writeFile(path.join(root, relativePath), contents);
}

test("current-style question data passes draft and merge validation", async (t) => {
  const root = await createRepository(t);
  assert.deepEqual((await validateRepository({ root, mode: "draft" })).errors, []);
  assert.deepEqual((await validateRepository({ root, mode: "merge" })).errors, []);
});

test("draft mode accepts one language while merge mode requires English and Japanese", async (t) => {
  const root = await createRepository(t, { language: "ja" });
  assert.deepEqual((await validateRepository({ root, mode: "draft" })).errors, []);
  const errors = (await validateRepository({ root, mode: "merge" })).errors.join(" | ");
  assert.match(errors, /English text is missing/);
  assert.doesNotMatch(errors, /Japanese text is missing/);
});

test("merge mode rejects empty publication-language text", async (t) => {
  const root = await createRepository(t);
  const file = path.join(root, "questions/Q-0001.yml");
  const question = parse(await readFile(file, "utf8"));
  question.text.en = "  ";
  await replaceFile(root, "questions/Q-0001.yml", stringify(question));
  const errors = (await validateRepository({ root, mode: "merge" })).errors.join(" | ");
  assert.match(errors, /English text is missing/);
});

test("reports malformed YAML and invalid filename and ID mismatch", async (t) => {
  const root = await createRepository(t);
  await replaceFile(root, "questions/Q-0001.yml", "id: [not closed");
  await replaceFile(root, "questions/Q-0002.yml", stringify({
    id: "Q-0099", text: { en: "Question", ja: "質問" }, themes: ["theme"],
  }));
  await replaceFile(root, "questions/not-a-question.yml", stringify({
    id: "Q-0100", text: { en: "Question" }, themes: ["theme"],
  }));
  const errors = (await validateRepository({ root, mode: "draft" })).errors.join(" | ");
  assert.match(errors, /Q-0001\.yml: Invalid YAML/);
  assert.match(errors, /Q-0002\.yml: The filename must match question ID Q-0099/);
  assert.match(errors, /not-a-question\.yml: Filename must match Q-0000\.yml/);
});

test("rejects duplicate question IDs across files", async (t) => {
  const root = await createRepository(t);
  const duplicate = { id: "Q-0001", text: { en: "Duplicate", ja: "重複" }, themes: ["theme"] };
  await replaceFile(root, "questions/Q-0011.yml", stringify(duplicate));
  const errors = (await validateRepository({ root, mode: "draft" })).errors.join(" | ");
  assert.match(errors, /Question ID Q-0001 is used by more than one file/);
});

test("reports missing references and duplicate membership within or across indexes", async (t) => {
  const root = await createRepository(t);
  await replaceFile(root, "top-10.yml", stringify([
    "Q-0001", "Q-0001", "Q-0002", "Q-0003", "Q-0004",
    "Q-0005", "Q-0006", "Q-0007", "Q-0008", "Q-0999",
  ]));
  await replaceFile(root, "contenders.yml", stringify(["Q-0001", "Q-0011"]));
  const errors = (await validateRepository({ root, mode: "draft" })).errors.join(" | ");
  assert.match(errors, /Q-0001 appears more than once/);
  assert.match(errors, /Q-0001 appears in both top-10\.yml and contenders\.yml/);
  assert.match(errors, /Q-0999 is referenced by an index but has no matching question file/);
});

test("reports wrong top-10 count and orphan questions", async (t) => {
  const root = await createRepository(t);
  await replaceFile(root, "top-10.yml", stringify(["Q-0001"]));
  await replaceFile(root, "contenders.yml", stringify([]));
  const errors = (await validateRepository({ root, mode: "draft" })).errors.join(" | ");
  assert.match(errors, /top-10\.yml: Expected exactly 10 question IDs, found 1/);
  assert.match(errors, /Question Q-0002 is not listed in top-10\.yml or contenders\.yml/);
});

test("checks text and themes while accepting equivalent YAML scalar styles", async (t) => {
  const root = await createRepository(t);
  const foldedYaml = [
    "id: Q-0001",
    "text:",
    "  en: >-",
    "    A folded question",
    '  ja: "質問"',
    "themes: [theme]",
    "",
  ].join(String.fromCharCode(10));
  await replaceFile(root, "questions/Q-0001.yml", foldedYaml);
  await replaceFile(root, "questions/Q-0002.yml", stringify({
    id: "Q-0002", text: { en: "Question", ja: "質問" }, themes: [" ", 5],
  }));
  const errors = (await validateRepository({ root, mode: "draft" })).errors.join(" | ");
  assert.doesNotMatch(errors, /Q-0001\.yml/);
  assert.match(errors, /Q-0002\.yml: Theme 1 must be a non-empty string/);
  assert.match(errors, /Q-0002\.yml: Theme 2 must be a non-empty string/);
});

test("rejects invalid mode", async () => {
  await assert.rejects(() => validateRepository({ mode: "release" }), /Unknown validation mode/);
});
