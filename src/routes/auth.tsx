import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Modo = "entrar" | "registro" | "recuperar";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { modo: Modo } => ({
    modo: (["entrar", "registro", "recuperar"].includes(String(search["modo"]))
      ? search["modo"]
      : "entrar") as Modo,
  }),
  head: () => ({
    meta: [
      { title: "Entrar a Pastillero Digital" },
      {
        name: "description",
        content: "Crea tu cuenta o entra para ver y registrar tus tomas de medicamentos.",
      },
      { property: "og:title", content: "Entrar a Pastillero Digital" },
      {
        property: "og:description",
        content: "Crea tu cuenta o entra para ver y registrar tus tomas.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { modo } = Route.useSearch();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    try {
      if (modo === "registro") {
        if (name.trim().length < 2) {
          toast.error("Escribe tu nombre.");
          return;
        }
        if (password.length < 6) {
          toast.error("La contraseña debe tener al menos 6 letras o números.");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { name: name.trim() },
            emailRedirectTo: `${window.location.origin}/inicio`,
          },
        });
        if (error) throw error;
        toast.success("Listo. Tu cuenta quedó creada.");
        navigate({ to: "/inicio" });
      } else if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        navigate({ to: "/inicio" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth?modo=entrar`,
        });
        if (error) throw error;
        toast.success("Te enviamos un correo para crear una contraseña nueva.");
      }
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "Algo no salió bien.";
      toast.error(
        mensaje.includes("Invalid login")
          ? "El correo o la contraseña no coinciden."
          : mensaje.includes("already registered")
            ? "Ese correo ya tiene una cuenta. Entra con tu contraseña."
            : mensaje,
      );
    } finally {
      setCargando(false);
    }
  }

  const titulo =
    modo === "registro" ? "Crear mi cuenta" : modo === "entrar" ? "Entrar" : "Recuperar contraseña";

  return (
    <div className="min-h-screen bg-background px-5 py-10">
      <div className="mx-auto max-w-md">
        <Link to="/" className="text-base text-primary underline">
          ← Volver al inicio
        </Link>
        <h1 className="mt-6 text-3xl font-bold">{titulo}</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          {modo === "recuperar"
            ? "Escribe tu correo y te enviamos un enlace."
            : "Solo pedimos lo necesario."}
        </p>

        <form onSubmit={onSubmit} className="card-surface mt-6 space-y-5 p-6">
          {modo === "registro" && (
            <div>
              <label htmlFor="name" className="block text-lg font-semibold">
                Tu nombre
              </label>
              <input
                id="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                required
                className="mt-2 min-h-14 w-full rounded-xl border-2 border-input bg-background px-4 text-lg"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-lg font-semibold">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              required
              className="mt-2 min-h-14 w-full rounded-xl border-2 border-input bg-background px-4 text-lg"
            />
          </div>

          {modo !== "recuperar" && (
            <div>
              <label htmlFor="password" className="block text-lg font-semibold">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete={modo === "registro" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                maxLength={72}
                required
                className="mt-2 min-h-14 w-full rounded-xl border-2 border-input bg-background px-4 text-lg"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="min-h-16 w-full rounded-2xl bg-primary text-xl font-semibold text-primary-foreground disabled:opacity-60"
          >
            {cargando
              ? "Un momento…"
              : modo === "registro"
                ? "CREAR MI CUENTA"
                : modo === "entrar"
                  ? "ENTRAR"
                  : "ENVIAR CORREO"}
          </button>
        </form>

        <div className="mt-6 space-y-3 text-lg">
          {modo !== "registro" && (
            <Link to="/auth" search={{ modo: "registro" }} className="block text-primary underline">
              No tengo cuenta. Quiero crear una.
            </Link>
          )}
          {modo !== "entrar" && (
            <Link to="/auth" search={{ modo: "entrar" }} className="block text-primary underline">
              Ya tengo cuenta. Quiero entrar.
            </Link>
          )}
          {modo !== "recuperar" && (
            <Link
              to="/auth"
              search={{ modo: "recuperar" }}
              className="block text-primary underline"
            >
              Olvidé mi contraseña.
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
