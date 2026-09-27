import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readYaml(root, relativePath) {
  const source = await readFile(path.join(root, relativePath), "utf8");
  return parse(source);
}

export async function buildData({ root = DEFAULT_ROOT } = {}) {
  const entries = await readdir(path.join(root, "questions"), { withFileTypes: true });
  const questionFiles = entries
    .filter((entry) => entry.isFile() && /^Q-\d{4}\.yml$/.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  const questions = {};
  for (const entry of questionFiles) {
    const question = await readYaml(root, `questions/${entry.name}`);
    questions[question.id] = question;
  }

  const data = {
    questions,
    top10: await readYaml(root, "top-10.yml"),
    contenders: await readYaml(root, "contenders.yml"),
  };

  const distDir = path.join(root, "dist");
  await mkdir(distDir, { recursive: true });
  await writeFile(path.join(distDir, "data.json"), `${JSON.stringify(data, null, 2)}\n`, "utf8");

  return data;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildData();
  console.log("Built dist/data.json.");
}
