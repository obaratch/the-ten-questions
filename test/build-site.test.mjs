import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildSite, renderSite } from "../scripts/build-site.mjs";

const fixture = {
  questions: {
    "Q-0001": { text: { en: "First <question>", ja: "最初 & 質問" } },
    "Q-0002": { text: { en: "Second", ja: "二番目" } },
    "Q-0011": { text: { en: "Candidate", ja: "候補" } },
  },
  top10: ["Q-0002", "Q-0001"],
  contenders: ["Q-0011"],
};

test("renderSite preserves top-ten order and includes bilingual top-ten and contender text", () => {
  const html = renderSite(fixture);

  assert.ok(html.indexOf("Second") < html.indexOf("First &lt;question&gt;"));
  assert.match(html, /lang="en">Second/);
  assert.match(html, /lang="ja">二番目/);
  assert.match(html, /lang="en">Candidate/);
  assert.match(html, /lang="ja">候補/);
  assert.match(html, /href="#top-10"/);
  assert.match(html, /href="#contenders"/);
  assert.match(html, /<section id="top-10"/);
  assert.match(html, /<section id="contenders"/);
});

test("renderSite escapes source text and uses relative site assets with a bilingual PoC notice", () => {
  const data = structuredClone(fixture);
  data.questions["Q-0001"].text.en = '<script>alert("x")</script> &';
  const html = renderSite(data);

  assert.match(html, /PoC — not an official release/);
  assert.match(html, /PoC（試作版）— 正式版ではありません/);
  assert.match(html, /href="\.\/styles\.css"/);
  assert.doesNotMatch(html, /(?:href|src)="\//);
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp;/);
  assert.doesNotMatch(html, /<script>alert/);
});

test("buildSite writes the Pages layout under _site", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ten-questions-site-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "dist"), { recursive: true });
  await mkdir(path.join(root, "scripts"), { recursive: true });
  await mkdir(path.join(root, "_site"), { recursive: true });
  await writeFile(path.join(root, "dist", "data.json"), JSON.stringify(fixture));
  await writeFile(path.join(root, "scripts", "site.css"), "body { color: black; }\n");
  await writeFile(path.join(root, "_site", "stale.html"), "stale");

  await buildSite({ root });

  const html = await readFile(path.join(root, "_site", "index.html"), "utf8");
  const css = await readFile(path.join(root, "_site", "styles.css"), "utf8");
  await assert.rejects(readFile(path.join(root, "_site", "stale.html")), { code: "ENOENT" });
  assert.match(html, /href="\.\/styles\.css"/);
  assert.equal(css, "body { color: black; }\n");
});
