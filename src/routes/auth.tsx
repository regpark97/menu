import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Bupin" },
      { name: "description", content: "Acesse o painel do seu estabelecimento no Bupin." },
      { property: "og:title", content: "Entrar — Bupin" },
      { property: "og:description", content: "Acesse o painel do seu estabelecimento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

// O login com Google usa o serviço do Lovable (@lovable.dev/cloud-auth-js), que só
// funciona quando o app roda num domínio do Lovable. Em localhost, na Vercel ou em
// domínio próprio o botão não tem como funcionar — então nem é exibido.
// Para ter Google de verdade fora do Lovable, configure o OAuth nativo no Supabase
// (passo a passo em MIGRACAO-SUPABASE.md, seção "Login com Google").
function googleAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host.endsWith(".lovable.app") || host.endsWith(".lovable.dev");
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [showGoogle] = useState(googleAvailable);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "up") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + "/admin" },
      });
      if (error) toast.error(error.message);
      else setSent(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
      else navigate({ to: "/admin" });
    }
    setBusy(false);
  }

  async function google() {
    setBusy(true);
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    setBusy(false);
    if (r.error) {
      return toast.error(
        "Login com Google indisponível neste projeto. Use e-mail e senha para entrar.",
      );
    }
    if (r.redirected) return;
    navigate({ to: "/admin" });
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-gold">Bupin</p>
        <h1 className="mt-3 text-4xl">{mode === "in" ? "Bem-vindo de volta" : "Criar conta"}</h1>
        {sent ? (
          <p className="mt-6 rounded-xl glass p-4 text-sm">
            Enviamos um link de confirmação para {email}. Confirme e depois entre.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-3">
            <Input
              type="email"
              required
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12"
            />
            <Input
              type="password"
              required
              minLength={6}
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12"
            />
            <Button disabled={busy} className="h-12 w-full">
              {mode === "in" ? "Entrar" : "Cadastrar"}
            </Button>
            {showGoogle ? (
              <Button
                type="button"
                variant="outline"
                onClick={google}
                disabled={busy}
                className="h-12 w-full"
              >
                Continuar com Google
              </Button>
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                {mode === "in"
                  ? "Entre com o e-mail e a senha da sua conta."
                  : "Escolha um e-mail e uma senha para criar sua conta."}
              </p>
            )}
          </form>
        )}
        <button
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            setSent(false);
          }}
          className="mt-6 text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {mode === "in" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
        </button>
      </div>
    </main>
  );
}
