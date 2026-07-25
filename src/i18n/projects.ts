import type { Locale } from "./translations";

export interface Project {
  id: string;
  name: string;
  japaneseName?: string;
  /** Production URL. Omit while the domain is not yet finalized — ProjectCard renders a disabled state instead of linking to an unverified/placeholder domain. */
  url?: string;
  description: string;
  tech: string[];
  features: string[];
  contact: string;
  status: "In Development" | "Live" | "Beta";
}

export const projects: Record<Locale, Project[]> = {
  en: [
    {
      id: "studyai",
      name: "StudyAI",
      url: "https://studyai.jp",
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
      japaneseName: "スグペナ",
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
      contact: "admin@creatorpay.com",
      status: "In Development",
    },
    {
      id: "kaihi-os",
      name: "Kaihi-OS",
      japaneseName: "会費ペイ",
      description:
        "A membership fee collection SaaS for clubs and organizations. It notifies members of fee requests through LINE and streamlines collection and management with Stripe payments and an electronic wallet.",
      tech: ["Next.js 15", "Prisma", "Auth.js", "Stripe", "LINE API", "Vercel"],
      features: [
        "Automated membership fee collection",
        "LINE notification integration",
        "Electronic wallet functionality",
        "PDF report export",
      ],
      contact: "admin@kaihi-os.com",
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
      contact: "admin@focuspair.com",
      status: "In Development",
    },
    {
      id: "styleshield",
      name: "StyleShield",
      description:
        "A cloud service for doujin creators and illustrators that protects their artistic style. It provides processing to protect illustrations from AI style imitation and unauthorized training.",
      tech: ["Next.js 16", "Supabase", "Stripe", "Cloudflare Pages", "Sharp"],
      features: [
        "Artistic style protection pipeline",
        "GPU processing backend switching",
        "Stripe payment integration",
        "Supabase authentication",
      ],
      contact: "admin@styleshield.com",
      status: "In Development",
    },
    {
      id: "dojinshield",
      name: "DojinShield",
      description:
        "A digital bonus distribution tool for doujin publications with anti-piracy measures. It generates unique watermarked PDFs for each authenticated user and detects unauthorized redistribution.",
      tech: ["Next.js 16", "Prisma", "pdf-lib", "PostgreSQL"],
      features: [
        "Individual watermarked PDF generation",
        "Claim and redemption management",
        "Automatic abnormal access detection",
        "Admin dashboard",
      ],
      contact: "admin@dojinshield.com",
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
      contact: "admin@callshield.com",
      status: "In Development",
    },
  ],
  ja: [
    {
      id: "studyai",
      name: "StudyAI",
      url: "https://studyai.jp",
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
      japaneseName: "スグペナ",
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
      contact: "admin@creatorpay.com",
      status: "In Development",
    },
    {
      id: "kaihi-os",
      name: "Kaihi-OS",
      japaneseName: "会費ペイ",
      description:
        "サークル・団体向けの会費徴収SaaS。LINE連携で会員に会費請求を通知し、Stripe決済と電子ウォレット機能で徴収・管理を効率化します。",
      tech: ["Next.js 15", "Prisma", "Auth.js", "Stripe", "LINE API", "Vercel"],
      features: [
        "会費の自動徴収",
        "LINE連携による通知",
        "電子ウォレット機能",
        "PDF帳票出力",
      ],
      contact: "admin@kaihi-os.com",
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
      contact: "admin@focuspair.com",
      status: "In Development",
    },
    {
      id: "styleshield",
      name: "StyleShield",
      description:
        "同人作家・イラストレーター向けの画風保護クラウドサービス。AIによる画風模倣や無断学習からイラストを守る処理を提供します。",
      tech: ["Next.js 16", "Supabase", "Stripe", "Cloudflare Pages", "Sharp"],
      features: [
        "画風保護処理パイプライン",
        "GPU処理バックエンドの切り替え対応",
        "Stripe決済連携",
        "Supabase認証",
      ],
      contact: "admin@styleshield.com",
      status: "In Development",
    },
    {
      id: "dojinshield",
      name: "DojinShield",
      description:
        "同人誌向けの海賊版対策付き電子特典配布ツール。認証済みユーザーごとに一点物の透かし入りPDFを生成し、不正拡散を検知します。",
      tech: ["Next.js 16", "Prisma", "pdf-lib", "PostgreSQL"],
      features: [
        "透かし入りPDFの個別生成",
        "クレーム（引き換え）管理",
        "異常アクセスの自動検知",
        "管理者ダッシュボード",
      ],
      contact: "admin@dojinshield.com",
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
      contact: "admin@callshield.com",
      status: "In Development",
    },
  ],
};
