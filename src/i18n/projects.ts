import type { Locale } from "./translations";

export interface Project {
  id: string;
  name: string;
  japaneseName?: string;
  url: string;
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
      contact: "admin@studyai.com",
      status: "In Development",
    },
    {
      id: "sugupena",
      name: "Sukupena",
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
      name: "IDIT.jp",
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
      contact: "admin@studyai.com",
      status: "In Development",
    },
    {
      id: "sugupena",
      name: "Sukupena",
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
      name: "IDIT.jp",
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
  ],
};
