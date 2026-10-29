import { defineRailway, github, preserve, project, service } from "railway/iac";

// Configuração do serviço no Railway (substitui o railway.json, que deixa de ser lido em 2026-12-01).
// O Railway não lê este arquivo no deploy: mudança aqui só vale depois de `railway config apply`
// (rodar `railway config plan` antes e conferir que nada some).
// Este repositório cuida só do próprio serviço; o Postgres e o volume do projeto ficam de fora.
export const partial = "sejaseuguia";

export default defineRailway(() => {
  const sejaseuguia = service("sejaseuguia", {
    source: github("allysonfel/sejaseuguia", { checkSuites: false }),
    replicas: { "us-west2": 1 },
    // Só o nome: o valor fica no Railway. Variável nova criada no painel precisa entrar aqui,
    // senão o próximo `railway config apply` apaga.
    env: {
      ADMIN_EMAIL: preserve(), ADMIN_NAME: preserve(), ADMIN_PASSWORD: preserve(), AGENCY_NAME: preserve(),
      AGENCY_SUPPORT_EMAIL: preserve(), APP_URL: preserve(), DATABASE_URL: preserve(), GEMINI_API_KEY: preserve(),
      GROQ_API_KEY: preserve(), MAIL_FROM: preserve(), RESEND_API_KEY: preserve(), SESSION_SECRET: preserve(),
      ZAI_API_KEY: preserve(),
    },
    // Só recebe tráfego quando /api/saude responde (o banco respondeu).
    healthcheck: "/api/saude",
    healthcheckTimeout: 120,
    // Caiu: sobe de novo sozinho, até 10 vezes seguidas.
    deploy: { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 10 },
  });
  return project("seja-seu-guia", {
    resources: [sejaseuguia],
  });
});
