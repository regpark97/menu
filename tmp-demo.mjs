import { createClient } from "@supabase/supabase-js";
const sb = createClient(
  "https://ulxndzniyeyracujqmlu.supabase.co",
  "sb_publishable_aS1Z-iqtHxJISXVEHBe5gQ_RVJf-tmq",
  { auth: { persistSession: false } },
);

const SLUG = "francisco-coffee";
const { data: t, error: te } = await sb.from("tenants").select("*").eq("slug", SLUG).maybeSingle();
if (te) console.log("erro tenant:", te.message);
if (!t) {
  console.log("TENANT DEMO NAO EXISTE (slug francisco-coffee)");
  const { data: all } = await sb.from("tenants").select("id,name,slug,active");
  console.log("tenants existentes:", JSON.stringify(all, null, 2));
} else {
  console.log("TENANT:", JSON.stringify({
    id: t.id, name: t.name, slug: t.slug, active: t.active,
    wifi_ssid: t.wifi_ssid, wifi_password: t.wifi_password,
    google_review_url: t.google_review_url, logo_url: t.logo_url, bg_image_url: t.bg_image_url,
    owner_user_id: t.owner_user_id, plan: t.plan, tagline: t.tagline,
  }, null, 2));
  const { data: p } = await sb.from("products").select("id,name,is_available,moderation_status,media_url").eq("tenant_id", t.id);
  console.log("produtos:", p?.length ?? 0);
  console.log(JSON.stringify(p, null, 2));
  const { data: c } = await sb.from("categories").select("id,name").eq("tenant_id", t.id);
  console.log("categorias:", c?.length ?? 0);
  const { data: tags } = await sb.from("nfc_tags").select("tag_code,tenant_id").eq("tenant_id", t.id);
  console.log("tags vinculadas:", JSON.stringify(tags));
}
