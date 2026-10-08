import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildData } from "./build-data.mjs";
import { validateRepository } from "./validate-question-data.mjs";

const DEFAULT_ROOT = fileURLToPath(new URL("../", import.meta.url));

export async function prepareQuestionData(root = DEFAULT_ROOT) {
  const { errors } = await validateRepository({ root, mode: "merge" });
  if (errors.length) throw new Error(`Question data validation failed:\n${errors.join("\n")}`);
  return buildData({ root });
}

export default function questionData({ root = DEFAULT_ROOT } = {}) {
  let queue = Promise.resolve();
  let removeWatcher;
  return {
    name: "question-data",
    hooks: {
      "astro:config:setup": async ({ command }) => {
        if (command === "dev" || command === "build") await prepareQuestionData(root);
      },
      "astro:server:setup": ({ server, logger }) => {
        const questionsDir = path.join(root, "questions");
        const indexes = ["top-10.yml", "contenders.yml"].map((name) => path.join(root, name));
        server.watcher.add([questionsDir, ...indexes]);
        const onChange = (event, filename) => {
          if (!["add", "change", "unlink"].includes(event)) return;
          const absolute = path.resolve(filename);
          if (path.dirname(absolute) !== questionsDir && !indexes.includes(absolute)) return;
          queue = queue.then(async () => {
            try {
              await prepareQuestionData(root);
              // The JSON import participates in Vite's module graph. Invalidate it
              // before reloading so the next request always sees the new snapshot.
              const modules = server.moduleGraph.getModulesByFile(path.join(root, "dist/data.json"));
              for (const module of modules ?? []) server.moduleGraph.invalidateModule(module);
              server.ws.send({ type: "full-reload" });
              logger.info("Question data refreshed.");
            } catch (error) {
              logger.error(error.message);
            }
          });
        };
        server.watcher.on("all", onChange);
        removeWatcher = () => server.watcher.off("all", onChange);
      },
      "astro:server:done": async () => {
        removeWatcher?.();
        await queue;
      },
    },
  };
}
