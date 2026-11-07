import * as React from "react";

type Theme = "light" | "dark";
type ThemeContextValue = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void };

const STORAGE_KEY = "bupin-theme";
const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Sempre começa em "light" para o HTML do primeiro render (SSR e hidratação)
  // bater exatamente. O tema real salvo é aplicado logo após montar, no effect —
  // isso evita mismatch de hidratação quando o usuário está no tema escuro.
  const [theme, setThemeState] = React.useState<Theme>("light");

  React.useEffect(() => {
    const initial = readStoredTheme();
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  // Aplica a classe e persiste a escolha a cada mudança.
  React.useEffect(() => {
    applyTheme(theme);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = React.useCallback((t: Theme) => setThemeState(t), []);
  const toggle = React.useCallback(
    () => setThemeState((t) => (t === "dark" ? "light" : "dark")),
    [],
  );

  const value = React.useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
