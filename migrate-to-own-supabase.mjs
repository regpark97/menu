#!/usr/bin/env node
/**
 * migrate-to-own-supabase.mjs
 *
 * Roda as migracoes do Drizzle (0000 -> 0002) em um projeto Supabase PROPRIO.
 *
 * Como usar (PowerShell):
 *   $env:DATABASE_URL="postgresql://postgres.SEU_REF:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
 *   node migrate-to-own-supabase.mjs
 *
 * Ou apenas: node migrate-to-own-supabase.mjs "postgresql://..."
 *
 * O script:
 *   1. Le os arquivos de drizzle/migrations/*.sql em ordem;
 *   2. Executa cada um dentro de uma transacao (rollback automatico se falhar);
 *   3. Registra o que rodou na tabela drizzle.__drizzle_migrations (idempotente);
 *   4. Verifica no final se tabelas, funcoes, trigger e o bucket 'media' existem.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "drizzle", "migrations");

const url = process.argv[2] || process.env.DATABASE_URL;
if (!url) {
  console.error(`
ERRO: informe a URL de conexao do SEU projeto Supabase.

  1) No painel do Supabase do seu projeto: Project Settings > Database
     > Connection string > "URI" (use a conexao do pooler / Session).
  2) Troque [YOUR-PASSWORD] pela senha do banco que voce definiu ao criar o projeto.

  PowerShell:
    $env:DATABASE_URL="postgresql://postgres.xxxx:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
    node migrate-to-own-supabase.mjs
`);
  process.exit(1);
}

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error("Nenhum arquivo .sql encontrado em", MIGRATIONS_DIR);
  process.exit(1);
}

console.log(`\nMigrando ${files.length} arquivo(s) para o projeto Supabase:\n  ${url.replace(/:[^:@/]+@/, ":***@")}\n`);

const sql = postgres(url, { max: 1, prepare: false, ssl: "require", onnotice: () => {} });

try {
  await sql`create schema if not exists drizzle`;
  await sql`
    create table if not exists drizzle.__drizzle_migrations (
      id serial primary key,
      hash text not null,
      created_at bigint
    )`;

  const applied = await sql`select hash from drizzle.__drizzle_migrations`;
  const done = new Set(applied.map((r) => r.hash));

  for (const file of files) {
    const body = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    if (done.has(file)) {
      console.log(`  PULADO  ${file}  (ja aplicado)`);
      continue;
    }

    process.stdout.write(`  RODANDO ${file} ... `);
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into drizzle.__drizzle_migrations (hash, created_at) values (${file}, ${Date.now()})`;
      });
      console.log("OK");
    } catch (e) {
      console.log("FALHOU");
      console.error(`\n  Erro em ${file}:\n    ${e.message}\n`);
      throw e;
    }
  }

  console.log("\n=== VERIFICACAO FINAL ===");
  const checks = [
    ["tabelas", `select count(*)::int as n from information_schema.tables where table_schema='public' and table_name in ('tenants','categories','products','nfc_tags','user_roles','telemetry_events')`, 6],
    ["funcoes", `select count(*)::int as n from pg_proc where proname in ('has_role','can_manage_tenant','guard_moderation','handle_new_user','product_intelligence')`, 5],
    ["trigger auth", `select count(*)::int as n from pg_trigger where tgname='on_auth_user_created'`, 1],
    ["tenant demo", `select count(*)::int as n from public.tenants`, 1],
    ["produtos", `select count(*)::int as n from public.products`, 1],
    ["bucket media", `select count(*)::int as n from storage.buckets where id='media'`, 1],
  ];

  let allOk = true;
  for (const [label, query, min] of checks) {
    const [row] = await sql.unsafe(query);
    const ok = row.n >= min;
    if (!ok) allOk = false;
    console.log(`  ${ok ? "OK  " : "FALTA"} ${label.padEnd(14)} ${row.n} (esperado >= ${min})`);
  }

  console.log(allOk ? "\nMigracao concluida com sucesso!\n" : "\nMigracao terminou, mas algo ficou faltando (veja acima).\n");
  process.exitCode = allOk ? 0 : 1;
} finally {
  await sql.end();
}
