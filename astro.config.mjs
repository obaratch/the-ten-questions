import { defineConfig } from "astro/config";
import questionData from "./scripts/astro-question-data.mjs";

export default defineConfig({
  site: "https://obaratch.github.io",
  base: "/the-ten-questions",
  output: "static",
  outDir: "./_site",
  build: { inlineStylesheets: "never" },
  integrations: [questionData()],
});
