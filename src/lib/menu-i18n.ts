export const MENU_LOCALES = ["pt-BR", "en", "fr", "it", "es", "ru", "zh-CN"] as const;
export type MenuLocale = (typeof MENU_LOCALES)[number];

export const LANGUAGE_OPTIONS: { locale: MenuLocale; flag: string; name: string }[] = [
  { locale: "pt-BR", flag: "🇧🇷", name: "Português (BR)" },
  { locale: "en", flag: "🇬🇧", name: "English" },
  { locale: "fr", flag: "🇫🇷", name: "Français" },
  { locale: "it", flag: "🇮🇹", name: "Italiano" },
  { locale: "es", flag: "🇪🇸", name: "Español" },
  { locale: "ru", flag: "🇷🇺", name: "Русский" },
  { locale: "zh-CN", flag: "🇨🇳", name: "中文（简体）" },
];

type Messages = readonly [string, string, string, string, string, string, string];

export const UI_MESSAGES = {
  explore: [
    "Explorar cardápio",
    "Explore menu",
    "Explorer le menu",
    "Sfoglia il menu",
    "Explorar menú",
    "Открыть меню",
    "浏览菜单",
  ],
  favorite: [
    "Favoritar",
    "Favorite",
    "Ajouter aux favoris",
    "Aggiungi ai preferiti",
    "Favorito",
    "В избранное",
    "收藏",
  ],
  showWaiter: [
    "Mostre ao atendente para fazer o pedido.",
    "Show this to the staff to place your order.",
    "À montrer au personnel pour commander.",
    "Mostra al personale per ordinare.",
    "Muéstralo al personal para hacer el pedido.",
    "Покажите это сотруднику, чтобы сделать заказ.",
    "请将此页面交给服务员下单。",
  ],
  reviews: [
    "Avaliar no Google",
    "Review on Google",
    "Aviser sur Google",
    "Recensisci su Google",
    "Reseñar en Google",
    "Оставить отзыв в Google",
    "在 Google 上评价",
  ],
  wifiConnect: [
    "Conectar ao Wi-Fi",
    "Connect to Wi-Fi",
    "Se connecter au Wi-Fi",
    "Connetti al Wi-Fi",
    "Conectarse al Wi-Fi",
    "Подключиться к Wi-Fi",
    "连接 Wi-Fi",
  ],
  back: ["Voltar", "Back", "Retour", "Indietro", "Volver", "Назад", "返回"],
  customize: [
    "Personalizar",
    "Customize",
    "Personnaliser",
    "Personalizza",
    "Personalizar",
    "Настроить",
    "自定义",
  ],
  yourWay: [
    "Deixe do seu jeito",
    "Make it your own",
    "À votre façon",
    "A modo tuo",
    "A tu gusto",
    "На ваше усмотрение",
    "按你的喜好",
  ],
  total: ["Total", "Total", "Total", "Totale", "Total", "Итого", "总计"],
  close: ["Fechar", "Close", "Fermer", "Chiudi", "Cerrar", "Закрыть", "关闭"],
  wifiTitle: [
    "Wi-Fi da casa",
    "Store Wi-Fi",
    "Wi-Fi du lieu",
    "Wi-Fi del locale",
    "Wi-Fi del local",
    "Wi-Fi заведения",
    "店内 Wi-Fi",
  ],
  wifiNetwork: ["Rede", "Network", "Réseau", "Rete", "Red", "Сеть", "网络"],
  wifiPassword: ["Senha", "Password", "Mot de passe", "Password", "Contraseña", "Пароль", "密码"],
  copyPassword: [
    "Copiar Senha",
    "Copy Password",
    "Copier le mot de passe",
    "Copia password",
    "Copiar contraseña",
    "Скопировать пароль",
    "复制密码",
  ],
  copiedPassword: [
    "Senha copiada",
    "Password copied",
    "Mot de passe copié",
    "Password copiata",
    "Contraseña copiada",
    "Пароль скопирован",
    "密码已复制",
  ],
  unset: [
    "não configurada",
    "not configured",
    "non configurée",
    "non configurata",
    "no configurada",
    "не настроено",
    "未设置",
  ],
  preparing: [
    "Cardápio em preparação.",
    "Menu coming soon.",
    "Menu bientôt disponible.",
    "Menu in preparazione.",
    "Menú en preparación.",
    "Скоро будет меню.",
    "菜单准备中。",
  ],
  notFound: [
    "Estabelecimento não encontrado.",
    "Establishment not found.",
    "Établissement introuvable.",
    "Locale non trovato.",
    "Establecimiento no encontrado.",
    "Заведение не найдено.",
    "未找到该商家。",
  ],
  language: ["Idioma", "Language", "Langue", "Lingua", "Idioma", "Язык", "语言"],
  translating: [
    "Traduzindo pratos…",
    "Translating dishes…",
    "Traduction des plats…",
    "Traduzione dei piatti…",
    "Traduciendo platos…",
    "Перевод блюд…",
    "正在翻译菜品…",
  ],
} satisfies Record<string, Messages>;

