/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PAINEL MESTRE — /super-admin (exclusivo da equipe Bupin)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Seções (sidebar): Leads da LP · Clientes (tenants) · Tags NFC · Moderação.
 *
 *  - Leads: contatos captados pelo formulário da landing page (tabela
 *    leads) com avanço de status — é aqui que o funil de vendas começa.
 *  - Clientes: criar estabelecimento, definir plano, vincular dono por
 *    e-mail (RPC user_id_by_email resolve o uuid — nunca colar UUID na mão)
 *    e "Acessar Painel do Cliente" (impersonation via /admin?tenant=<id>).
 *  - Tags NFC: gerar lotes (tag-001…tag-500), vincular a cliente/mesa ou
 *    redirecionar para URL externa, copiar link e baixar QR de fallback.
 *  - Moderação: fila de mídia pendente — comparar foto atual vs. nova e
 *    aprovar (publica capa + galeria pendentes) ou recusar (descarta).
 *
 *  Acesso: bloqueado a não-super-admins no render E nas policies RLS
 *  (has_role 'super_admin') — o painel esconde, o banco garante.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Copy, QrCode, LogIn, Check, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useIsSuperAdmin } from "@/components/AppHeader";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  SUPER_SECTIONS,
  normalizeSuperAdminSection,
  type SuperAdminSection,
} from "@/components/dashboard/sections";
import { LeadsSection } from "@/components/dashboard/LeadsSection";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { resolveMedia, parseGallery } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/super-admin")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { section?: SuperAdminSection | undefined } => ({
    section: normalizeSuperAdminSection(search["section"]),
  }),
  head: () => ({
    meta: [
      { title: "Super Admin — Bupin" },
      { name: "description", content: "Gestão de clientes, tags NFC e moderação de mídia." },
      { property: "og:title", content: "Super Admin — Bupin" },
      { property: "og:description", content: "Painel mestre do Bupin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuperAdmin,
});

const selectCls = "h-10 rounded-md border border-input bg-background px-3 text-sm";

function SuperAdmin() {
  const { data: isSuper, isLoading } = useIsSuperAdmin();
  const { section: sectionParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const section = sectionParam ?? "leads";
  const onSectionChange = (key: string) => {
    const next = normalizeSuperAdminSection(key);
    if (!next) return;
    void navigate({ to: "/super-admin", search: { section: next }, replace: true });
  };
  const tenants = useQuery({
    queryKey: ["all-tenants"],
    queryFn: async () =>
      (await supabase.from("tenants").select("*").order("created_at")).data ?? [],
    enabled: !!isSuper,
  });
  return (
    <DashboardLayout
      variant="super"
      title="Super Admin"
      subtitle="Gestão de clientes, tags NFC e moderação de mídia"
      sections={SUPER_SECTIONS}
      activeSection={section}
      onSectionChange={onSectionChange}
    >
      {isLoading ? null : !isSuper ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
          Acesso restrito à equipe Bupin.
        </div>
      ) : (
        <div>
          {section === "leads" && <LeadsSection />}
          {section === "tenants" && <Tenants list={tenants.data ?? []} refetch={tenants.refetch} />}
          {section === "tags" && <Tags tenants={tenants.data ?? []} />}
          {section === "moderation" && <Moderation />}
        </div>
      )}
    </DashboardLayout>
  );
}

function Tenants({ list, refetch }: { list: Tables<"tenants">[]; refetch: () => void }) {
  const [form, setForm] = useState({ name: "", slug: "", plan: "essential", email: "" });
  const [creating, setCreating] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const slug = form.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const email = form.email.trim().toLowerCase();
    setCreating(true);

    // 1) Descobre se esse e-mail já tem conta (a RPC só devolve o id para super admin).
    let ownerUserId: string | null = null;
    let linked = false;
    if (email) {
      const { data: uid, error: lookupError } = await supabase.rpc("user_id_by_email", {
        _email: email,
      });
      if (lookupError) {
        setCreating(false);
        return toast.error(lookupError.message);
      }
      ownerUserId = uid ?? null;
      linked = Boolean(ownerUserId);
    }

    // 2) Cria o estabelecimento já com o dono vinculado (quando existir).
    const { error } = await supabase
      .from("tenants")
      .insert({ name: form.name, slug, plan: form.plan, owner_user_id: ownerUserId });
    setCreating(false);
    if (error) return toast.error(error.message);

    if (!email) toast.success("Estabelecimento criado");
    else if (linked) toast.success(`Estabelecimento criado e vinculado a ${email}`);
    else
      toast.warning(
        `Estabelecimento criado. ${email} ainda não tem conta: peça para se cadastrar em /auth com esse e-mail e depois vincule no cartão do cliente.`,
        { duration: 8000 },
      );

    setForm({ name: "", slug: "", plan: "essential", email: "" });
    refetch();
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={create}
        className="glass grid gap-3 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_140px_1fr_auto]"
      >
        <Input
          required
          placeholder="Nome"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          required
          placeholder="slug (ex: francisco-porto)"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
        />
        <select
          className={selectCls}
          value={form.plan}
          onChange={(e) => setForm({ ...form, plan: e.target.value })}
        >
          <option value="essential">Essential</option>
          <option value="pro">Pro</option>
          <option value="signature">Signature</option>
        </select>
        <Input
          type="email"
          placeholder="E-mail do dono (opcional)"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Button disabled={creating}>{creating ? "Criando…" : "Criar"}</Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Se informar o e-mail do dono e ele já tiver conta, o painel dele é liberado na hora. Se
        ainda não tiver, peça para ele criar a conta em <span className="text-gold">/auth</span> com
        esse mesmo e-mail e use <span className="text-gold">Vincular dono</span> no cartão dele
        abaixo.
      </p>
      {list.map((t) => (
        <TenantRow key={t.id} t={t} refetch={refetch} />
      ))}
    </div>
  );
}

function TenantRow({ t, refetch }: { t: Tables<"tenants">; refetch: () => void }) {
  const [v, setV] = useState({
    plan: t.plan,
    logo_url: t.logo_url ?? "",
    bg_image_url: t.bg_image_url ?? "",
    active: t.active,
  });
  const [ownerEmail, setOwnerEmail] = useState("");
  const [linking, setLinking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    const { error } = await supabase.from("tenants").update(v).eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    refetch();
  }

  /** Vincula (ou troca) o dono a partir do e-mail — nada de colar UUID. */
  async function linkOwner() {
    const email = ownerEmail.trim().toLowerCase();
    if (!email) return toast.error("Informe o e-mail do dono");
    setLinking(true);
    const { data: uid, error: lookupError } = await supabase.rpc("user_id_by_email", {
      _email: email,
    });
    if (lookupError) {
      setLinking(false);
      return toast.error(lookupError.message);
    }
    if (!uid) {
      setLinking(false);
      return toast.warning(
        `${email} ainda não tem conta. Peça para a pessoa se cadastrar em /auth com esse e-mail e tente de novo.`,
        { duration: 8000 },
      );
    }
    const { error } = await supabase.from("tenants").update({ owner_user_id: uid }).eq("id", t.id);
    setLinking(false);
    if (error) return toast.error(error.message);
    toast.success(`Dono vinculado: ${email}`);
    setOwnerEmail("");
    refetch();
  }

  /** Desvincula: o painel do cliente volta a ficar sem dono. */
  async function unlinkOwner() {
    const { error } = await supabase.from("tenants").update({ owner_user_id: null }).eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Dono desvinculado");
    refetch();
  }

  /**
   * Exclui o estabelecimento. Só o Super Admin consegue (policy `super delete tenant`).
   * Pratos, categorias e telemetria saem junto por cascade; as tags NFC apenas
   * ficam "sem dono" (on delete set null) e continuam disponíveis para reuso.
   */
  async function remove() {
    setDeleting(true);

    // 1) Solta as tags NFC — sem isto elas apontariam para um cliente inexistente.
    const { error: tagError } = await supabase
      .from("nfc_tags")
      .update({ tenant_id: null })
      .eq("tenant_id", t.id);
    if (tagError) {
      setDeleting(false);
      return toast.error(`Falha ao liberar as tags NFC: ${tagError.message}`);
    }

    // 2) Apaga o cliente. O banco cuida do resto (cascade).
    const { error } = await supabase.from("tenants").delete().eq("id", t.id);
    setDeleting(false);
    if (error) return toast.error(error.message);

    toast.success(`${t.name} foi excluído. Pratos, categorias e histórico removidos.`);
    refetch();
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        {t.logo_url && (
          <img
            src={t.logo_url}
            alt=""
            className="h-10 w-10 rounded-full bg-secondary object-contain"
          />
        )}
        <div className="flex-1">
          <h3 className="text-2xl leading-none">{t.name}</h3>
          <p className="text-xs text-muted-foreground">/c/{t.slug}</p>
        </div>
        <Link
          to="/admin"
          search={{ tenant: t.id }}
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          <LogIn className="h-4 w-4" /> Acessar Painel do Cliente
        </Link>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <select
          className={selectCls}
          value={v.plan}
          onChange={(e) => setV({ ...v, plan: e.target.value })}
        >
          <option value="essential">Essential</option>
          <option value="pro">Pro</option>
          <option value="signature">Signature</option>
        </select>
        <select
          className={selectCls}
          value={v.active ? "1" : "0"}
          onChange={(e) => setV({ ...v, active: e.target.value === "1" })}
        >
          <option value="1">Ativo</option>
          <option value="0">Inativo</option>
        </select>
        <Input
          placeholder="URL do logo"
          value={v.logo_url}
          onChange={(e) => setV({ ...v, logo_url: e.target.value })}
        />
        <Input
          placeholder="URL da imagem/vídeo de fundo"
          value={v.bg_image_url}
          onChange={(e) => setV({ ...v, bg_image_url: e.target.value })}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-border/60 bg-secondary/30 p-3">
        <div className="min-w-56 flex-1">
          <label className="text-xs text-muted-foreground">
            Dono do painel{" "}
            {t.owner_user_id ? (
              <span className="text-success">(vinculado)</span>
            ) : (
              <span className="text-warning">(nenhum — o cliente não consegue entrar)</span>
            )}
          </label>
          <Input
            type="email"
            placeholder="e-mail da conta do dono"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            className="mt-1"
          />
          {t.owner_user_id && (
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">{t.owner_user_id}</p>
          )}
        </div>
        <Button variant="outline" onClick={linkOwner} disabled={linking || !ownerEmail.trim()}>
          {linking ? "Vinculando…" : t.owner_user_id ? "Trocar dono" : "Vincular dono"}
        </Button>
        {t.owner_user_id && (
          <Button variant="ghost" onClick={unlinkOwner}>
            Desvincular
          </Button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              disabled={deleting}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              {deleting ? "Excluindo…" : "Excluir cliente"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir {t.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Serão apagados:
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ul className="ml-5 list-disc space-y-1 text-sm text-muted-foreground">
              <li>
                o cardápio <span className="font-mono text-xs">/c/{t.slug}</span> sai do ar;
              </li>
              <li>todas as categorias, pratos, fotos e histórico de acessos;</li>
              <li>
                as tags NFC ficam <span className="text-foreground">livres para reuso</span> — não
                são apagadas.
              </li>
            </ul>
            {t.owner_user_id && (
              <p className="rounded-lg border border-warning/40 bg-warning/10 p-2 text-sm text-foreground">
                ⚠️ Este cliente tem dono vinculado: a pessoa perde o acesso ao painel imediatamente.
                Se for só um cliente inadimplente, prefira marcar como{" "}
                <span className="text-foreground">Inativo</span> e salvar.
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={remove}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir definitivamente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button variant="outline" onClick={save}>
          Salvar
        </Button>
      </div>
    </article>
  );
}

function Tags({ tenants }: { tenants: Tables<"tenants">[] }) {
  const [batch, setBatch] = useState({ from: 1, to: 50, tenant_id: "" });
  const { data: tags, refetch } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => (await supabase.from("nfc_tags").select("*").order("tag_code")).data ?? [],
  });
  async function createBatch(e: React.FormEvent) {
    e.preventDefault();
    if (batch.to < batch.from || batch.to - batch.from > 500)
      return toast.error("Intervalo inválido (máx. 500)");
    const rows = Array.from({ length: batch.to - batch.from + 1 }, (_, i) => ({
      tag_code: `tag-${String(batch.from + i).padStart(3, "0")}`,
      tenant_id: batch.tenant_id || null,
    }));
    const { error } = await supabase
      .from("nfc_tags")
      .upsert(rows, { onConflict: "tag_code", ignoreDuplicates: true });
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} tags geradas`);
    refetch();
  }
  return (
    <div className="space-y-4">
      <form onSubmit={createBatch} className="glass flex flex-wrap items-end gap-3 rounded-2xl p-4">
        <div>
          <label className="text-xs text-muted-foreground">De</label>
          <Input
            type="number"
            min={1}
            value={batch.from}
            onChange={(e) => setBatch({ ...batch, from: +e.target.value })}
            className="w-24"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Até</label>
          <Input
            type="number"
            min={1}
            value={batch.to}
            onChange={(e) => setBatch({ ...batch, to: +e.target.value })}
            className="w-24"
          />
        </div>
        <select
          className={selectCls}
          value={batch.tenant_id}
          onChange={(e) => setBatch({ ...batch, tenant_id: e.target.value })}
        >
          <option value="">Sem vínculo</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <Button>Gerar lote</Button>
      </form>
      <div className="space-y-2">
        {tags?.map((t) => (
          <TagRow key={t.id} tag={t} tenants={tenants} />
        ))}
      </div>
    </div>
  );
}

function TagRow({ tag, tenants }: { tag: Tables<"nfc_tags">; tenants: Tables<"tenants">[] }) {
  const [v, setV] = useState({
    tenant_id: tag.tenant_id ?? "",
    table_label: tag.table_label ?? "",
    custom_redirect_url: tag.custom_redirect_url ?? "",
  });
  const link = `${window.location.origin}/t/${tag.tag_code}`;
  async function save() {
    const { error } = await supabase
      .from("nfc_tags")
      .update({
        tenant_id: v.tenant_id || null,
        table_label: v.table_label || null,
        custom_redirect_url: v.custom_redirect_url || null,
      })
      .eq("id", tag.id);
    if (error) return toast.error(error.message);
    toast.success(`${tag.tag_code} atualizada`);
  }
  async function qr() {
    const url = await QRCode.toDataURL(link, { width: 1024, margin: 2 });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tag.tag_code}.png`;
    a.click();
  }
  return (
    <div className="grid items-center gap-2 rounded-xl border border-border bg-card p-3 md:grid-cols-[90px_1fr_110px_1fr_auto]">
      <span className="font-mono text-sm">{tag.tag_code}</span>
      <select
        className={selectCls}
        value={v.tenant_id}
        onChange={(e) => setV({ ...v, tenant_id: e.target.value })}
      >
        <option value="">Sem vínculo</option>
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <Input
        placeholder="Mesa"
        value={v.table_label}
        onChange={(e) => setV({ ...v, table_label: e.target.value })}
      />
      <Input
        placeholder="Link externo (opcional)"
        value={v.custom_redirect_url}
        onChange={(e) => setV({ ...v, custom_redirect_url: e.target.value })}
      />
      <div className="flex gap-1">
        <Button size="sm" variant="outline" onClick={save}>
          Salvar
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Copiar link"
          onClick={() => {
            navigator.clipboard.writeText(link);
            toast.success("Link copiado");
          }}
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Baixar QR Code" onClick={qr}>
          <QrCode className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Moderation() {
  const qc = useQueryClient();
  const { data, refetch } = useQuery({
    queryKey: ["moderation"],
    queryFn: async () =>
      (
        await supabase
          .from("products")
          .select("*, tenants(name)")
          .eq("moderation_status", "pending")
      ).data ?? [],
  });
  /** Aprova/recusa e mantém o badge e a contagem do cabeçalho sincronizados. */
  function afterDecide() {
    refetch();
    qc.invalidateQueries({ queryKey: ["pending-moderation-count"] });
  }
  async function decide(p: Tables<"products">, approve: boolean) {
    // Aprovar publica a capa pendente E a galeria pendente; recusar descarta ambas.
    const patch = approve
      ? {
          media_url: p.pending_media_url ?? p.media_url,
          media_type: p.pending_media_type ?? p.media_type,
          media_gallery: p.pending_media_gallery ?? [],
          pending_media_url: null,
          pending_media_type: null,
          pending_media_gallery: [],
          moderation_status: "approved",
        }
      : {
          pending_media_url: null,
          pending_media_type: null,
          pending_media_gallery: [],
          moderation_status: "rejected",
        };
    const { error } = await supabase.from("products").update(patch).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(approve ? "Publicado no cardápio" : "Mídia recusada");
    afterDecide();
  }
  if (data && !data.length)
    return (
      <div className="glass rounded-2xl p-8 text-center text-muted-foreground">
        Nenhuma mídia aguardando revisão.
      </div>
    );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data?.map((p) => (
        <article key={p.id} className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            {(p.tenants as { name: string } | null)?.name}
          </p>
          <h3 className="text-2xl">{p.name}</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { l: "Foto atual", u: p.media_url, t: p.media_type },
              { l: "Foto nova (capa)", u: p.pending_media_url, t: p.pending_media_type },
            ].map((m) => (
              <figure key={m.l}>
                <figcaption className="mb-1 text-xs text-muted-foreground">{m.l}</figcaption>
                <div className="aspect-[9/16] overflow-hidden rounded-xl bg-secondary">
                  {m.t === "video" ? (
                    <video
                      src={resolveMedia(m.u)}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <img src={resolveMedia(m.u)} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
              </figure>
            ))}
          </div>
          {parseGallery(p.pending_media_gallery).length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs text-muted-foreground">Galeria nova</p>
              <div className="flex flex-wrap gap-2">
                {parseGallery(p.pending_media_gallery).map((g) => (
                  <div key={g.url} className="h-16 w-16 overflow-hidden rounded-lg bg-secondary">
                    {g.type === "video" ? (
                      <video
                        src={resolveMedia(g.url)}
                        muted
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <img
                        src={resolveMedia(g.url)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => decide(p, false)}>
              <X className="h-4 w-4" /> Recusar
            </Button>
            <Button onClick={() => decide(p, true)}>
              <Check className="h-4 w-4" /> Aprovar (Publicar)
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
