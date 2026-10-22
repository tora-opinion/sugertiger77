import type { Locale } from "./translations";

export interface Project {
  id: string;
  name: string;
  japaneseName?: string;
  /** Production URL. Omit while the domain is not yet finalized — the projects section shows "Coming soon" instead of linking to an unverified/placeholder domain. */
  url?: string;
  isPublic?: boolean;
  description: string;
  tech: string[];
  features: string[];
  /** Contact address. Omit along with `url` while the domain is not yet finalized. */
  contact?: string;
  status: "In Development" | "Live" | "Beta";
}

export const projects: Record<Locale, Project[]> = {
  en: [
    {
      id: "studyai",
      name: "StudyAI",
      url: "https://studyai.jp",
      isPublic: false,
      description:
        "AI-powered learning support iPad app for Japanese students. Capture problems with OCR, get AI-generated explanations, track learning progress, and review mistake history.",
      tech: ["Swift", "SwiftUI", "Supabase", "OpenAI API", "RevenueCat"],
      features: [
        "OCR problem capture",
        "AI-powered explanations",
        "Learning dashboard",
        "Mistake history tracking",
        "Parental consent system",
      ],
      contact: "admin@studyai.jp",
      status: "In Development",
    },
    {
      id: "sugupena",
      name: "Sugupena",
      japaneseName: "スグペナ！",
      url: "https://sugupena.com",
      description:
        "Behavioral economics-based smartphone addiction management app. Set screen time goals with financial penalties to build better digital habits.",
      tech: [
        "Next.js 15",
        "React 19",
        "Cloudflare Workers",
        "AWS DynamoDB",
        "AWS Cognito",
        "Stripe",
        "LINE API",
      ],
      features: [
        "Screen time goals with penalties",
        "Stripe-powered penalty system",
        "LINE integration",
        "Fraud detection",
      ],
      contact: "admin@sugupena.com",
      status: "In Development",
    },
    {
      id: "idit",
      name: "idit.jp",
      url: "https://idit.jp",
      description:
        "Multi-AI platform for cloud infrastructure, analytics, and AI-powered applications. Integrates multiple AI providers with billing and security.",
      tech: [
        "Next.js 16",
        "Prisma",
        "Vercel AI SDK",
        "Anthropic",
        "Google AI",
        "OpenAI",
        "Stripe",
        "Supabase",
      ],
      features: [
        "Multi-AI integration",
        "Usage-based billing",
        "WebAuthn authentication",
        "Sandboxed code execution",
        "i18n support",
      ],
      contact: "admin@idit.jp",
      status: "In Development",
    },
    {
      id: "ccslash",
      name: "CCSlash",
      url: "https://ccslash.com",
      description:
        "Adobe Creative Cloud cost optimization tool. Get personalized plan recommendations and manage licenses to reduce subscription costs.",
      tech: [
        "Next.js 16",
        "Cloudflare Workers",
        "Cloudflare D1",
        "Stripe",
        "Resend",
      ],
      features: [
        "Personalized plan recommendations",
        "License key management",
        "Automated reminder emails",
        "Cost optimization dashboard",
      ],
      contact: "admin@ccslash.com",
      status: "In Development",
    },
    {
      id: "creatorpay",
      name: "Creatorpay",
      japaneseName: "クリエイターペイ",
      description:
        "A payments and tax support platform for creators. It intermediates creator payouts with Stripe Connect (Separate Charges and Transfers) and automatically generates tax documents as PDFs.",
      tech: [
        "Next.js 15",
        "Supabase",
        "Stripe Connect",
        "Vercel",
        "Resend",
        "Tailwind CSS v4",
      ],
      features: [
        "Stripe Connect payment intermediation",
        "Automatic tax document generation (PDF)",
        "Creator dashboard",
        "Permission management with Supabase RLS",
      ],
      status: "In Development",
    },
    {
      id: "focuspair",
      name: "FocusPair",
      japaneseName: "いっしょロック",
      description:
        "A focus support app that lets two people mutually block smartphone app usage. It detects leaving the session, notifies the partner, and supports continued focus with check-ins.",
      tech: ["Expo (React Native)", "Next.js", "Supabase", "Stripe"],
      features: [
        "Mutual blocking for pairs",
        "Leave-session detection and notifications",
        "Check-in functionality",
        "Expo push notification integration",
      ],
      status: "In Development",
    },
    {
      id: "callshield",
      name: "CallShield",
      japaneseName: "迷惑電話対策コンソール",
      description:
        "A nuisance-call prevention console for stores. It automatically classifies and anonymizes incoming calls and provides a management screen where store staff can see the situation at a glance.",
      tech: ["Next.js 16", "Supabase", "Twilio", "Stripe"],
      features: [
        "Automatic incoming-call classification and filtering",
        "Anonymized data display",
        "Twilio Webhook integration",
        "Payment status synchronization",
      ],
      status: "In Development",
    },
    {
      id: "bantou",
      name: "Bantou",
      description:
        "A booking and payment platform for hourly and whole-facility rentals, such as private saunas. A multi-tenant service where each facility takes payments through Stripe Connect.",
      tech: ["Next.js 15", "Prisma", "PostgreSQL", "Auth.js", "Stripe Connect"],
      features: [
        "Hourly and whole-facility booking",
        "Multi-tenant data isolation with row-level security",
        "Payment links and POS QR codes",
        "Authorization holds and no-show charges",
      ],
      status: "In Development",
    },
    {
      id: "zerosec-pay",
      name: "BoothPay",
      japaneseName: "0秒決済",
      description:
        "A cashless payment platform for doujinshi conventions. Buyers finish paying while still waiting in line, saving time for both buyers and circles.",
      tech: ["Next.js", "TypeScript", "Drizzle ORM", "Neon", "Stripe", "Cloudflare R2"],
      features: [
        "Checkout by entering the amount agreed with the circle",
        "Payment captured only after the in-person handoff",
        "Payments to each circle's Stripe connected account",
      ],
      status: "In Development",
    },
    {
      id: "creator-incentive-market",
      name: "Creator Market",
      description:
        "A digital content marketplace for creators. Its Dynamic Incentive Allocation Engine works back from each creator's desired minimum payout to set sale prices and promotions.",
      tech: ["Next.js 15", "TypeScript", "Prisma", "PostgreSQL", "Stripe"],
      features: [
        "Pricing from the creator's minimum payout",
        "Price candidate evaluation",
        "Token-protected file downloads",
        "Coupon, point and affiliate logic",
      ],
      status: "In Development",
    },
  ],
  ja: [
    {
      id: "studyai",
      name: "StudyAI",
      url: "https://studyai.jp",
      isPublic: false,
      description:
        "日本の学生向けAI学習支援iPadアプリ。OCRで問題を読み取り、AIが解説を生成。学習進捗の追跡やミス履歴の復習も可能。",
      tech: ["Swift", "SwiftUI", "Supabase", "OpenAI API", "RevenueCat"],
      features: [
        "OCR問題読み取り",
        "AI解説生成",
        "学習ダッシュボード",
        "ミス履歴追跡",
        "保護者同意システム",
      ],
      contact: "admin@studyai.jp",
      status: "In Development",
    },
    {
      id: "sugupena",
      name: "Sugupena",
      japaneseName: "スグペナ！",
      url: "https://sugupena.com",
      description:
        "行動経済学に基づくスマホ依存管理アプリ。スクリーンタイム目標を設定し、金銭的ペナルティでデジタル習慣を改善。",
      tech: [
        "Next.js 15",
        "React 19",
        "Cloudflare Workers",
        "AWS DynamoDB",
        "AWS Cognito",
        "Stripe",
        "LINE API",
      ],
      features: [
        "ペナルティ付きスクリーンタイム目標",
        "Stripe決済ペナルティ",
        "LINE連携",
        "不正検知",
      ],
      contact: "admin@sugupena.com",
      status: "In Development",
    },
    {
      id: "idit",
      name: "idit.jp",
      url: "https://idit.jp",
      description:
        "クラウドインフラ・分析・AIアプリケーションのためのマルチAIプラットフォーム。複数AIプロバイダーを統合し、課金とセキュリティを提供。",
      tech: [
        "Next.js 16",
        "Prisma",
        "Vercel AI SDK",
        "Anthropic",
        "Google AI",
        "OpenAI",
        "Stripe",
        "Supabase",
      ],
      features: [
        "マルチAI統合",
        "従量課金",
        "WebAuthn認証",
        "サンドボックスコード実行",
        "多言語対応",
      ],
      contact: "admin@idit.jp",
      status: "In Development",
    },
    {
      id: "ccslash",
      name: "CCSlash",
      url: "https://ccslash.com",
      description:
        "Adobe Creative Cloudのコスト最適化ツール。パーソナライズされたプラン提案とライセンス管理でサブスク費用を削減。",
      tech: [
        "Next.js 16",
        "Cloudflare Workers",
        "Cloudflare D1",
        "Stripe",
        "Resend",
      ],
      features: [
        "パーソナライズされたプラン提案",
        "ライセンスキー管理",
        "自動リマインドメール",
        "コスト最適化ダッシュボード",
      ],
      contact: "admin@ccslash.com",
      status: "In Development",
    },
    {
      id: "creatorpay",
      name: "Creatorpay",
      japaneseName: "クリエイターペイ",
      description:
        "クリエイター向けの決済・税務支援プラットフォーム。Stripe Connect（Separate Charges and Transfers）でクリエイターへの支払いを仲介し、税務書類をPDFで自動生成します。",
      tech: [
        "Next.js 15",
        "Supabase",
        "Stripe Connect",
        "Vercel",
        "Resend",
        "Tailwind CSS v4",
      ],
      features: [
        "Stripe Connectによる決済仲介",
        "税務書類の自動生成（PDF）",
        "クリエイター向けダッシュボード",
        "Supabase RLSによる権限管理",
      ],
      status: "In Development",
    },
    {
      id: "focuspair",
      name: "FocusPair",
      japaneseName: "いっしょロック",
      description:
        "二人一組でスマホアプリの使用を相互にブロックする集中支援アプリ。離脱を検知してペアに通知し、チェックイン機能で継続をサポートします。",
      tech: ["Expo (React Native)", "Next.js", "Supabase", "Stripe"],
      features: [
        "ペア相互ブロック機能",
        "離脱検知通知",
        "チェックイン機能",
        "Expoプッシュ通知連携",
      ],
      status: "In Development",
    },
    {
      id: "callshield",
      name: "CallShield",
      japaneseName: "迷惑電話対策コンソール",
      description:
        "店舗向けの迷惑電話対策コンソール。着信を自動判定・匿名化し、店舗スタッフが状況を一目で確認できる管理画面を提供します。",
      tech: ["Next.js 16", "Supabase", "Twilio", "Stripe"],
      features: [
        "着信の自動判定・フィルタリング",
        "匿名化データ表示",
        "Twilio Webhook連携",
        "決済状態の同期",
      ],
      status: "In Development",
    },
    {
      id: "bantou",
      name: "Bantou",
      description:
        "プライベートサウナのような時間貸し・一棟貸し施設向けの予約・決済プラットフォーム。複数施設対応のサービスで、各施設がStripe Connectで決済を受け取ります。",
      tech: ["Next.js 15", "Prisma", "PostgreSQL", "Auth.js", "Stripe Connect"],
      features: [
        "時間貸し・一棟貸しの予約",
        "行レベルセキュリティによる施設ごとのデータ分離",
        "決済リンク・店頭QR決済",
        "仮押さえ決済・無断キャンセル時の請求",
      ],
      status: "In Development",
    },
    {
      id: "zerosec-pay",
      name: "BoothPay",
      japaneseName: "0秒決済",
      description:
        "同人誌即売会向けのキャッシュレス決済プラットフォーム。待機列の中で決済を済ませ、購入者とサークルの時間を短縮します。",
      tech: ["Next.js", "TypeScript", "Drizzle ORM", "Neon", "Stripe", "Cloudflare R2"],
      features: [
        "サークルと決めた金額を入力して決済",
        "手渡し確認後に売上を確定",
        "各サークルのStripe接続アカウントへの決済",
      ],
      status: "In Development",
    },
    {
      id: "creator-incentive-market",
      name: "Creator Market",
      description:
        "クリエイター向けのデジタルコンテンツ販売プラットフォーム。クリエイターの希望最低受取額から逆算して販売価格や販促を決める「Dynamic Incentive Allocation Engine」が中核です。",
      tech: ["Next.js 15", "TypeScript", "Prisma", "PostgreSQL", "Stripe"],
      features: [
        "最低受取額からの価格設定",
        "価格候補の評価",
        "トークン付きファイルダウンロード",
        "クーポン・ポイント・アフィリエイトの仕組み",
      ],
      status: "In Development",
    },
  ],
};
