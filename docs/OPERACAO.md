# 🎛️ OPERAÇÃO — O dia a dia do SipFlow

> Guia prático: como criar um cliente, vincular dono, cadastrar tags NFC e resolver
> os problemas mais comuns no atendimento.

---

## 1. Vocabulário (evita 90% da confusão)

| Termo                | É o que, na prática                    | Onde vive         |
| -------------------- | -------------------------------------- | ----------------- |
| **Usuário / Conta**  | A pessoa (login, senha, e-mail)        | `auth.users`      |
| **Estabelecimento**  | O restaurante/café (o "cliente")        | `tenants`         |
| **Dono**             | O usuário vinculado ao estabelecimento  | `tenants.owner_user_id` |
| **Slug**             | Identificador na URL: `/c/`**`slug`**   | `tenants.slug`    |
| **Tag NFC**          | O cartão físico                         | `nfc_tags`        |
| **tag_code**         | O texto gravado na tag: `/t/`**`tag-001`** | `nfc_tags.tag_code` |
| **Super Admin**      | A equipe SipFlow (você)                 | `user_roles`      |
| **Loista / Dono**    | Quem usa o painel `/admin` do restaurante | —               |

### 🔴 Duas coisas que NÃO existem

1. **Não existe "aprovar usuário".**
   Quando alguém se cadastra em `/auth`, cria-se uma linha em `auth.users`. E **só**.
   Nada aparece no Super Admin, porque o Super Admin lista **estabelecimentos**, não
   contas. Isso é o comportamento projetado.
2. **Não existe e-mail automático de "bem-vindo do SipFlow".**
   O único e-mail é o de confirmação de conta do Supabase.

### O vínculo

```
tenants.owner_user_id  ==  auth.users.id
```

Esse é o **único** elo entre "a pessoa" e "o restaurante". Se ele não existe, a pessoa
loga e não vê painel nenhum.

---

## 2. Fluxos de trabalho

### 2.1 🥇 Criar cliente — Caminho B (RECOMENDADO)

O vínculo acontece **sozinho**, sem passo manual.

```
PASSO 1 — A pessoa se cadastra
   Ela abre  https://menu-regpark97.vercel.app/auth
   (peça para usar uma janela anônima, para não misturar com a sua sessão)
   → Cria conta com o e-mail real e uma senha
   → Recebe um e-mail de confirmação
   → ⚠️ PRECISA clicar no link para confirmar

PASSO 2 — Você cria o estabelecimento
   Abra /super-admin  → aba "Clientes" → botão "Criar"
   Preencha:
     • Nome do estabelecimento  (ex.: "Café da Ana")
     • Slug                     (ex.: "cafe-da-ana")   ⚠️ sem acento!
     • E-mail do dono           (exatamente o mesmo do passo 1)
   → Clique em Criar

PASSO 3 — Confirme o vínculo
   Deve aparecer em VERDE:
     "Estabelecimento criado e vinculado a <email>"
```

### 2.2 🥈 Criar cliente — Caminho A (vínculo manual)

Útil quando a pessoa **já** tem conta criada antes (ou você não sabe o e-mail).

```
PASSO 1 — Crie o estabelecimento com o e-mail em branco (ou com o e-mail dela)
PASSO 2 — Na lista de Clientes, clique em "Vincular dono"
PASSO 3 — Digite o e-mail  → confirmar
```

### 2.3 Vincular / trocar / desvincular dono

| Botão             | Quando aparece      | O que faz                          |
| ----------------- | ------------------- | ---------------------------------- |
| **Vincular dono** | sem dono            | Liga a conta ao estabelecimento    |
| **Trocar dono**   | já tem dono         | Substitui o vínculo pelo novo e-mail |
| **Desvincular**   | já tem dono         | Zera o vínculo (a pessoa perde o acesso) |

> Todas as ações usam a RPC `user_id_by_email`, que exige que **você** seja
> `super_admin`.

### 2.4 Excluir cliente

`Super Admin → Clientes → Excluir`

O que acontece:

- ✅ O estabelecimento é apagado
- ✅ As **tags NFC são soltas** (`tenant_id → null`), **não** apagadas — as tags físicas
  continuam existindo e podem ser reatribuídas
- ⚠️ Se havia dono vinculado, ele **perde o acesso na hora** (para de ver o painel)
- ⚠️ **Não é reversível**

### 2.5 Cadastrar e gravar uma tag NFC