export const UI_WAITER_MESSAGES = {
  waiterTeam: [
    "Chamar a equipe",
    "Call the team",
    "Appeler l'équipe",
    "Chiama il personale",
    "Llamar al personal",
    "Позвать персонал",
    "呼叫店员",
  ],
  waiterBill: [
    "Pedir a conta",
    "Ask for the bill",
    "Demander l'addition",
    "Chiedere il conto",
    "Pedir la cuenta",
    "Принести счёт",
    "请结账",
  ],
  waiterManager: [
    "Falar com o gerente",
    "Speak to the manager",
    "Parler au responsable",
    "Parlare con il direttore",
    "Hablar con el gerente",
    "Поговорить с менеджером",
    "与经理通话",
  ],
  waiterToastBill: [
    "Conta solicitada. Já estamos a caminho!",
    "The bill is on its way!",
    "L'addition est en route !",
    "Il conto è in arrivo!",
    "La cuenta está en camino.",
    "Счёт уже в пути!",
    "账单马上送来！",
  ],
  waiterToastManager: [
    "Gerente avisado. Um instante, por favor.",
    "The manager has been notified. One moment, please.",
    "Le responsable est prévenu. Un instant, s'il vous plaît.",
    "Il direttore è stato avvisato. Un momento, per favore.",
    "El gerente ha sido avisado. Un momento, por favor.",
    "Менеджер уведомлён. Минуточку, пожалуйста.",
    "已通知经理，请稍等。",
  ],
  waiterToast: [
    "Garçom chamado! Já estamos indo.",
    "Waiter called! We're on our way.",
    "Serveur appelé ! Nous arrivons.",
    "Cameriere chiamato! Arriviamo subito.",
    "¡Camarero llamado! Ya vamos.",
    "Официант вызван! Мы идём.",
    "已呼叫服务员，马上就来。",
  ],
  waiterToastTable: [
    "Garçom chamado para a Mesa {table}!",
    "Waiter called to Table {table}!",
    "Serveur appelé à la table {table} !",
    "Cameriere chiamato al tavolo {table}!",
    "¡Camarero llamado a la mesa {table}!",
    "Официант вызван к столу {table}!",
    "已呼叫 {table} 号桌的服务员！",
  ],
  waiterError: [
    "Não foi possível chamar agora. Tente novamente.",
    "Couldn't call now. Please try again.",
    "Impossible d'appeler maintenant. Réessayez.",
    "Impossibile chiamare ora. Riprova.",
    "No se pudo llamar ahora. Inténtalo de nuevo.",
    "Не удалось вызвать сейчас. Попробуйте ещё раз.",
    "暂时无法呼叫，请再试一次。",
  ],
  waiterCooldown: [
    "Você já chamou há pouco. Aguarde um instante.",
    "You called recently. Please wait a moment.",
    "Vous avez déjà appelé. Patientez un instant.",
    "Hai appena chiamato. Attendi un momento.",
    "Ya llamaste hace poco. Espera un momento.",
    "Вы уже вызывали недавно. Подождите немного.",
    "您刚刚呼叫过，请稍等。",
  ],
  table: [
    "Mesa {table}",
    "Table {table}",
    "Table {table}",
    "Tavolo {table}",
    "Mesa {table}",
    "Стол {table}",
    "{table} 号桌",
  ],
  featured: [
    "Destaque da casa",
    "House specialty",
    "Spécialité maison",
    "Specialità della casa",
    "Especialidad de la casa",
    "Фирменное блюдо",
    "招牌推荐",
  ],
} satisfies Record<string, Messages>;

export type UiKey = keyof typeof UI_MESSAGES | keyof typeof UI_WAITER_MESSAGES;

export function isMenuLocale(value: unknown): value is MenuLocale {
  return typeof value === "string" && MENU_LOCALES.includes(value as MenuLocale);
}

export function menuLocaleFor(lang: unknown): MenuLocale {
  return isMenuLocale(lang) ? lang : "pt-BR";
}

export function uiText(locale: MenuLocale, key: UiKey, table?: string): string {
  const messages =
    key in UI_MESSAGES
      ? UI_MESSAGES[key as keyof typeof UI_MESSAGES]
      : UI_WAITER_MESSAGES[key as keyof typeof UI_WAITER_MESSAGES];
  const text = messages[MENU_LOCALES.indexOf(locale)] ?? key;
  return table ? text.replaceAll("{table}", table) : text;
}

export function moneyText(cents: number, locale: MenuLocale): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(cents / 100);
}
