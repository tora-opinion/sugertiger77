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
  "nav.openMenu": { en: "Open menu", ja: "メニューを開く" },
  "nav.closeMenu": { en: "Close menu", ja: "メニューを閉じる" },
  "theme.toggle": { en: "Toggle dark mode", ja: "ダークモード切替" },
  "theme.useDark": { en: "Use dark mode", ja: "ダークモードにする" },
  "theme.useLight": { en: "Use light mode", ja: "ライトモードにする" },
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
  "hero.githubLabel": {
    en: "View sugertiger77 on GitHub (opens in a new tab)",
    ja: "sugertiger77のGitHubを見る（新しいタブで開きます）",
  },
  "a11y.skipToContent": { en: "Skip to main content", ja: "本文へ移動" },
  "hero.viewProjects": { en: "View Projects ↓", ja: "プロジェクトを見る ↓" },
  "about.title": { en: "About", ja: "About" },
  "about.description": {
    en: "I build AI-powered web and mobile applications — from behavioral economics tools to multi-AI platforms. Currently developing 10 products across education, fintech, cloud infrastructure, and creative tooling.",
    ja: "行動経済学ツールからマルチAIプラットフォームまで、AIを活用したWebアプリ・モバイルアプリを開発しています。教育・フィンテック・クラウドインフラ・クリエイティブツールの10プロダクトを開発中。",
  },
  "about.stackLabel": { en: "Tech stack", ja: "使用技術" },
  "projects.listLabel": { en: "Project list", ja: "プロジェクト一覧" },
  "projects.stack": { en: "Stack", ja: "技術" },
  "projects.features": { en: "Features", ja: "主な機能" },
  "footer.photos": { en: "Photos", ja: "写真" },
  "footer.photosOn": { en: "on Unsplash", ja: "（Unsplash）" },
  "projects.title": { en: "Projects", ja: "Projects" },
  "projects.subtitle": {
    en: "Currently building 10 products across education, fintech, cloud infrastructure, and creative tooling.",
    ja: "教育・フィンテック・クラウドインフラ・クリエイティブツールの10プロダクトを開発中。",
  },
  "projects.visitSite": { en: "Visit Site ↗", ja: "サイトを見る ↗" },
  "projects.comingSoon": { en: "Coming soon", ja: "準備中" },
  "projects.privatePreview": { en: "Private preview", ja: "限定公開" },
  "projects.visitSiteLabel": {
    en: "Visit {name} (opens in a new tab)",
    ja: "{name}のサイトを見る（新しいタブで開きます）",
  },
  "projects.emailLabel": {
    en: "Email the {name} team at {email}",
    ja: "{name}チームへメール（{email}）",
  },
  "status.inDevelopment": { en: "In Development", ja: "開発中" },
  "status.live": { en: "Live", ja: "公開中" },
  "status.beta": { en: "Beta", ja: "ベータ" },
  "contact.title": { en: "Get in Touch", ja: "お問い合わせ" },
  "contact.subtitle": {
    en: "Interested in collaboration? Feel free to reach out.",
    ja: "ご興味がありましたら、お気軽にご連絡ください。",
  },
  "contact.emailLabel": {
    en: "Email admin@sugertiger77.com",
    ja: "admin@sugertiger77.comへメール",
  },
  "contact.copyEmail": { en: "Copy email", ja: "メールをコピー" },
  "contact.copied": { en: "Email copied", ja: "メールをコピーしました" },
  "contact.copyFailed": {
    en: "Select and copy the email address above",
    ja: "上のメールアドレスを選択してコピーしてください",
  },
  "footer.rights": {
    en: "© {year} sugertiger77. All rights reserved.",
    ja: "© {year} sugertiger77. All rights reserved.",
  },
} as const;

export type TranslationKey = keyof typeof translations;
