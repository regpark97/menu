# 📖 Documentação Bupin

Índice de toda a documentação do projeto.

| Documento                          | Para quem        | Conteúdo                                                        |
| ---------------------------------- | ---------------- | --------------------------------------------------------------- |
| [`../HANDOFF.md`](../HANDOFF.md)   | 👈 **comece aqui** | Transferência de PC: credenciais, o que foi feito, o que falta  |
| [`DEPLOY.md`](./DEPLOY.md)         | DevOps           | Vercel, variáveis de ambiente, os dois bloqueadores de deploy    |
| [`SUPABASE.md`](./SUPABASE.md)     | Backend          | Schema, tabelas, RLS, funções, RPCs, segurança do banco          |
| [`OPERACAO.md`](./OPERACAO.md)     | Atendimento      | Criar cliente, vincular dono, tags NFC, diagnóstico de problemas |
| [`HISTORICO.md`](./HISTORICO.md)   | Todos            | Linha do tempo: o que foi feito, quando e por quê                |
| [`HISTORICO-2026-11-10-auditoria.md`](./HISTORICO-2026-11-10-auditoria.md) | Todos | Auditoria de segurança completa + correções C1–C3 e LP mobile |
| [`AUDITORIA-2026-11-10.md`](./AUDITORIA-2026-11-10.md) | Dev | Relatório técnico bruto da auditoria (12 achados com SQL de correção) |
| [`../MIGRACAO-SUPABASE.md`](../MIGRACAO-SUPABASE.md) | Setup inicial | Guia original da migração de banco do Lovable |

---

## Atalhos por situação

| Você precisa…                                    | Vá para                                            |
| ------------------------------------------------ | -------------------------------------------------- |
| Trocar de computador e retomar o projeto         | [`../HANDOFF.md`](../HANDOFF.md)                   |
| Criar o primeiro cliente real                    | [`OPERACAO.md`](./OPERACAO.md) seção 2.1           |
| Entender por que um cliente não vê o painel      | [`OPERACAO.md`](./OPERACAO.md) seção 5             |
| Fazer o deploy de uma mudança                    | [`DEPLOY.md`](./DEPLOY.md) seção 5                 |
| O deploy ficou `Blocked` na Vercel               | [`DEPLOY.md`](./DEPLOY.md) seção 3.1               |
| O site começou a pedir login da Vercel           | [`DEPLOY.md`](./DEPLOY.md) seção 3.2               |
| Ver as políticas RLS / as funções do banco       | [`SUPABASE.md`](./SUPABASE.md) seções 2 e 3        |
| Conceder Super Admin a alguém                    | [`OPERACAO.md`](./OPERACAO.md) seção 6             |
| Saber o que já foi feito e por quê               | [`HISTORICO.md`](./HISTORICO.md)                   |
| Saber o que ainda falta                          | [`../HANDOFF.md`](../HANDOFF.md) seção 4           |
| Entender as correções de segurança de 10/11      | [`HISTORICO-2026-11-10-auditoria.md`](./HISTORICO-2026-11-10-auditoria.md) |
