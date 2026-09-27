import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getQuestion(data, id) {
  const question = data.questions?.[id];
  if (!question) throw new Error(`Question ${id} is missing from dist/data.json.`);
  if (typeof question.text?.en !== "string" || typeof question.text?.ja !== "string") {
    throw new Error(`Question ${id} must include English and Japanese text.`);
  }
  return question;
}

function renderQuestion(data, id, position) {
  const question = getQuestion(data, id);
  const safeId = escapeHtml(id);
  const number = position === undefined ? "" : `<span class="question-number">${position + 1}</span>`;
  return `
      <li class="question-card" id="${safeId}">
        <h3>${number}<span>${safeId}</span></h3>
        <p lang="en">${escapeHtml(question.text.en)}</p>
        <p lang="ja">${escapeHtml(question.text.ja)}</p>
      </li>`;
}

export function renderSite(data) {
  if (!Array.isArray(data.top10) || !Array.isArray(data.contenders)) {
    throw new Error("dist/data.json must contain top10 and contenders arrays.");
  }

  const topTen = data.top10.map((id, index) => renderQuestion(data, id, index)).join("");
  const contenders = data.contenders.map((id) => renderQuestion(data, id)).join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="A bilingual, experimental set of questions for first contact.">
    <title>The Ten Questions — PoC</title>
    <link rel="stylesheet" href="./styles.css">
  </head>
  <body>
    <header class="site-header">
      <p class="poc-notice"><strong>PoC — not an official release</strong><br><span lang="ja">PoC（試作版）— 正式版ではありません</span></p>
      <h1>The Ten Questions <span lang="ja">／ 十の質問</span></h1>
      <p class="intro">A work in progress for a possible first encounter. <span lang="ja">ファーストコンタクトに向けた試作中の質問集です。</span></p>
      <nav aria-label="Page sections">
        <a href="#top-10">Top 10 <span lang="ja">／ 10の質問</span></a>
        <a href="#contenders">Contenders <span lang="ja">／ 候補</span></a>
      </nav>
    </header>
    <main>
      <section id="top-10" aria-labelledby="top-10-heading">
        <h2 id="top-10-heading">Top 10 <span lang="ja">／ 現在の10問</span></h2>
        <ol class="question-list">${topTen}
        </ol>
      </section>
      <section id="contenders" aria-labelledby="contenders-heading">
        <h2 id="contenders-heading">Contenders <span lang="ja">／ 候補</span></h2>
        <ol class="question-list">${contenders}
        </ol>
      </section>
    </main>
    <footer>
      <p>PoC — not an official release · <span lang="ja">PoC（試作版）— 正式版ではありません</span></p>
    </footer>
  </body>
</html>
`;
}

export async function buildSite({ root = DEFAULT_ROOT } = {}) {
  const dataPath = path.join(root, "dist", "data.json");
  const outputPath = path.join(root, "_site");
  const data = JSON.parse(await readFile(dataPath, "utf8"));
  const html = renderSite(data);
  const css = await readFile(path.join(root, "scripts", "site.css"), "utf8");

  await rm(outputPath, { recursive: true, force: true });
  await mkdir(outputPath, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputPath, "index.html"), html, "utf8"),
    writeFile(path.join(outputPath, "styles.css"), css, "utf8"),
  ]);

  return { html, css, outputPath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { outputPath } = await buildSite();
  console.log(`Built static site in ${path.relative(DEFAULT_ROOT, outputPath)}/`);
}