```
1. Super Admin → aba "Tags NFC" → Criar
     • tag_code   → ex.: "tag-002"   (é o que vai GRAVAR na tag física)
     • tenant_id  → o estabelecimento
     • table_label→ ex.: "Mesa 07" ou "Varanda 2"
     • active     → true
     • custom_redirect_url → deixe VAZIO para ir ao cardápio padrão

2. Grave na tag física o texto:
     https://menu-regpark97.vercel.app/t/tag-002

3. Teste encostando o celular na tag
```

> 💡 **`custom_redirect_url`:** se preenchido, a tag **ignora** o cardápio e manda a
> pessoa para a URL externa. Serve para tags de Wi-Fi, formulário de avaliação, etc.

### 2.6 Gerenciar o cardápio (com o dono)

O **dono do restaurante** faz isso sozinho, logado em `/admin`:

- Criar / editar categorias
- Criar / editar pratos (com foto, preço, descrição)
- Subir logo e imagem de fundo
- Preencher Wi-Fi (SSID + senha) e link do Google Reviews


---

## 3. Regras do slug (a armadilha clássica)

**Onde o sistema mexe:** `src/routes/_authenticated/super-admin.tsx`, linha ~87:

```js
form.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-")
```

Ou seja: **qualquer caractere que não seja `a-z`, `0-9` ou `-` vira `-`.**

| Você digita       | Vira             | Funciona? |
| ----------------- | ---------------- | --------- |
| `Café da Ana`     | `caf-da-ana`     | 😬 feio   |
| `Pizzaria do Zé`  | `pizzaria-do-z-` | ❌ feio   |
| `cafe-da-ana`     | `cafe-da-ana`    | ✅        |
| `Açaí do João`    | `a-a-do-jo-o`    | ❌        |

**Regra prática:** digite o slug **já pronto**, sem acento, minúsculo, com hífens:

```
✅ cafe-da-ana
✅ pizzaria-do-ze
✅ restaurante-sabor-brasil
```

### slug ≠ tag_code

|                  | `slug`                    | `tag_code`                 |
| ---------------- | ------------------------- | -------------------------- |
| Onde aparece     | `/c/`**`slug`**           | `/t/`**`tag_code`**        |
| Pertence a       | `tenants`                 | `nfc_tags`                 |
| Quem vê          | humano (compartilha link) | ninguém (é o valor na tag) |
| Quantidade       | **1 por estabelecimento** | **N por estabelecimento**  |
| Existe sem dono? | sim                       | sim (se `tenant_id` null)  |

Exemplo completo:

```
slug     = "cafe-da-ana"   →  /c/cafe-da-ana   (link público do cardápio)
tag_code = "tag-002"       →  /t/tag-002       (gravado no cartão da mesa 7)
                               └─→ redireciona para /c/cafe-da-ana
```

---

## 4. Como o cliente final enxerga

```
Cliente senta na mesa
   ↓
Encosta o celular na tag NFC (ou lê o QR)
   ↓
Abre: https://menu-regpark97.vercel.app/t/tag-002
   ↓
[servidor] busca a tag pelo tag_code
   ├─ tag não existe / inactive / sem tenant  →  "Este cartão ainda não está ativo"
   ├─ tag tem custom_redirect_url             →  vai para a URL externa
   └─ tag OK                                  →  busca tenants(slug)
                                                  ↓
                                          /c/cafe-da-ana
                                                  ↓
                                     Cardápio interativo (estilo Reels)
                                     + Wi-Fi + Google Reviews
                                     + telemetria de atenção
```

**Se a tag falhar, o cliente vê apenas "Este cartão ainda não está ativo"** — sem
detalhes. Por isso, **sempre teste a tag nova** antes de entregar.


---

## 5. Diagnóstico rápido (checklist de atendimento)

### "O cliente diz que a tag não funciona"

```
1. A tag existe?
     Super Admin → Tags NFC → procure o tag_code
     ❌ Não existe  → crie
     ✅ Existe      → próximo

2. Está ativa?
     campo "active" na lista
     ❌ false       → ative
     ✅ true        → próximo

3. Está vinculada a um estabelecimento?
     coluna do tenant
     ❌ vazio       → vincule (ou reatribua)
     ✅ tem tenant  → próximo

4. O estabelecimento está ativo?
     Super Admin → Clientes → active
     ❌ false       → ative
     ✅ true        → próximo

5. O que está gravado na tag física?
     Leia com um app de NFC (NFC Tools / TagInfo)
     Esperado: https://menu-regpark97.vercel.app/t/<tag_code>
     ❌ Outra URL / vazio  → regrave

6. A tag veio do projeto antigo?
     ⚠️ URL do Lovable abandonado (menu-tau-bice.vercel.app)
        ainda funcionaria, mas é o projeto ERRADO. Regrave.
```

