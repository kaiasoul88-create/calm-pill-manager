import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useUpdateProfile } from "@/lib/data";
import { DISCLAIMER } from "@/lib/pastillero";
import { applyTextSize } from "@/lib/text-size";

const TAMANOS = [
  { v: "normal", label: "Normal" },
  { v: "grande", label: "Grande" },
  { v: "muy-grande", label: "Muy grande" },
];

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Mi perfil — Pastillero Digital" },
      { name: "description", content: "Cambia tu nombre, el tamaño del texto y tus avisos." },
      { property: "og:title", content: "Mi perfil — Pastillero Digital" },
      { property: "og:description", content: "Cambia tu nombre y el tamaño del texto." },
    ],
  }),
  component: Perfil,
});

function Perfil() {
  const { data: profile } = useProfile();
  const actualizar = useUpdateProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setTimezone(profile.timezone);
    }
  }, [profile]);

  const avisoNavegador = profile?.notification_preferences?.browser ?? false;

  return (
    <AppShell title="Perfil">
      <h1 className="text-2xl font-bold">Mi perfil</h1>

      <form
        className="card-surface mt-5 space-y-5 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          await actualizar.mutateAsync({ name: name.trim().slice(0, 60), timezone });
          toast.success("Listo. Datos guardados.");
        }}
      >
        <div>
          <label htmlFor="nombre" className="block text-lg font-semibold">
            Tu nombre
          </label>
          <input
            id="nombre"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 min-h-14 w-full rounded-xl border-2 border-input bg-background px-4 text-lg"
          />
        </div>
        <div>
          <label htmlFor="zona" className="block text-lg font-semibold">
            Zona horaria
          </label>
          <input
            id="zona"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="mt-2 min-h-14 w-full rounded-xl border-2 border-input bg-background px-4 text-lg"
          />
          <p className="mt-1 text-base text-muted-foreground">
            Tu hora actual: {new Date().toLocaleTimeString("es", { timeStyle: "short" })}
          </p>
        </div>
        <button
          type="submit"
          className="min-h-16 w-full rounded-2xl bg-primary text-xl font-semibold text-primary-foreground"
        >
          GUARDAR
        </button>
      </form>

      <section aria-labelledby="texto" className="card-surface mt-6 p-6">
        <h2 id="texto" className="text-lg font-semibold">
          Tamaño del texto
        </h2>
        <div className="mt-3 space-y-3">
          {TAMANOS.map((t) => {
            const activo = (profile?.text_size ?? "normal") === t.v;
            return (
              <button
                key={t.v}
                type="button"
                aria-pressed={activo}
                onClick={async () => {
                  applyTextSize(t.v);
                  await actualizar.mutateAsync({ text_size: t.v });
                  toast.success("Listo. Cambiamos el tamaño del texto.");
                }}
                className={`min-h-16 w-full rounded-xl border-2 text-lg font-semibold ${
                  activo
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background"
                }`}
              >
                {activo ? "✔ " : ""}
                {t.label}
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="avisos" className="card-surface mt-6 p-6">
        <h2 id="avisos" className="text-lg font-semibold">
          Avisos
        </h2>
        <p className="mt-2 text-base text-muted-foreground">
          Mientras la aplicación esté abierta, te mostramos un aviso cuando llegue la hora. Si
          activas los avisos del teléfono o del computador, también te avisamos con una notificación
          cuando la aplicación esté abierta. Los avisos con la aplicación cerrada todavía no están
          disponibles.
        </p>
        <button
          type="button"
          aria-pressed={avisoNavegador}
          onClick={async () => {
            if (!avisoNavegador) {
              if (typeof Notification === "undefined") {
                toast.error("Este dispositivo no permite avisos.");
                return;
              }
              const permiso = await Notification.requestPermission();
              if (permiso !== "granted") {
                toast.error("No nos diste permiso para avisarte.");
                return;
              }
            }
            await actualizar.mutateAsync({
              notification_preferences: { in_app: true, browser: !avisoNavegador },
            });
            toast.success(avisoNavegador ? "Avisos desactivados." : "Avisos activados.");
          }}
          className={`mt-4 min-h-16 w-full rounded-xl border-2 text-lg font-semibold ${
            avisoNavegador
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-background"
          }`}
        >
          {avisoNavegador ? "✔ Avisos activados" : "Activar avisos en este dispositivo"}
        </button>
      </section>

      <section className="card-surface mt-6 p-6">
        <button
          type="button"
          onClick={async () => {
            await qc.cancelQueries();
            qc.clear();
            await supabase.auth.signOut();
            navigate({ to: "/", replace: true });
          }}
          className="min-h-16 w-full rounded-2xl border-2 border-primary text-lg font-semibold text-primary"
        >
          Cerrar sesión
        </button>
        <p className="mt-5 text-base text-muted-foreground">{DISCLAIMER}</p>
      </section>
    </AppShell>
  );
}
