export function menuGateStorageKey(tenantId: string) {
  return `bupin-menu-unlocked-${tenantId}`;
}

export function isMenuGateUnlocked(tenantId: string): boolean {
  try {
    return localStorage.getItem(menuGateStorageKey(tenantId)) === "1";
  } catch {
    return false;
  }
}

export function markMenuGateUnlocked(tenantId: string) {
  try {
    localStorage.setItem(menuGateStorageKey(tenantId), "1");
  } catch {
    // Modo privado/quota cheia: desbloqueia só nesta aba atual.
  }
}

export function needsMenuGate(enabled: boolean | undefined, tenantId: string) {
  return enabled === true && !isMenuGateUnlocked(tenantId);
}

export type GateContactValidation = {
  fullName: string;
  whatsapp: string;
  nameValid: boolean;
  phoneValid: boolean;
};

export function validateGateContact(name: string, phone: string): GateContactValidation {
  const fullName = name.trim().replace(/\s+/g, " ");
  const whatsapp = phone.replace(/\D/g, "");
  return {
    fullName,
    whatsapp,
    nameValid: fullName.length >= 5 && fullName.includes(" "),
    phoneValid: whatsapp.length >= 10 && whatsapp.length <= 15,
  };
}
