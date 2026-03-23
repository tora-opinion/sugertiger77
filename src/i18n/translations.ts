export type Locale = "en" | "ja";

export const translations = {
  "meta.title": {
    en: "sugertiger77 — Developer Portfolio",
    ja: "sugertiger77 — 開発者ポートフォリオ",
  },
  "meta.description": {
    en: "Full-stack developer building AI-powered products with Cloudflare, Vercel, Supabase, and AWS.",
    ja: "Cloudflare・Vercel・Supabase・AWSを活用し、AIプロダクトを開発するフルスタックエンジニア。",
  },
  "nav.about": { en: "About", ja: "About" },
  "nav.projects": { en: "Projects", ja: "Projects" },
  "nav.contact": { en: "Contact", ja: "Contact" },
  "theme.toggle": { en: "Toggle dark mode", ja: "ダークモード切替" },
  "lang.switch": { en: "日本語", ja: "English" },
  "hero.subtitle": {
    en: "Full-stack developer crafting AI-powered products",
    ja: "AI搭載プロダクトを開発するフルスタックエンジニア",
  },
  "hero.platforms": {
    en: "Cloudflare · Vercel · Supabase · AWS",
    ja: "Cloudflare · Vercel · Supabase · AWS",
  },
  "hero.github": { en: "GitHub", ja: "GitHub" },
  "hero.viewProjects": { en: "View Projects ↓", ja: "プロジェクトを見る ↓" },
  "about.title": { en: "About", ja: "About" },
  "about.description": {
    en: "I build AI-powered web and mobile applications — from behavioral economics tools to multi-AI platforms. Currently developing 4 products across education, fintech, cloud infrastructure, and creative tooling.",
    ja: "行動経済学ツールからマルチAIプラットフォームまで、AIを活用したWebアプリ・モバイルアプリを開発しています。教育・フィンテック・クラウドインフラ・クリエイティブツールの4プロダクトを開発中。",
  },
  "projects.title": { en: "Projects", ja: "Projects" },
  "projects.subtitle": {
    en: "Currently building 4 products across education, fintech, cloud infrastructure, and creative tooling.",
    ja: "教育・フィンテック・クラウドインフラ・クリエイティブツールの4プロダクトを開発中。",
  },
  "projects.visitSite": { en: "Visit Site ↗", ja: "サイトを見る ↗" },
  "status.inDevelopment": { en: "In Development", ja: "開発中" },
  "status.live": { en: "Live", ja: "公開中" },
  "status.beta": { en: "Beta", ja: "ベータ" },
  "contact.title": { en: "Get in Touch", ja: "お問い合わせ" },
  "contact.subtitle": {
    en: "Interested in collaboration? Feel free to reach out.",
    ja: "ご興味がありましたら、お気軽にご連絡ください。",
  },
  "footer.rights": {
    en: "© {year} sugertiger77. All rights reserved.",
    ja: "© {year} sugertiger77. All rights reserved.",
  },
} as const;

export type TranslationKey = keyof typeof translations;
