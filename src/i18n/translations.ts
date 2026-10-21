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
    en: "Full-stack developer, building AI-powered products.",
    ja: "AIを組み込んだプロダクトを、つくっています。",
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
  "hero.scroll": { en: "Scroll", ja: "スクロール" },
  "a11y.skipToContent": { en: "Skip to main content", ja: "本文へ移動" },
  "hero.viewProjects": { en: "View Projects ↓", ja: "プロジェクトを見る ↓" },
  "about.title": { en: "About", ja: "About" },
  "about.description": {
    en: "I build AI-powered web and mobile apps — a screen-time tool grounded in behavioral economics, a platform that brings several AIs together, a shield for illustrators' style. Ten are in development right now, across education, fintech, cloud infrastructure and creative tooling.",
    ja: "AIを活かしたWebアプリとモバイルアプリをつくっています。行動経済学でスマホ依存に向き合うアプリ、複数のAIをひとつにまとめる基盤、イラストの画風を守るサービス。いま開発中のものは10本。教育、フィンテック、クラウドインフラ、クリエイティブツールにまたがります。",
  },
  "projects.listLabel": { en: "Project list", ja: "プロジェクト一覧" },
  "projects.stack": { en: "Stack", ja: "技術" },
  "projects.features": { en: "Features", ja: "主な機能" },
  "footer.photos": { en: "Photos", ja: "写真" },
  "footer.photosOn": { en: "on Unsplash", ja: "（Unsplash）" },
  "projects.title": { en: "Projects", ja: "Projects" },
  "projects.subtitle": {
    en: "Ten products. All of them in development.",
    ja: "10のプロダクト。すべて、開発中。",
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
  "projects.hint": {
    en: "Select a name to open its details.",
    ja: "名前を押すと、詳細が開きます。",
  },
  "stack.title": { en: "Stack", ja: "Stack" },
  "stack.lead": {
    en: "What the ten products are built on. The number beside each tool is how many of them use it.",
    ja: "10のプロダクトを支える道具。右の数字は、そのうち何本で使っているか。",
  },
  "stack.single": { en: "Used in one product each — ", ja: "1本ずつで使用 — " },
  "stack.count": { en: "{count} of {total} products", ja: "{total}本中{count}本" },
  "status.inDevelopment": { en: "In Development", ja: "開発中" },
  "status.live": { en: "Live", ja: "公開中" },
  "status.beta": { en: "Beta", ja: "ベータ" },
  "contact.title": { en: "Let's talk.", ja: "話しましょう。" },
  "contact.subtitle": {
    en: "Work, collaboration, or a question about one of the products — send a note anytime.",
    ja: "お仕事のご相談、協業、各プロダクトへのご質問など。お気軽にどうぞ。",
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
