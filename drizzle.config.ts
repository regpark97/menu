import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    // Aceita o padrao do Supabase/Drizzle (DATABASE_URL) e, por compatibilidade,
    // o nome usado pelo Lovable Cloud (LOVABLE_DB_MIGRATION_URL).
    url: process.env.DATABASE_URL ?? process.env.LOVABLE_DB_MIGRATION_URL ?? "",
  },
});