### "O cliente loga mas não vê o painel"

```
1. A conta está confirmada?
     Supabase → Authentication → Users → coluna "confirmed"?
     ❌ não  → peça para clicar no link do e-mail (ou reenviar)

2. O estabelecimento tem dono?
     Super Admin → Clientes → coluna do dono
     ❌ vazio    → "Vincular dono" com o e-mail dela
     ✅ tem dono → é o MESMO e-mail da conta dela?
         ❌ diferente → "Trocar dono" com o e-mail certo

3. Ainda nada? → confirme que ela está logada com o e-mail certo
```

### "Criei o cliente mas apareceu aviso amarelo"

O aviso amarelo diz: *"<email> ainda não tem conta: peça para se cadastrar em /auth"*.

**Significa que o e-mail digitado NÃO corresponde a nenhuma conta.** Causas possíveis:

| Causa                                 | Como confirmar                                |
| ------------------------------------- | --------------------------------------------- |
| Um dígito faltando/sobrando no e-mail | `pizzaria@gmail.com` vs `pizzaria1@gmail.com` |
| Domínio diferente                     | `@gmail.com` vs `@hotmail.com`                |
| A pessoa nunca se cadastrou           | Authentication → Users → não existe           |
| Ela se cadastrou mas não confirmou    | Existe, mas `confirmed = false`               |

**Solução:** Super Admin → cliente → **"Vincular dono"** → digitar o e-mail **correto**.

> ⚠️ Esse aviso dura só **8 segundos**. Se você olhar para o lado, perde. Depois disso o
> estabelecimento fica **órfão** (existe, mas sem dono) — silenciosamente.
> **Foi exatamente o que aconteceu com a Ana Célia.**

### "Apaguei uma conta e ficou um estabelecimento sem dono"

Apagar a conta (`auth.users`) **não** apaga o estabelecimento (`tenants`). Solução:
**"Vincular dono"** com o e-mail de outra conta, ou **excluir o cliente**.

---

## 6. Conceder / revogar Super Admin

```sql
-- CONCEDER
insert into public.user_roles (user_id, role)
select id, 'super_admin' from auth.users where email = 'seu-email@exemplo.com'
on conflict do nothing;

-- REVOGAR
delete from public.user_roles
where role = 'super_admin'
  and user_id = (select id from auth.users where email = 'email@exemplo.com');

-- LISTAR QUEM TEM
select u.email, r.role from public.user_roles r
join auth.users u on u.id = r.user_id
where r.role = 'super_admin';
```

> ⚠️ Depois do `hardening.sql`, **não há mais promoção automática**. A única forma de
> virar Super Admin é este SQL (rodado no SQL Editor do Supabase).

---

## 7. Senhas e acessos

| Acesso             | Onde                                                                  |
| ------------------ | --------------------------------------------------------------------- |
| Site (produção)    | `https://menu-regpark97.vercel.app`                                    |
| Painel da equipe   | `/super-admin`                                                         |
| Painel do dono     | `/admin`                                                               |
| Supabase           | https://supabase.com/dashboard/project/ulxndzniyeyracujqmlu            |
| Vercel             | projeto `menu`                                                         |
| GitHub             | `regpark97/menu`                                                       |

**Senha do Postgres:** resetar em `Supabase → Settings → Database` (⚠️ pendente — a
senha antiga foi exposta). Guarde a nova num gerenciador de senhas.

**Senha do seu usuário Super Admin:** é a mesma dos logins do site. Se perder, use
`Supabase → Authentication → Users → Send recovery`.

---

## 8. Rotina sugerida

| Quando              | O quê                                                            |
| ------------------- | ---------------------------------------------------------------- |
| Novo cliente        | Caminho B (seção 2.1) → testar `/t/<tag>` no celular              |
| Tag nova entregue   | Testar **antes** de entregar (seção 5)                            |
| Cliente reclama     | Checklist seção 5                                                 |
| Fim de semana       | `Supabase → Database → Backups` (o plano Free não tem PITR)       |
| Antes de mudar SQL  | Exportar backup                                                   |

Você (Super Admin) normalmente **não precisa** mexer nisso.
