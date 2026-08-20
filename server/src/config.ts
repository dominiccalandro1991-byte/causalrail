export const config = {
  port: Number(process.env.PORT) || 3001,
  databaseUrl: process.env.DATABASE_URL ?? "",
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET ?? "",
  githubToken: process.env.GITHUB_TOKEN ?? "",
  openRouterKey: process.env.OPENROUTER_API_KEY ?? "",
  openRouterModel: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "*",
  webhookUser: process.env.CAUSALRAIL_WEBHOOK_USER ?? "demo",
};
