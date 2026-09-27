import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

const QUESTION_FILENAME = /^Q-\d{4}\.yml$/;
const QUESTION_ID = /^Q-\d{4}$/;
const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseYaml(source, filename, errors) {
  const document = parseDocument(source, { uniqueKeys: true });
  if (document.errors.length > 0) {
    for (const error of document.errors) {
      const position = error.linePos?.[0];
      const location = position ? ` (line ${position.line}, column ${position.col})` : "";
      errors.push(`${filename}: Invalid YAML${location}: ${error.message}`);
    }
    return undefined;
  }
  return document.toJS();
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

async function readYamlFile(root, relativePath, errors) {
  try {
    const source = await readFile(path.join(root, relativePath), "utf8");
    return parseYaml(source, relativePath, errors);
  } catch (error) {
    if (error.code === "ENOENT") {
      errors.push(`${relativePath}: File is missing.`);
    } else {
      errors.push(`${relativePath}: Could not read file: ${error.message}`);
    }
    return undefined;
  }
}

function validateQuestion(question, filename, mode, errors) {
  if (!isRecord(question)) {
    errors.push(`${filename}: Expected a YAML mapping for a question.`);
    return undefined;
  }

  if (typeof question.id !== "string" || !QUESTION_ID.test(question.id)) {
    errors.push(`${filename}: Question ID must use the format Q-0000.`);
  } else {
    const expectedFilename = `${question.id}.yml`;
    if (path.basename(filename) !== expectedFilename) {
      errors.push(`${filename}: The filename must match question ID ${question.id}.`);
    }
  }

  if (!isRecord(question.text)) {
    errors.push(`${filename}: Question text must be a mapping of language codes to text.`);
  } else {
    for (const [language, value] of Object.entries(question.text)) {
      if (typeof value !== "string") {
        errors.push(filename + ': Text for language "' + language + '" must be a string.');
      }
    }
    const languages = Object.entries(question.text)
      .filter(([, value]) => nonEmptyString(value))
      .map(([language]) => language);

    if (languages.length === 0) {
      errors.push(`${filename}: Add non-empty question text in at least one language.`);
    }
    if (mode === "merge") {
      for (const [language, label] of [["en", "English"], ["ja", "Japanese"]]) {
        if (!nonEmptyString(question.text[language])) {
          errors.push(
            `${filename}: ${label} text is missing.
Expected a non-empty text.${language} before merge.`,
          );
        }
      }
    }
  }

  if (!Array.isArray(question.themes) || question.themes.length === 0) {
    errors.push(`${filename}: Add at least one theme.`);
  } else {
    question.themes.forEach((theme, index) => {
      if (!nonEmptyString(theme)) {
        errors.push(`${filename}: Theme ${index + 1} must be a non-empty string.`);
      }
    });
  }

  return typeof question.id === "string" && QUESTION_ID.test(question.id)
    ? question.id
    : undefined;
}

function validateIndex(index, filename, errors) {
  if (!Array.isArray(index)) {
    errors.push(`${filename}: Expected a YAML list of question IDs.`);
    return [];
  }

  const seen = new Set();
  for (const [position, id] of index.entries()) {
    if (typeof id !== "string" || !QUESTION_ID.test(id)) {
      errors.push(`${filename}: Item ${position + 1} must be a question ID in the format Q-0000.`);
      continue;
    }
    if (seen.has(id)) {
      errors.push(`${filename}: Question ID ${id} appears more than once.`);
    }
    seen.add(id);
  }
  return index.filter((id) => typeof id === "string" && QUESTION_ID.test(id));
}

export async function validateRepository({ root = DEFAULT_ROOT, mode = "merge" } = {}) {
  if (!["draft", "merge"].includes(mode)) {
    throw new Error(`Unknown validation mode "${mode}". Use "draft" or "merge".`);
  }

  const errors = [];
  let entries;
  try {
    entries = await readdir(path.join(root, "questions"), { withFileTypes: true });
  } catch (error) {
    return { errors: [`questions/: Could not list question files: ${error.message}`] };
  }

  const questionFiles = entries.filter((entry) => entry.isFile());
  const questionIds = new Set();
  for (const entry of questionFiles) {
    const filename = `questions/${entry.name}`;
    if (!QUESTION_FILENAME.test(entry.name)) {
      errors.push(`${filename}: Filename must match Q-0000.yml.`);
    }

    const question = await readYamlFile(root, filename, errors);
    if (question === undefined) continue;
    const id = validateQuestion(question, filename, mode, errors);
    if (id) {
      if (questionIds.has(id)) {
        errors.push(`${filename}: Question ID ${id} is used by more than one file.`);
      }
      questionIds.add(id);
    }
  }

  const topTen = validateIndex(await readYamlFile(root, "top-10.yml", errors), "top-10.yml", errors);
  const contenders = validateIndex(
    await readYamlFile(root, "contenders.yml", errors),
    "contenders.yml",
    errors,
  );

  if (topTen.length !== 10) {
    errors.push(`top-10.yml: Expected exactly 10 question IDs, found ${topTen.length}.`);
  }

  const topTenIds = new Set(topTen);
  for (const id of contenders) {
    if (topTenIds.has(id)) {
      errors.push(`Question ID ${id} appears in both top-10.yml and contenders.yml.`);
    }
  }

  for (const id of [...topTen, ...contenders]) {
    if (!questionIds.has(id)) {
      errors.push(`Question ID ${id} is referenced by an index but has no matching question file.`);
    }
  }

  const indexedIds = new Set([...topTen, ...contenders]);
  for (const id of questionIds) {
    if (!indexedIds.has(id)) {
      errors.push(`Question ${id} is not listed in top-10.yml or contenders.yml.`);
    }
  }

  return { errors };
}

function readMode(args) {
  const modeIndex = args.indexOf("--mode");
  if (modeIndex < 0 || !args[modeIndex + 1]) return "merge";
  return args[modeIndex + 1];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const mode = readMode(process.argv.slice(2));
    const { errors } = await validateRepository({ mode });
    if (errors.length > 0) {
      console.error(`Question data validation failed (${mode} mode):`);
      for (const error of errors) console.error(`- ${error}`);
      process.exitCode = 1;
    } else {
      console.log(`Question data is valid (${mode} mode).`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
