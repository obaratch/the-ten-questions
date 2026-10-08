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
  return readFile(path.join(directory, "_site/index.html"), "utf8");
}

test("Astro builds bilingual content in source order with Pages assets and no client scripts", async (t) => {
  const directory = await fixture(t);
  const html = await build(directory);
  const data = JSON.parse(await readFile(path.join(directory, "dist/data.json"), "utf8"));
  const ids = [...html.matchAll(/<li class="question-card" id="(Q-\d{4})"/g)].map((match) => match[1]);
  assert.deepEqual(ids, [...data.top10, ...data.contenders]);
  for (const id of ids) {
    for (const language of ["en", "ja"]) {
      assert.ok(html.includes(`<p lang="${language}">${escape(data.questions[id].text[language])}</p>`));
    }
  }
  for (const anchor of ["top-10", "contenders"]) {
    assert.ok(html.includes(`href="#${anchor}"`));
    assert.ok(html.includes(`<section id="${anchor}"`));
  }
  assert.ok(html.includes("PoC — not an official release"));
  assert.ok(html.includes("PoC（試作版）— 正式版ではありません"));
  assert.doesNotMatch(html, /<script\b/i);
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
  assert.doesNotMatch(html, /<script\b|<b>question/i);
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
