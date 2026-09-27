import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildData } from "../scripts/build-data.mjs";

async function write(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
}

test("buildData writes a deterministic source-shaped dist/data.json", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ten-questions-build-"));

  await write(root, "questions/Q-0002.yml", 'id: Q-0002\ntext:\n  en: Second\n  ja: 二番目\nthemes:\n  - test\n');
  await write(root, "questions/Q-0001.yml", 'id: Q-0001\ntext:\n  en: First\n  ja: 一番目\nthemes:\n  - test\n');
  await write(root, "top-10.yml", '- Q-0001\n- Q-0002\n');
  await write(root, "contenders.yml", '[]\n');

  const data = await buildData({ root });
  const output = JSON.parse(await readFile(path.join(root, "dist/data.json"), "utf8"));

  assert.deepEqual(output, data);
  assert.deepEqual(Object.keys(output.questions), ["Q-0001", "Q-0002"]);
  assert.deepEqual(output.top10, ["Q-0001", "Q-0002"]);
  assert.deepEqual(output.contenders, []);
  assert.equal("generatedAt" in output, false);
});
