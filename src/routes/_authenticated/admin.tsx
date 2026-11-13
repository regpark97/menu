/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PAINEL DO RESTAURANTE — /admin (área do dono do estabelecimento)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Seções (sidebar): Chamadas · Pratos · Wi-Fi e Google · Aparência · Métricas.
 *
 *  Identificação do tenant (AdminPage → queryFn) segue 3 caminhos, em ordem:
 *   1. ?tenant=<id>    → Modo suporte: super admin abriu o painel DE UM CLIENTE
 *                        (link "Acessar Painel do Cliente" do super-admin).
 *   2. Conta com dono  → caminho normal: o tenant cujo owner_user_id é o login.
 *   3. Super admin "nu"→ mostra o primeiro tenant da lista para a equipe
 *                        Bupin não ficar presa numa tela vazia.
 *
 *  Toda escrita (preço, esgotado, Wi-Fi, mídia) é validada também pelas
 *  policies RLS do banco — o painel é o primeiro evisor, o banco é o juiz.
 *
 *  Moderação de mídia: uploads do dono vão para pending_* e aguardam
 *  aprovação no super-admin; o cardápio segue mostrando a última foto
 *  aprovada. O trigger do banco re-força o status 'pending' (defesa em
 *  profundidade: nem um bug aqui publicaria foto sem curadoria).
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Upload,
  Clock,
  Wifi,
  Eye,
  Users,
  Star,
  TrendingUp,
  Plus,
  Trash2,
  X,
  Images,
  ImagePlus,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ADMIN_SECTIONS } from "@/components/dashboard/sections";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
  parseModifiers,
  cleanModifiers,
  type GalleryItem,
  type ModifierGroup,
} from "@/lib/format";
import { ModifiersEditor } from "@/components/ModifiersEditor";
import { uploadMedia } from "@/lib/media";
import { WaiterCalls } from "@/components/WaiterCalls";

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
  const canSwitch = isSupport;
  const [section, setSection] = useState("calls");

  return (
    <DashboardLayout
      variant="admin"
      title={tenant?.name ?? "Painel do Restaurante"}
      subtitle={
        isSupport
          ? `Modo suporte${tenant ? ` · ${tenant.name}` : ""}`
          : "Gerencie cardápio, fotos, Wi-Fi e métricas"
      }
      sections={ADMIN_SECTIONS}
      activeSection={section}
      onSectionChange={setSection}
      menuHref={tenant ? { slug: tenant.slug } : undefined}
      headerExtra={
        canSwitch ? (
          <Link
            to="/super-admin"
            search={{ section: "tenants" }}
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Trocar de cliente
          </Link>
        ) : null
      }
    >
      {isLoading ? null : !tenant ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
          Nenhum estabelecimento vinculado à sua conta ainda. Fale com o suporte Bupin.
        </div>
      ) : (
        <>
          {isSupport && (
            <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-warning">
              Modo suporte: você está vendo o painel de {tenant.name}.
            </div>
          )}
          {section === "calls" && <WaiterCalls tenantId={tenant.id} />}
          {section === "products" && <ProductsList tenantId={tenant.id} />}
          {section === "wifi" && <WifiCard tenant={tenant} />}
          {section === "branding" && <BrandingCard tenant={tenant} />}
          {section === "metrics" && <Metrics tenantId={tenant.id} />}
        </>
      )}
    </DashboardLayout>
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
function BrandingCard({ tenant }: { tenant: Tables<"tenants"> }) {
  const [logo, setLogo] = useState(tenant.logo_url ?? "");
  const [bg, setBg] = useState(tenant.bg_image_url ?? "");
  const [busy, setBusy] = useState<"logo" | "bg" | null>(null);
  const qc = useQueryClient();

  async function upload(kind: "logo" | "bg", f: File | undefined) {
    if (!f) return;
    setBusy(kind);
    try {
      const m = await uploadMedia(f, `${tenant.id}/${kind}`);
      if (kind === "logo") setLogo(m.url);
      else setBg(m.url);
      // Salva direto para refletir no cardápio na hora.
      const patch = kind === "logo" ? { logo_url: m.url } : { bg_image_url: m.url };
      const { error } = await supabase.from("tenants").update(patch).eq("id", tenant.id);
      if (error) throw error;
      toast.success(kind === "logo" ? "Logo atualizada" : "Imagem de fundo atualizada");
      qc.invalidateQueries({ queryKey: ["my-tenant"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(null);
  }

  return (
    <section className="glass space-y-3 rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <ImagePlus className="h-5 w-5 text-gold" />
        <h2 className="text-lg text-muted-foreground">Aparência da loja</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <div>
          <label className="text-xs text-muted-foreground">Logo</label>
          <div className="mt-1 flex items-center gap-3">
            <div className="h-16 w-16 overflow-hidden rounded-full bg-secondary">
              {logo && <img src={logo} alt="" className="h-full w-full object-cover" />}
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary">
              <Upload className="h-4 w-4" /> {busy === "logo" ? "Enviando…" : "Trocar logo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy !== null}
                onChange={(e) => upload("logo", e.target.files?.[0])}
              />
            </label>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Imagem de fundo (tela inicial)</label>
          <div className="mt-1 flex items-center gap-3">
            <div className="h-16 w-24 overflow-hidden rounded-lg bg-secondary">
              {bg && <img src={bg} alt="" className="h-full w-full object-cover" />}
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary">
              <Upload className="h-4 w-4" /> {busy === "bg" ? "Enviando…" : "Trocar fundo"}
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                disabled={busy !== null}
                onChange={(e) => upload("bg", e.target.files?.[0])}
              />
            </label>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Escolha uma imagem da galeria do seu celular. A logo e o fundo aparecem na tela inicial do
        cardápio.
      </p>
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

  /** Move o prato uma posição (troca sort_order com o vizinho). */
  async function move(product: Tables<"products">, dir: -1 | 1) {
    const list = products ?? [];
    const sorted = [...list].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((p) => p.id === product.id);
    const other = sorted[idx + dir];
    if (!other) return;
    // Troca os sort_orders dos dois pratos.
    const { error } = await supabase
      .from("products")
      .update({ sort_order: product.sort_order })
      .eq("id", other.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    const { error: e2 } = await supabase
      .from("products")
      .update({ sort_order: other.sort_order })
      .eq("id", product.id);
    if (e2) {
      toast.error(e2.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin-products", tenantId] });
  }

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
        <ProductRow key={p.id} product={p} onChange={refetch} onMove={move} />
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
  const [mods, setMods] = useState<ModifierGroup[]>([]);
  const [saving, setSaving] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setCategoryId(initialCategoryId ?? categories[0]?.id ?? "");
      setPrice(0);
      setDesc("");
      setMods([]);
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
      modifiers: cleanModifiers(mods),
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

        <div className="mt-1">
          <ModifiersEditor value={mods} onChange={setMods} />
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

function ProductRow({
  product,
  onChange,
  onMove,
}: {
  product: Tables<"products">;
  onChange: () => void;
  onMove: (product: Tables<"products">, dir: -1 | 1) => Promise<void>;
}) {
  const [available, setAvailable] = useState(product.is_available);
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(product.price_cents);
  const [desc, setDesc] = useState(product.description ?? "");
  const [uploading, setUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [mods, setMods] = useState<ModifierGroup[]>(() => parseModifiers(product.modifiers));
  const gallery = parseGallery(product.media_gallery);
  const pendingGallery = parseGallery(product.pending_media_gallery);
  useEffect(() => {
    setAvailable(product.is_available);
  }, [product.is_available]);
  useEffect(() => {
    setName(product.name);
  }, [product.name]);
  useEffect(() => {
    setMods(parseModifiers(product.modifiers));
  }, [product.modifiers]);

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
      .update({
        name: name.trim(),
        price_cents: price,
        description: desc,
        modifiers: cleanModifiers(mods),
      })
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
    name !== product.name ||
    price !== product.price_cents ||
    desc !== (product.description ?? "") ||
    JSON.stringify(cleanModifiers(mods)) !== JSON.stringify(parseModifiers(product.modifiers));
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
          <div className="mt-2 flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Ordem</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Mover para cima"
              onClick={() => onMove(product, -1)}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Mover para baixo"
              onClick={() => onMove(product, 1)}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
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
      <ModifiersEditor value={mods} onChange={setMods} />

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

      // Prefere a v2 (com swipes/sessões únicas); se a migration ainda não foi
      // aplicada, cai para a v1 (sem essas colunas) sem quebrar a tela.
      const intel = await supabase.rpc("product_intelligence_v2", {
        _tenant: tenantId,
        _days: days,
      });
      let prodRows: {
        product_id: string;
        views: number | null;
        avg_attention_s: number | null;
        favorites: number | null;
        customize_opens: number | null;
        swipes?: number;
        unique_sessions?: number;
      }[] = [];
      let v2 = false;
      if (!intel.error && intel.data) {
        prodRows = intel.data;
        v2 = true;
      } else {
        const v1 = await supabase.rpc("product_intelligence", { _tenant: tenantId, _days: days });
        prodRows = v1.data ?? [];
      }

      // Estatísticas por mesa (sessões + chamadas). Ignora se a função não existir.
      const tstats = await supabase.rpc("table_stats", { _tenant: tenantId, _days: days });
      const tables = (!tstats.error && tstats.data ? tstats.data : []) as {
        table_ref: string;
        sessions: number;
        calls: number;
      }[];

      const [sessions, views, reviews, wifi, prods] = await Promise.all([
        count("session_start"),
        count("product_view"),
        count("review_click"),
        count("wifi_open"),
        supabase.from("products").select("id,name").eq("tenant_id", tenantId),
      ]);

      const names = new Map((prods.data ?? []).map((p) => [p.id, p.name]));
      const rows = prodRows
        .map((r) => {
          const rviews = Number(r.views ?? 0);
          const favourites = Number(r.favorites ?? 0);
          const customizes = Number(r.customize_opens ?? 0);
          // Taxa de interesse: quantos que viram o prato favoritaram ou personalizaram.
          const interest = rviews > 0 ? ((favourites + customizes) / rviews) * 100 : 0;
          return {
            product_id: r.product_id,
            views: rviews,
            avg: Number(r.avg_attention_s ?? 0),
            favorites: favourites,
            customize_opens: customizes,
            swipes: r.swipes != null ? Number(r.swipes) : null,
            unique_sessions: r.unique_sessions != null ? Number(r.unique_sessions) : null,
            name: names.get(r.product_id) ?? "—",
            interest,
          };
        })
        .sort((a, b) => b.avg - a.avg);
      return { sessions, views, reviews, wifi, rows, tables, v2 };
    },
  });
  const overall = data?.rows.length
    ? data.rows.reduce((a, r) => a + r.avg, 0) / data.rows.length
    : 0;
  const pct = (n: number | undefined, total: number | undefined) =>
    total && total > 0 ? Math.round((Number(n ?? 0) / total) * 100) : 0;
  const cards = [
    { label: "Sessões abertas", value: data?.sessions, icon: Users },
    { label: "Visualizações de pratos", value: data?.views, icon: Eye },
    { label: "Cliques no Google Review", value: data?.reviews, icon: Star },
    { label: "Aberturas de Wi-Fi", value: data?.wifi, icon: Wifi },
  ];
  const cards2 = [
    {
      label: "Atenção média",
      value: data?.rows.length ? `${overall.toFixed(1)}s` : "–",
      icon: TrendingUp,
    },
    {
      label: "Conversão p/ Google",
      value: `${pct(data?.reviews, data?.sessions)}%`,
      icon: Star,
    },
    {
      label: "Uso do Wi-Fi",
      value: `${pct(data?.wifi, data?.sessions)}%`,
      icon: Wifi,
    },
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
      <div className="grid grid-cols-3 gap-3">
        {cards2.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-secondary/40 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <c.icon className="h-4 w-4 text-gold" />
              <p className="text-xs">{c.label}</p>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="p-3">Produto</th>
              <th className="p-3">Atenção média</th>
              <th className="p-3">Interesse</th>
              <th className="p-3">Views</th>
              {data?.v2 && <th className="p-3">Sessões</th>}
              {data?.v2 && <th className="p-3">Swipes</th>}
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
                  <td
                    className={`p-3 tabular-nums font-semibold ${r.interest >= 15 ? "text-success" : r.interest < 5 && r.views >= 5 ? "text-muted-foreground" : ""}`}
                  >
                    {r.interest.toFixed(0)}%
                  </td>
                  <td className="p-3 tabular-nums">{r.views}</td>
                  {data?.v2 && <td className="p-3 tabular-nums">{r.unique_sessions ?? 0}</td>}
                  {data?.v2 && <td className="p-3 tabular-nums">{r.swipes ?? 0}</td>}
                  <td className="p-3 tabular-nums">{r.favorites}</td>
                  <td className="p-3 tabular-nums">{r.customize_opens}</td>
                </tr>
              );
            })}
            {data && !data.rows.length && (
              <tr>
                <td colSpan={data.v2 ? 8 : 6} className="p-6 text-center text-muted-foreground">
                  Sem dados no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="border-t border-border p-3 text-xs text-muted-foreground">
          Em verde: atenção acima da média (boa oportunidade de destaque). Interesse = (favoritos +
          personalizações) ÷ views — quanto mais alto, mais o prato desperta ação.
        </p>
      </div>

      {data?.tables.length ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border p-3">
            <Users className="h-4 w-4 text-gold" />
            <h3 className="text-sm font-semibold">Por mesa</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="p-3">Mesa</th>
                <th className="p-3">Sessões</th>
                <th className="p-3">Chamadas</th>
              </tr>
            </thead>
            <tbody>
              {data.tables.map((t) => (
                <tr key={t.table_ref} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium">{t.table_ref}</td>
                  <td className="p-3 tabular-nums">{t.sessions}</td>
                  <td className={`p-3 tabular-nums ${t.calls > 0 ? "text-warning" : ""}`}>
                    {t.calls}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-border p-3 text-xs text-muted-foreground">
            Sessões = quantas visitas aquela mesa abriu. Chamadas = pedidos de garçom/conta/gerente.
            Mesas com muitas chamadas podem indicar fila de atendimento.
          </p>
        </div>
      ) : null}
    </div>
  );
}
