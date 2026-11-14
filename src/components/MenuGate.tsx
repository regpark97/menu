import { useState } from "react";
import { LockKeyhole, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useMenuLanguage } from "@/hooks/use-menu-language";
import { markMenuGateUnlocked, validateGateContact } from "@/lib/menu-gate";
import { RestaurantBackdrop } from "@/components/RestaurantBackdrop";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Tenant = Tables<"public_menu">;

/** Captação opcional antes do feed; só libera após gravar nome + WhatsApp. */
export function MenuGate({
  tenant,
  onUnlock,
  onBack,
}: {
  tenant: Tenant;
  onUnlock: () => void;
  onBack: () => void;
}) {
  const { t } = useMenuLanguage();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState({ name: false, phone: false, save: false });
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const contact = validateGateContact(name, phone);
    if (!contact.nameValid || !contact.phoneValid) {
      setErrors({ name: !contact.nameValid, phone: !contact.phoneValid, save: false });
      return;
    }
    setSubmitting(true);
    setErrors({ name: false, phone: false, save: false });
    try {
      const { error } = await supabase.from("menu_gate_leads").insert({
        tenant_id: tenant.id,
        full_name: contact.fullName,
        whatsapp: contact.whatsapp,
      });
      if (error) throw error;
      markMenuGateUnlocked(tenant.id);
      onUnlock();
    } catch {
      setErrors({ name: false, phone: false, save: true });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-dvh w-full overflow-hidden">
      <RestaurantBackdrop tenant={tenant} />
      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-6 py-8">
        {tenant.logo_url && (
          <img src={tenant.logo_url} alt={tenant.name} className="mb-5 h-24 w-24 object-contain" />
        )}
        <div className="glass w-full max-w-md rounded-[2rem] px-6 pb-6 pt-7 shadow-xl sm:px-8">
          <div className="flex justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold">
              <LockKeyhole className="h-6 w-6" aria-hidden="true" />
            </span>
          </div>
          <h1 className="mt-4 text-center text-3xl">{t("gateTitle")}</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">{t("gateIntro")}</p>
          <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
            <div>
              <label htmlFor="gate-full-name" className="text-sm font-medium">
                {t("gateFullName")}
              </label>
              <Input
                id="gate-full-name"
                className="mt-1.5 h-12 bg-background/70 text-base"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("gateFullNamePlaceholder")}
                autoComplete="name"
                maxLength={120}
                disabled={submitting}
                required
                aria-invalid={errors.name}
                aria-describedby={errors.name ? "gate-name-error" : undefined}
              />
              {errors.name && (
                <p id="gate-name-error" role="alert" className="mt-1 text-xs text-destructive">
                  {t("gateNameError")}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="gate-whatsapp" className="text-sm font-medium">
                WhatsApp
              </label>
              <Input
                id="gate-whatsapp"
                className="mt-1.5 h-12 bg-background/70 text-base"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder={t("gatePhonePlaceholder")}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={25}
                disabled={submitting}
                required
                aria-invalid={errors.phone}
                aria-describedby={errors.phone ? "gate-phone-error" : undefined}
              />
              {errors.phone && (
                <p id="gate-phone-error" role="alert" className="mt-1 text-xs text-destructive">
                  {t("gatePhoneError")}
                </p>
              )}
            </div>
            <Button type="submit" disabled={submitting} className="h-12 w-full text-base">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("gateUnlocking")}
                </>
              ) : (
                t("gateTitle")
              )}
            </Button>
            {errors.save && (
              <p role="alert" className="text-center text-xs text-destructive">
                {t("gateError")}
              </p>
            )}
          </form>
          <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
            {t("gatePrivacy")}
          </p>
          <Button
            variant="ghost"
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="mt-2 w-full"
          >
            {t("back")}
          </Button>
        </div>
      </div>
    </div>
  );
}
