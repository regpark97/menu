import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Upload,
  Clock,
  Wifi,
  ExternalLink,
  Eye,
  Users,
  Star,
  TrendingUp,
  Plus,
  Trash2,
  X,
  Images,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { AppHeader } from "@/components/AppHeader";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  DESCRIPTION_LIMIT,
  formatMoney,
  parseMoneyInput,
  resolveMedia,
  parseGallery,
  type GalleryItem,
} from "@/lib/format";
import { uploadMedia } from "@/lib/media";

export const Route = createFileRoute("/_authenticated/admin")({
  validateSearch: (s: Record<string, unknown>): { tenant?: string | undefined } => ({
    tenant: typeof s["tenant"] === "string" ? (s["tenant"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Painel do Restaurante — Bupin" },
      {
        name: "description",
        content: "Gerencie cardápio, fotos, Wi-Fi e métricas de atenção.",
      },
      { property: "og:title", content: "Painel do Restaurante — Bupin" },
      { property: "og:description", content: "Gerencie seu cardápio interativo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { tenant: tenantParam } = Route.useSearch();
  const { data, isLoading } = useQuery({
    queryKey: ["my-tenant", tenantParam],
    queryFn: async () => {
      // 1) Modo suporte: o Super Admin abriu um cliente específico (?tenant=<id>).
      if (tenantParam) {
        const { data } = await supabase
          .from("tenants")
          .select("*")
          .eq("id", tenantParam)
          .maybeSingle();
        return { tenant: data, support: Boolean(data) };
      }
      // 2) Caminho normal: o estabelecimento do qual o usuário é dono.
      const { data: u } = await supabase.auth.getUser();
      const { data: owned } = await supabase
        .from("tenants")
        .select("*")
        .eq("owner_user_id", u.user!.id)
        .limit(1)
        .maybeSingle();
      if (owned) return { tenant: owned, support: false };
      // 3) Super Admin sem tenant próprio: mostra o primeiro da lista, para não
      //    ficar preso na tela vazia. A equipe Bupin gerencia todos os clientes.
      const { data: isSuper } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user!.id)
        .eq("role", "super_admin");
      if (!isSuper?.length) return { tenant: null, support: false };
      const { data: first } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      return { tenant: first, support: Boolean(first) };
    },
  });
  const tenant = data?.tenant;
  const isSupport = data?.support ?? false;
  const canSwitch = !tenantParam && isSupport;

  return (
    <div className="min-h-dvh">
      <AppHeader title={tenant?.name ?? "Painel"} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        {isLoading ? null : !tenant ? (
          <div className="glass rounded-2xl p-8 text-center text-muted-foreground">
            Nenhum estabelecimento vinculado à sua conta ainda. Fale com o suporte Bupin.
          </div>
        ) : (
          <>
            {isSupport && (
              <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-warning">
                Modo suporte: você está vendo o painel de {tenant.name}.
              </div>
            )}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-4xl">{tenant.name}</h1>
              <div className="flex flex-wrap items-center gap-2">
                {canSwitch && (
                  <Link
                    to="/super-admin"
                    className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
                  >
                    Trocar de cliente
                  </Link>
                )}
                <Link
                  to="/c/$slug"
                  params={{ slug: tenant.slug }}
                  search={{ t: undefined }}
                  target="_blank"
                  className="flex items-center gap-1 text-sm text-gold"
                >
                  Ver cardápio <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <Tabs defaultValue="menu">
              <TabsList className="mb-6">
                <TabsTrigger value="menu">Cardápio Rápido</TabsTrigger>
                <TabsTrigger value="metrics">Inteligência & Métricas</TabsTrigger>
              </TabsList>
              <TabsContent value="menu" className="space-y-6">
                <WifiCard tenant={tenant} />
                <ProductsList tenantId={tenant.id} />
              </TabsContent>
              <TabsContent value="metrics">
                <Metrics tenantId={tenant.id} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}

function WifiCard({ tenant }: { tenant: Tables<"tenants"> }) {
  const [ssid, setSsid] = useState(tenant.wifi_ssid ?? "");
  const [pwd, setPwd] = useState(tenant.wifi_password ?? "");
  const [maps, setMaps] = useState(tenant.google_review_url ?? "");
  const qc = useQueryClient();
  async function save() {
    const { error } = await supabase
      .from("tenants")
      .update({
        wifi_ssid: ssid.trim() || null,
        wifi_password: pwd.trim() || null,
        google_review_url: maps.trim() || null,
      })
      .eq("id", tenant.id);
    if (error) return toast.error(error.message);
    toast.success("Wi-Fi e Google atualizados");
    qc.invalidateQueries({ queryKey: ["my-tenant"] });
  }
  return (
    <section className="glass space-y-3 rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <Wifi className="h-5 w-5 text-gold" />
        <h2 className="text-lg text-muted-foreground">Wi-Fi e Google</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-muted-foreground">Nome da rede (SSID)</label>
          <Input
            value={ssid}
            onChange={(e) => setSsid(e.target.value)}
            className="mt-1 h-11"
            placeholder="Ex.: Cafe_Guest"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Senha do Wi-Fi</label>
          <Input
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            className="mt-1 h-11"
            placeholder="Senha da rede"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Link do Google (avaliações/maps)</label>
        <Input
          value={maps}
          onChange={(e) => setMaps(e.target.value)}
          className="mt-1 h-11"
          placeholder="https://maps.google.com/..."
        />
      </div>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Os botões de Wi-Fi e de avaliação no Google só aparecem no cardápio quando estes campos
          estão preenchidos.
        </p>
        <Button onClick={save} className="h-11 shrink-0">
          Salvar
        </Button>
      </div>
    </section>
  );
}
function ProductsList({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  // Categoria recém-criada dentro do diálogo: o prato novo deve nascer nela.
  const [pendingCategoryId, setPendingCategoryId] = useState<string | undefined>(undefined);

  const { data: products } = useQuery({
    queryKey: ["admin-products", tenantId],
    queryFn: async () =>
      (await supabase.from("products").select("*").eq("tenant_id", tenantId).order("sort_order"))
        .data ?? [],
  });

  const { data: categories } = useQuery({
    queryKey: ["admin-categories", tenantId],
    queryFn: async () =>
      (await supabase.from("categories").select("*").eq("tenant_id", tenantId).order("sort_order"))
        .data ?? [],
  });

  const refetch = (createdCategoryId?: string) => {
    qc.invalidateQueries({ queryKey: ["admin-products", tenantId] });
    qc.invalidateQueries({ queryKey: ["admin-categories", tenantId] });
    if (createdCategoryId) setPendingCategoryId(createdCategoryId);
  };

  // O novo prato entra no fim da lista do estabelecimento.
  const nextSortOrder = (products?.reduce((max, p) => Math.max(max, p.sort_order), 0) ?? 0) + 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg text-muted-foreground">Pratos do cardápio</h2>
        <Button onClick={() => setCreating(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Adicionar prato
        </Button>
      </div>

      {products?.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground">
          Você ainda não tem pratos. Clique em <span className="text-gold">Adicionar prato</span>{" "}
          para começar.
        </div>
      )}

      {products?.map((p) => (
        <ProductRow key={p.id} product={p} onChange={refetch} />
      ))}

      <NewProductDialog
        open={creating}
        onOpenChange={(v) => {
          setCreating(v);
          if (!v) setPendingCategoryId(undefined);
        }}
        tenantId={tenantId}
        categories={categories ?? []}
        initialCategoryId={pendingCategoryId}
        nextSortOrder={nextSortOrder}
        onCreated={refetch}
      />
    </div>
  );
}

function NewProductDialog({
  open,
  onOpenChange,
  tenantId,
  categories,
  initialCategoryId,
  nextSortOrder,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId: string;
  categories: Tables<"categories">[];
  initialCategoryId?: string | undefined;
  nextSortOrder: number;
  onCreated: (createdCategoryId?: string) => void;
}) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState(0);
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setCategoryId(initialCategoryId ?? categories[0]?.id ?? "");
      setPrice(0);
      setDesc("");
      setCreatingCategory(categories.length === 0 && !initialCategoryId);
      setNewCategory("");
    }
  }, [open, categories, initialCategoryId]);

  const nameOk = name.trim().length > 0;
  const categoryOk = categoryId !== "" && categories.length > 0;
  const canSave = nameOk && categoryOk && price > 0 && !saving;

  /** Cria a categoria na hora e já seleciona ela para o prato. */
  async function createCategory() {
    const label = newCategory.trim();
    if (!label) return toast.error("Dê um nome para a categoria");
    setSaving(true);
    const { data, error } = await supabase
      .from("categories")
      .insert({
        tenant_id: tenantId,
        name: label,
        sort_order: categories.reduce((max, c) => Math.max(max, c.sort_order), 0) + 1,
      })
      .select("*")
      .single();
    setSaving(false);
    if (error || !data) return toast.error(error?.message ?? "Não foi possível criar a categoria");
    setCategoryId(data.id);
    setCreatingCategory(false);
    setNewCategory("");
    toast.success(`Categoria “${label}” criada`);
    onCreated(data.id);
  }

  async function create() {
    if (!nameOk) return toast.error("Dê um nome para o prato");
    if (!categoryOk) return toast.error("Crie uma categoria antes de adicionar pratos");
    if (price <= 0) return toast.error("O preço precisa ser maior que zero");
    if (desc.length > DESCRIPTION_LIMIT)
      return toast.error(`A descrição deve ter até ${DESCRIPTION_LIMIT} caracteres`);
    setSaving(true);
    const { error } = await supabase.from("products").insert({
      tenant_id: tenantId,
      category_id: categoryId,
      name: name.trim(),
      description: desc.trim() || null,
      price_cents: price,
      media_url: null,
      media_type: "image",
      modifiers: [],
      is_available: true,
      is_featured: false,
      sort_order: nextSortOrder,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${name.trim()} adicionado ao cardápio`);
    onOpenChange(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar prato</DialogTitle>
          <DialogDescription>
            Depois de criar, você pode subir a foto e ajustar os detalhes na lista.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Nome do prato</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="mt-1 h-11"
              placeholder="Ex.: Latte de Pistache"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Categoria</label>
            {categories.length === 0 && !creatingCategory ? (
              <div className="mt-1 flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
                <p className="flex-1 text-xs text-warning">
                  Nenhuma categoria cadastrada ainda. Crie a primeira para liberar o cardápio.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 gap-1 text-xs"
                  onClick={() => setCreatingCategory(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Nova categoria
                </Button>
              </div>
            ) : creatingCategory ? (
              <div className="mt-1 flex items-center gap-2">
                <Input
                  autoFocus
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void createCategory();
                    }
                  }}
                  maxLength={40}
                  placeholder="Ex.: Cafés, Doces, Salgados"
                  className="h-11"
                />
                <Button
                  type="button"
                  className="h-11 shrink-0"
                  disabled={saving || !newCategory.trim()}
                  onClick={createCategory}
                >
                  Criar
                </Button>
                {categories.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 shrink-0"
                    onClick={() => {
                      setCreatingCategory(false);
                      setNewCategory("");
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-background">
                      {c.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 shrink-0 gap-1"
                  onClick={() => setCreatingCategory(true)}
                >
                  <Plus className="h-4 w-4" /> Nova
                </Button>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Preço</label>
            <Input
              inputMode="numeric"
              value={formatMoney(price)}
              onChange={(e) => setPrice(parseMoneyInput(e.target.value))}
              className={`mt-1 h-11 tabular-nums ${price <= 0 ? "border-destructive" : ""}`}
              placeholder="R$ 0,00"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <label>Descrição (opcional)</label>
              <span className={desc.length >= DESCRIPTION_LIMIT ? "text-warning" : ""}>
                {desc.length}/{DESCRIPTION_LIMIT}
              </span>
            </div>
            <Textarea
              value={desc}
              maxLength={DESCRIPTION_LIMIT}
              onChange={(e) => setDesc(e.target.value.slice(0, DESCRIPTION_LIMIT))}
              rows={3}
              className="mt-1 resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={create} disabled={!canSave} className="gap-1.5">
            <Plus className="h-4 w-4" /> {saving ? "Adicionando…" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductRow({ product, onChange }: { product: Tables<"products">; onChange: () => void }) {
  const [available, setAvailable] = useState(product.is_available);
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(product.price_cents);
  const [desc, setDesc] = useState(product.description ?? "");
  const [uploading, setUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const gallery = parseGallery(product.media_gallery);
  const pendingGallery = parseGallery(product.pending_media_gallery);
  useEffect(() => {
    setAvailable(product.is_available);
  }, [product.is_available]);
  useEffect(() => {
    setName(product.name);
  }, [product.name]);

  async function toggle(v: boolean) {
    setAvailable(v);
    const { error } = await supabase
      .from("products")
      .update({ is_available: v })
      .eq("id", product.id);
    if (error) {
      setAvailable(!v);
      return toast.error(error.message);
    }
    toast.success(v ? `${product.name} disponível` : `${product.name} marcado como esgotado`);
  }

  async function save() {
    if (!name.trim()) return toast.error("O nome do prato não pode ficar vazio");
    if (price <= 0) return toast.error("O preço precisa ser maior que zero");
    if (desc.length > DESCRIPTION_LIMIT) return;
    const { error } = await supabase
      .from("products")
      .update({ name: name.trim(), price_cents: price, description: desc })
      .eq("id", product.id);
    if (error) return toast.error(error.message);
    toast.success("Alterações salvas");
    onChange();
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    setUploading(true);
    try {
      const m = await uploadMedia(f, `${product.tenant_id}/${product.id}`);
      // Seta 'pending' explicitamente (não dependemos só do trigger do banco).
      // O trigger continua no banco como trava de segurança contra auto-publicação.
      const { data: updated, error } = await supabase
        .from("products")
        .update({
          pending_media_url: m.url,
          pending_media_type: m.type,
          moderation_status: "pending",
        })
        .eq("id", product.id)
        .select("moderation_status")
        .single();
      if (error) throw error;
      if (updated?.moderation_status !== "pending") {
        throw new Error(
          "A foto subiu, mas não entrou na fila de aprovação. Avise o suporte (trigger de moderação ausente no banco).",
        );
      }
      toast.success(
        "Sua nova foto foi enviada e entrará no ar assim que nossa equipe validar o enquadramento.",
        { duration: 6000 },
      );
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setUploading(false);
  }

  /** Adiciona fotos extras à galeria pendente (também aguardam aprovação). */
  async function onGalleryFiles(files: FileList | undefined) {
    if (!files || !files.length) return;
    setGalleryUploading(true);
    try {
      const uploaded: GalleryItem[] = [];
      for (const f of Array.from(files)) {
        const m = await uploadMedia(f, `${product.tenant_id}/${product.id}/gallery`);
        uploaded.push({ url: m.url, type: m.type });
      }
      const next = [...pendingGallery, ...uploaded];
      const { error } = await supabase
        .from("products")
        .update({ pending_media_gallery: next, moderation_status: "pending" })
        .eq("id", product.id);
      if (error) throw error;
      toast.success("Fotos adicionadas. Vão ao ar junto com a aprovação da equipe.", {
        duration: 6000,
      });
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setGalleryUploading(false);
  }

  /** Remove uma foto da galeria pendente. */
  async function removePendingGallery(url: string) {
    const next = pendingGallery.filter((g) => g.url !== url);
    const { error } = await supabase
      .from("products")
      .update({ pending_media_gallery: next })
      .eq("id", product.id);
    if (error) return toast.error(error.message);
    onChange();
  }

  const dirty =
    name !== product.name || price !== product.price_cents || desc !== (product.description ?? "");
  return (
    <article
      className={`rounded-2xl border border-border bg-card p-4 transition ${available ? "" : "opacity-60"}`}
    >
      <div className="flex gap-4">
        <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
          {product.media_type === "video" ? (
            <video
              src={resolveMedia(product.media_url)}
              muted
              className="h-full w-full object-cover"
            />
          ) : (
            <img
              src={resolveMedia(product.media_url)}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className={`h-11 flex-1 text-lg ${name.trim() ? "" : "border-destructive"}`}
              aria-label="Nome do prato"
            />
            <label className="flex shrink-0 items-center gap-2">
              <span
                className={`text-xs font-semibold ${available ? "text-success" : "text-destructive"}`}
              >
                {available ? "Disponível" : "Esgotado"}
              </span>
              <Switch
                checked={available}
                onCheckedChange={toggle}
                className="h-8 w-14 data-[state=checked]:bg-success [&>span]:h-7 [&>span]:w-7 [&>span]:data-[state=checked]:translate-x-6"
              />
            </label>
          </div>
          {product.moderation_status === "pending" && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-warning">
              <Clock className="h-3.5 w-3.5" /> Nova mídia em análise pela equipe
            </p>
          )}
          {product.moderation_status === "rejected" && (
            <p className="mt-2 text-xs text-destructive">
              A última mídia enviada não foi aprovada. Tente outra com melhor enquadramento.
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[160px_1fr]">
        <div>
          <label className="text-xs text-muted-foreground">Preço</label>
          <Input
            inputMode="numeric"
            value={formatMoney(price)}
            onChange={(e) => setPrice(parseMoneyInput(e.target.value))}
            className={`mt-1 h-11 tabular-nums ${price <= 0 ? "border-destructive" : ""}`}
          />
        </div>
        <div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <label>Descrição</label>
            <span className={desc.length >= DESCRIPTION_LIMIT ? "text-warning" : ""}>
              {desc.length}/{DESCRIPTION_LIMIT}
            </span>
          </div>
          <Textarea
            value={desc}
            maxLength={DESCRIPTION_LIMIT}
            onChange={(e) => setDesc(e.target.value.slice(0, DESCRIPTION_LIMIT))}
            rows={2}
            className="mt-1 resize-none"
          />
        </div>
      </div>
      {(gallery.length > 0 || pendingGallery.length > 0) && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Images className="h-3.5 w-3.5" /> Galeria (mais fotos do prato)
          </p>
          <div className="flex flex-wrap gap-2">
            {gallery.map((g, i) => (
              <div
                key={g.url}
                className="relative h-16 w-16 overflow-hidden rounded-lg bg-secondary"
              >
                {g.type === "video" ? (
                  <video src={resolveMedia(g.url)} muted className="h-full w-full object-cover" />
                ) : (
                  <img src={resolveMedia(g.url)} alt="" className="h-full w-full object-cover" />
                )}
                <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[9px] text-white">
                  {i + 2}
                </span>
              </div>
            ))}
            {pendingGallery.map((g) => (
              <div
                key={g.url}
                className="relative h-16 w-16 overflow-hidden rounded-lg border-2 border-warning bg-secondary"
              >
                {g.type === "video" ? (
                  <video src={resolveMedia(g.url)} muted className="h-full w-full object-cover" />
                ) : (
                  <img src={resolveMedia(g.url)} alt="" className="h-full w-full object-cover" />
                )}
                <button
                  onClick={() => removePendingGallery(g.url)}
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                  aria-label="Remover foto pendente"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary">
            <Upload className="h-4 w-4" /> {uploading ? "Enviando…" : "Nova capa"}
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary">
            <Images className="h-4 w-4" /> {galleryUploading ? "Enviando…" : "Adicionar fotos"}
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              disabled={galleryUploading}
              onChange={(e) => onGalleryFiles(e.target.files ?? undefined)}
            />
          </label>
        </div>
        <Button onClick={save} disabled={!dirty || price <= 0}>
          Salvar
        </Button>
      </div>
    </article>
  );
}

function Metrics({ tenantId }: { tenantId: string }) {
  const [days, setDays] = useState(7);
  const { data } = useQuery({
    queryKey: ["metrics", tenantId, days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 864e5).toISOString();
      const count = async (type: string) =>
        (
          await supabase
            .from("telemetry_events")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .eq("event_type", type)
            .gte("created_at", since)
        ).count ?? 0;
      const [sessions, views, reviews, wifi, intel, prods] = await Promise.all([
        count("session_start"),
        count("product_view"),
        count("review_click"),
        count("wifi_open"),
        supabase.rpc("product_intelligence", { _tenant: tenantId, _days: days }),
        supabase.from("products").select("id,name").eq("tenant_id", tenantId),
      ]);
      const names = new Map((prods.data ?? []).map((p) => [p.id, p.name]));
      const rows = (intel.data ?? [])
        .map((r) => ({
          ...r,
          name: names.get(r.product_id) ?? "—",
          avg: Number(r.avg_attention_s ?? 0),
        }))
        .sort((a, b) => b.avg - a.avg);
      return { sessions, views, reviews, wifi, rows };
    },
  });
  const overall = data?.rows.length
    ? data.rows.reduce((a, r) => a + r.avg, 0) / data.rows.length
    : 0;
  const cards = [
    { label: "Sessões abertas", value: data?.sessions, icon: Users },
    { label: "Visualizações de pratos", value: data?.views, icon: Eye },
    { label: "Cliques no Google Review", value: data?.reviews, icon: Star },
    { label: "Aberturas de Wi-Fi", value: data?.wifi, icon: Wifi },
  ];
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {[7, 15, 30].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded-full px-4 py-1.5 text-sm ${days === d ? "bg-primary text-primary-foreground" : "glass"}`}
          >
            {d} dias
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
            <c.icon className="h-4 w-4 text-gold" />
            <p className="mt-3 text-3xl font-semibold tabular-nums">{c.value ?? "–"}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="p-3">Produto</th>
              <th className="p-3">Atenção média</th>
              <th className="p-3">Views</th>
              <th className="p-3">Favoritos</th>
              <th className="p-3">Personalizações</th>
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((r) => {
              const hot = r.avg > overall * 1.2;
              return (
                <tr
                  key={r.product_id}
                  className={`border-b border-border last:border-0 ${hot ? "bg-success/10" : ""}`}
                >
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className={`p-3 tabular-nums font-semibold ${hot ? "text-success" : ""}`}>
                    <span className="inline-flex items-center gap-1">
                      {r.avg.toFixed(1)}s {hot && <TrendingUp className="h-3.5 w-3.5" />}
                    </span>
                  </td>
                  <td className="p-3 tabular-nums">{r.views}</td>
                  <td className="p-3 tabular-nums">{r.favorites}</td>
                  <td className="p-3 tabular-nums">{r.customize_opens}</td>
                </tr>
              );
            })}
            {data && !data.rows.length && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Sem dados no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="border-t border-border p-3 text-xs text-muted-foreground">
          Em verde: pratos com atenção acima da média — boas oportunidades de destaque e margem.
        </p>
      </div>
    </div>
  );
}
