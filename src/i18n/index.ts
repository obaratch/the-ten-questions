export const translations = {
  "en": {
    "name": "English",
    "rationaleLabel": "Rationale",
    "untranslated": "Not yet translated",
    "noRationale": "No rationale available yet.",
    "githubLabel": "The Ten Questions on GitHub (opens in a new tab)",
    "brand": "The Ten Questions",
    "questions": "Questions",
    "about": "About",
    "language": "Language",
    "navigation": "Main navigation",
    "sections": "Page sections",
    "description": "An experimental set of questions for first contact.",
    "releaseLabel": "Public Beta",
    "notice": "Public Beta — open to contributions",
    "intro": "A work in progress for a possible first encounter.",
    "eyebrow": "A field guide to first contact",
    "topDescription": "Important questions first. A provisional order for an uncertain encounter.",
    "contendersDescription": "The conversation goes beyond ten. Other questions worth keeping in view.",
    "footerNote": "An open inquiry, from Earth.",
    "top": "Top 10",
    "contenders": "Contenders",
    "aboutTitle": "About",
    "aboutIntro": "Let’s think about ten questions for first contact.",
    "participationTitle": "Join the project",
    "participationText": "You can participate on GitHub through pull requests and issues. Propose new questions, suggest changes to wording or order, contribute translations, or share ideas and counterproposals.",
    "participationLink": "Read the contribution guide on GitHub",
    "participationUrl": "https://github.com/obaratch/the-ten-questions/blob/main/CONTRIBUTING.md",
    "aboutSections": [
      {
        "id": "purpose",
        "title": "Important questions first",
        "text": "If we encounter an intelligence that is neither human nor a human-made AI, what should we ask first? Time may be short, and we may not get through all ten. This project explores the questions and their order to move toward mutual understanding under extreme uncertainty."
      },
      {
        "id": "prototype",
        "title": "A work in progress",
        "text": "The current ten and the contenders are provisional. Some form of communication must already exist before these questions can be used. Establishing that communication, called Stage 0, is outside the main scope of this project."
      },
      {
        "id": "languages",
        "title": "Earth is plural",
        "text": "English and Japanese are parallel working languages; neither is the original. Differences revealed through translation can help us notice our own assumptions. Questions outside the current ten remain part of the conversation."
      }
    ]
  },
  "ja": {
    "name": "日本語",
    "rationaleLabel": "質問の背景・意図",
    "untranslated": "未翻訳",
    "noRationale": "質問の背景・意図はまだありません。",
    "githubLabel": "10の質問のGitHubリポジトリ（新しいタブで開きます）",
    "brand": "10の質問",
    "questions": "質問",
    "about": "概要",
    "language": "言語",
    "navigation": "メインナビゲーション",
    "sections": "ページ内の項目",
    "description": "ファーストコンタクトに向けた試作中の質問集です。",
    "releaseLabel": "公開ベータ版",
    "notice": "公開ベータ版 — 提案・参加を歓迎します",
    "intro": "ファーストコンタクトに向けた試作中の質問集です。",
    "eyebrow": "未知の知性に出会うためのフィールドノート",
    "topDescription": "大切なことから、ひとつずつ。未知の出会いに向けた、暫定的な順序です。",
    "contendersDescription": "対話は、10問では終わらない。考え続けたい、ほかの問い。",
    "footerNote": "地球から、開かれた問いを。",
    "top": "現在の10問",
    "contenders": "候補",
    "aboutTitle": "このプロジェクトについて",
    "aboutIntro": "ファーストコンタクトのための、10の質問を考えよう。",
    "participationTitle": "プロジェクトに参加する",
    "participationText": "GitHubでプルリクエスト（PR）やIssueを通じて参加できます。新しい質問の提案、表現や順序の見直し、翻訳、アイデアや別案の共有など、さまざまな形での参加を歓迎します。",
    "participationLink": "GitHubで参加ガイドを読む",
    "participationUrl": "https://github.com/obaratch/the-ten-questions/blob/main/i18n/ja/CONTRIBUTING.md",
    "aboutSections": [
      {
        "id": "purpose",
        "title": "大切なことから聞く",
        "text": "人間でも、人間が作ったAIでもない知性に出会ったら、最初に何を聞くべきでしょうか。時間は限られ、10問すべてを聞けないかもしれません。このプロジェクトでは、大きな不確実性の中で相互理解に近づくための質問と、その順序を考えます。"
      },
      {
        "id": "prototype",
        "title": "試作中の質問集",
        "text": "現在の10問と候補は暫定的なものです。質問を使う前には、何らかのコミュニケーションが成立している必要があります。その確立を「Stage 0」と呼びますが、このプロジェクトの主な対象ではありません。"
      },
      {
        "id": "languages",
        "title": "地球はひとつではない",
        "text": "英語と日本語は並行する作業言語で、どちらかが原文ではありません。翻訳を通じて見える違いは、私たち自身の前提に気づく手がかりになります。現在の10問に入らない質問も、議論の一部として残します。"
      }
    ]
  }
} as const;

export type Language = keyof typeof translations;
export const languages = Object.keys(translations) as Language[];
export const defaultLanguage: Language = "en";
export function pageUrl(language: Language, page: "questions" | "about" = "questions") {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/${language}/${page === "about" ? "about/" : ""}`;
}
