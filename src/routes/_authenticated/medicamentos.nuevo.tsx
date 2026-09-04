import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { MedicationForm } from "@/components/MedicationForm";
import { useSaveMedication } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/medicamentos/nuevo")({
  head: () => ({
    meta: [
      { title: "Agregar medicamento — Pastillero Digital" },
      { name: "description", content: "Escribe el nombre, la dosis y la hora de tu medicamento." },
      { property: "og:title", content: "Agregar medicamento — Pastillero Digital" },
      { property: "og:description", content: "Escribe el nombre, la dosis y la hora." },
    ],
  }),
  component: Nuevo,
});

function Nuevo() {
  const guardar = useSaveMedication();
  const navigate = useNavigate();
  const [listo, setListo] = useState(false);

  if (listo) {
    return (
      <AppShell title="Agregar medicamento">
        <div className="card-surface p-6 text-center">
          <p className="text-5xl">✅</p>
          <h1 className="mt-4 text-2xl font-bold">Listo. Tu medicamento quedó programado.</h1>
          <Link
            to="/medicamentos"
            className="mt-6 flex min-h-16 items-center justify-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground"
          >
            VER MIS MEDICAMENTOS
          </Link>
          <button
            type="button"
            onClick={() => navigate({ to: "/inicio" })}
            className="mt-3 min-h-14 w-full rounded-2xl border-2 border-primary text-lg font-semibold text-primary"
          >
            Volver al inicio
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Agregar medicamento">
      <h1 className="text-2xl font-bold">Agregar medicamento</h1>
      <p className="mt-2 text-lg text-muted-foreground">Solo necesitamos el nombre y la hora.</p>
      <MedicationForm
        guardando={guardar.isPending}
        textoBoton="GUARDAR MEDICAMENTO"
        onSubmit={async (input) => {
          try {
            await guardar.mutateAsync({ input });
            toast.success("Medicamento guardado.");
            setListo(true);
          } catch {
            toast.error("No pudimos guardar. Intenta otra vez.");
          }
        }}
      />
    </AppShell>
  );
}
