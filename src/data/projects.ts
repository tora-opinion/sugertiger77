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

export const projects: Project[] = [
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
];
