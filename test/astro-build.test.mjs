import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parse, stringify } from "yaml";
import { prepareQuestionData } from "../scripts/astro-question-data.mjs";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const escape = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ten-questions-astro-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const name of ["src", "scripts", "questions", "top-10.yml", "contenders.yml", "astro.config.mjs", "package.json"]) {
    await cp(path.join(root, name), path.join(directory, name), { recursive: true });
  }
  await symlink(path.join(root, "node_modules"), path.join(directory, "node_modules"), "dir");
  return directory;
}

async function build(directory) {
  await exec(process.execPath, [path.join(root, "node_modules/astro/bin/astro.mjs"), "build"], { cwd: directory });
  return readFile(path.join(directory, "_site/en/index.html"), "utf8");
}

test("Astro builds separate localized pages with language navigation and Pages assets", async (t) => {
  const directory = await fixture(t);
  const html = await build(directory);
  const data = JSON.parse(await readFile(path.join(directory, "dist/data.json"), "utf8"));
  const ids = [...html.matchAll(/<li class="question-card" id="(Q-\d{4})"/g)].map((match) => match[1]);
  assert.deepEqual(ids, [...data.top10, ...data.contenders]);
  for (const language of ["en", "ja"]) {
    const localized = await readFile(path.join(directory, `_site/${language}/index.html`), "utf8");
    assert.ok(localized.includes(`<html lang="${language}">`));
    for (const id of ids) {
      assert.ok(localized.includes(`<p lang="${language}">${escape(data.questions[id].text[language])}</p>`));
    }
    assert.ok(!localized.includes(`<p lang="${language === "en" ? "ja" : "en"}">`));
    assert.equal((localized.match(/<details class="question-rationale">/g) || []).length, ids.length);
    assert.doesNotMatch(localized, /<details[^>]*\bopen\b/);
    for (const id of ids) {
      const card = localized.match(new RegExp(`<li class="question-card" id="${id}"[\\s\\S]*?</li>`))[0];
      assert.ok(card.includes(`<p class="rationale-text" lang="${language}">${escape(data.questions[id].rationale[language])}</p>`));
      assert.ok(!card.includes("未翻訳"));
    }
    for (const page of ["", "about/"]) {
      const content = await readFile(path.join(directory, `_site/${language}/${page}index.html`), "utf8");
      for (const target of ["en", "ja"]) {
        assert.ok(content.includes(`value="/the-ten-questions/${target}/${page}"`));
      }
      assert.match(content, new RegExp(`value="/the-ten-questions/${language}/${page}" selected`));
      assert.equal((content.match(/href="https:\/\/github.com\/obaratch\/the-ten-questions"/g) || []).length, 2);
    }
  }
  const entry = await readFile(path.join(directory, "_site/index.html"), "utf8");
  assert.ok(entry.includes('content="0;url=/the-ten-questions/en/"'));
  for (const anchor of ["top-10", "contenders"]) {
    assert.ok(html.includes(`href="#${anchor}"`));
    assert.ok(html.includes(`<section id="${anchor}"`));
  }
  assert.ok(html.includes("Public Beta — open to contributions"));
  assert.ok(!html.includes("公開ベータ版 — 提案・参加を歓迎します"));
  const cssUrl = html.match(/href="(\/the-ten-questions\/_astro\/[^" ]+\.css)"/)[1];
  const css = await readFile(path.join(directory, "_site", cssUrl.replace("/the-ten-questions/", "")), "utf8");
  assert.ok(css.includes(".question-card"));
});

test("Astro escapes question text instead of inserting markup", async (t) => {
  const directory = await fixture(t);
  const filename = path.join(directory, "questions/Q-0001.yml");
  const question = parse(await readFile(filename, "utf8"));
  question.text.en = '<script>alert("x")</script> & <b>question</b>';
  await writeFile(filename, stringify(question));
  const html = await build(directory);
  assert.ok(html.includes(escape(question.text.en)), html.match(/<li class="question-card" id="Q-0001"[\s\S]*?<\/li>/)?.[0]);
  assert.doesNotMatch(html, /<script>alert|<b>question/i);
});

test("invalid YAML preserves the last valid snapshot and recovers after correction", async (t) => {
  const directory = await fixture(t);
  await prepareQuestionData(directory);
  const dataFile = path.join(directory, "dist/data.json");
  const previous = await readFile(dataFile, "utf8");
  const filename = path.join(directory, "questions/Q-0001.yml");
  const question = parse(await readFile(filename, "utf8"));
  await writeFile(filename, "text: [\n");
  await assert.rejects(prepareQuestionData(directory), /Invalid YAML/);
  assert.equal(await readFile(dataFile, "utf8"), previous);
  question.text.en = "Recovered question";
  await writeFile(filename, stringify(question));
  await prepareQuestionData(directory);
  assert.equal(JSON.parse(await readFile(dataFile, "utf8")).questions["Q-0001"].text.en, "Recovered question");
  await writeFile(filename, "text: [\n");
  await assert.rejects(build(directory));
});

test("rationale prefers the page language, then English, then another available language", async (t) => {
  const directory = await fixture(t);
  const variants = [
    { en: "English rationale", ja: "日本語の背景" },
    { fr: "French rationale", en: "Preferred English rationale" },
    { fr: "Only French rationale" },
    {},
  ];
  for (const [index, rationale] of variants.entries()) {
    const filename = path.join(directory, `questions/Q-000${index + 1}.yml`);
    const question = parse(await readFile(filename, "utf8"));
    question.rationale = rationale;
    await writeFile(filename, stringify(question));
  }
  await build(directory);
  const html = await readFile(path.join(directory, "_site/ja/index.html"), "utf8");
  const card = id => html.match(new RegExp(`<li class="question-card" id="${id}"[\\s\\S]*?</li>`))[0];
  assert.ok(card("Q-0001").includes('<p class="rationale-text" lang="ja">日本語の背景</p>'));
  assert.ok(!card("Q-0001").includes("未翻訳"));
  assert.ok(card("Q-0002").includes('<p class="rationale-text" lang="en">Preferred English rationale</p>'));
  assert.ok(card("Q-0003").includes('<p class="rationale-text" lang="fr">Only French rationale</p>'));
  assert.ok(card("Q-0003").includes("未翻訳"));
  assert.ok(card("Q-0004").includes("質問の背景・意図はまだありません。"));
});
