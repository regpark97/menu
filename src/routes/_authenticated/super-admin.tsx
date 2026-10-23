import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Copy, QrCode, LogIn, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { AppHeader, useIsSuperAdmin } from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resolveMedia } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/super-admin")({
  head: () => ({
    meta: [
      { title: "Super Admin — SipFlow" },
      { name: "description", content: "Gestão de clientes, tags NFC e moderação de mídia." },
      { property: "og:title", content: "Super Admin — SipFlow" },
      { property: "og:description", content: "Painel mestre do SipFlow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuperAdmin,
});

const selectCls = "h-10 rounded-md border border-input bg-background px-3 text-sm";

function SuperAdmin() {
  const { data: isSuper, isLoading } = useIsSuperAdmin();
  const tenants = useQuery({
    queryKey: ["all-tenants"],
    queryFn: async () => (await supabase.from("tenants").select("*").order("created_at")).data ?? [],
    enabled: !!isSuper,
  });
  return (
    <div className="min-h-dvh">
      <AppHeader title="Super Admin" />
      <main className="mx-auto max-w-5xl px-4 py-6">
        {isLoading ? null : !isSuper ? (
          <div className="glass rounded-2xl p-8 text-center text-muted-foreground">Acesso restrito à equipe SipFlow.</div>
        ) : (
          <Tabs defaultValue="tenants">
            <TabsList className="mb-6">
              <TabsTrigger value="tenants">Clientes</TabsTrigger>
              <TabsTrigger value="tags">Tags NFC</TabsTrigger>
              <TabsTrigger value="moderation">Moderação</TabsTrigger>
            </TabsList>
            <TabsContent value="tenants"><Tenants list={tenants.data ?? []} refetch={tenants.refetch} /></TabsContent>
            <TabsContent value="tags"><Tags tenants={tenants.data ?? []} /></TabsContent>
            <TabsContent value="moderation"><Moderation /></TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

function Tenants({ list, refetch }: { list: Tables<"tenants">[]; refetch: () => void }) {
  const [form, setForm] = useState({ name: "", slug: "", plan: "essential" });
  async function create(e: React.FormEvent) {
    e.preventDefault();
    const slug = form.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const { error } = await supabase.from("tenants").insert({ name: form.name, slug, plan: form.plan });
    if (error) return toast.error(error.message);
    toast.success("Estabelecimento criado");
    setForm({ name: "", slug: "", plan: "essential" });
    refetch();
  }
  return (
    <div className="space-y-4">
      <form onSubmit={create} className="glass grid gap-3 rounded-2xl p-4 sm:grid-cols-[1fr_1fr_140px_auto]">
        <Input required placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input required placeholder="slug (ex: francisco-porto)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        <select className={selectCls} value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
          <option value="essential">Essential</option><option value="pro">Pro</option><option value="signature">Signature</option>
        </select>
        <Button>Criar</Button>
      </form>
      {list.map((t) => <TenantRow key={t.id} t={t} refetch={refetch} />)}
    </div>
  );
}

function TenantRow({ t, refetch }: { t: Tables<"tenants">; refetch: () => void }) {
  const [v, setV] = useState({ plan: t.plan, logo_url: t.logo_url ?? "", bg_image_url: t.bg_image_url ?? "", owner_user_id: t.owner_user_id ?? "", active: t.active });
  async function save() {
    const { error } = await supabase.from("tenants").update({ ...v, owner_user_id: v.owner_user_id || null }).eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    refetch();
  }
  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        {t.logo_url && <img src={t.logo_url} alt="" className="h-10 w-10 rounded-full bg-secondary object-contain" />}
        <div className="flex-1">
          <h3 className="text-2xl leading-none">{t.name}</h3>
          <p className="text-xs text-muted-foreground">/c/{t.slug}</p>
        </div>
        <Link to="/admin" search={{ tenant: t.id }} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
          <LogIn className="h-4 w-4" /> Acessar Painel do Cliente
        </Link>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <select className={selectCls} value={v.plan} onChange={(e) => setV({ ...v, plan: e.target.value })}>
          <option value="essential">Essential</option><option value="pro">Pro</option><option value="signature">Signature</option>
        </select>
        <select className={selectCls} value={v.active ? "1" : "0"} onChange={(e) => setV({ ...v, active: e.target.value === "1" })}>
          <option value="1">Ativo</option><option value="0">Inativo</option>
        </select>
        <Input placeholder="URL do logo" value={v.logo_url} onChange={(e) => setV({ ...v, logo_url: e.target.value })} />
        <Input placeholder="URL da imagem/vídeo de fundo" value={v.bg_image_url} onChange={(e) => setV({ ...v, bg_image_url: e.target.value })} />
        <Input placeholder="ID do usuário dono" value={v.owner_user_id} onChange={(e) => setV({ ...v, owner_user_id: e.target.value })} className="sm:col-span-2 font-mono text-xs" />
      </div>
      <div className="mt-3 flex justify-end"><Button variant="outline" onClick={save}>Salvar</Button></div>
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
    if (batch.to < batch.from || batch.to - batch.from > 500) return toast.error("Intervalo inválido (máx. 500)");
    const rows = Array.from({ length: batch.to - batch.from + 1 }, (_, i) => ({
      tag_code: `tag-${String(batch.from + i).padStart(3, "0")}`,
      tenant_id: batch.tenant_id || null,
    }));
    const { error } = await supabase.from("nfc_tags").upsert(rows, { onConflict: "tag_code", ignoreDuplicates: true });
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} tags geradas`);
    refetch();
  }
  return (
    <div className="space-y-4">
      <form onSubmit={createBatch} className="glass flex flex-wrap items-end gap-3 rounded-2xl p-4">
        <div><label className="text-xs text-muted-foreground">De</label><Input type="number" min={1} value={batch.from} onChange={(e) => setBatch({ ...batch, from: +e.target.value })} className="w-24" /></div>
        <div><label className="text-xs text-muted-foreground">Até</label><Input type="number" min={1} value={batch.to} onChange={(e) => setBatch({ ...batch, to: +e.target.value })} className="w-24" /></div>
        <select className={selectCls} value={batch.tenant_id} onChange={(e) => setBatch({ ...batch, tenant_id: e.target.value })}>
          <option value="">Sem vínculo</option>
          {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <Button>Gerar lote</Button>
      </form>
      <div className="space-y-2">
        {tags?.map((t) => <TagRow key={t.id} tag={t} tenants={tenants} />)}
      </div>
    </div>
  );
}

function TagRow({ tag, tenants }: { tag: Tables<"nfc_tags">; tenants: Tables<"tenants">[] }) {
  const [v, setV] = useState({ tenant_id: tag.tenant_id ?? "", table_label: tag.table_label ?? "", custom_redirect_url: tag.custom_redirect_url ?? "" });
  const link = `${window.location.origin}/t/${tag.tag_code}`;
  async function save() {
    const { error } = await supabase.from("nfc_tags").update({
      tenant_id: v.tenant_id || null, table_label: v.table_label || null, custom_redirect_url: v.custom_redirect_url || null,
    }).eq("id", tag.id);
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
      <select className={selectCls} value={v.tenant_id} onChange={(e) => setV({ ...v, tenant_id: e.target.value })}>
        <option value="">Sem vínculo</option>
        {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <Input placeholder="Mesa" value={v.table_label} onChange={(e) => setV({ ...v, table_label: e.target.value })} />
      <Input placeholder="Link externo (opcional)" value={v.custom_redirect_url} onChange={(e) => setV({ ...v, custom_redirect_url: e.target.value })} />
      <div className="flex gap-1">
        <Button size="sm" variant="outline" onClick={save}>Salvar</Button>
        <Button size="icon" variant="ghost" aria-label="Copiar link" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }}><Copy className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" aria-label="Baixar QR Code" onClick={qr}><QrCode className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function Moderation() {
  const { data, refetch } = useQuery({
    queryKey: ["moderation"],
    queryFn: async () => (await supabase.from("products").select("*, tenants(name)").eq("moderation_status", "pending")).data ?? [],
  });
  async function decide(p: Tables<"products">, approve: boolean) {
    const patch = approve
      ? { media_url: p.pending_media_url, media_type: p.pending_media_type ?? "image", pending_media_url: null, pending_media_type: null, moderation_status: "approved" }
      : { pending_media_url: null, pending_media_type: null, moderation_status: "rejected" };
    const { error } = await supabase.from("products").update(patch).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(approve ? "Publicado no cardápio" : "Mídia recusada");
    refetch();
  }
  if (data && !data.length) return <div className="glass rounded-2xl p-8 text-center text-muted-foreground">Nenhuma mídia aguardando revisão.</div>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data?.map((p) => (
        <article key={p.id} className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{(p.tenants as { name: string } | null)?.name}</p>
          <h3 className="text-2xl">{p.name}</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[{ l: "Foto atual", u: p.media_url, t: p.media_type }, { l: "Foto nova", u: p.pending_media_url, t: p.pending_media_type }].map((m) => (
              <figure key={m.l}>
                <figcaption className="mb-1 text-xs text-muted-foreground">{m.l}</figcaption>
                <div className="aspect-[9/16] overflow-hidden rounded-xl bg-secondary">
                  {m.t === "video" ? <video src={resolveMedia(m.u)} autoPlay muted loop playsInline className="h-full w-full object-cover" /> : <img src={resolveMedia(m.u)} alt="" className="h-full w-full object-cover" />}
                </div>
              </figure>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => decide(p, false)}><X className="h-4 w-4" /> Recusar</Button>
            <Button onClick={() => decide(p, true)}><Check className="h-4 w-4" /> Aprovar (Publicar)</Button>
          </div>
        </article>
      ))}
    </div>
  );
}
