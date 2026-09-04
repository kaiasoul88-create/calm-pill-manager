import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { MedicationForm } from "@/components/MedicationForm";
import {
  useDeleteMedication,
  useMedications,
  useSaveMedication,
  useSchedules,
  useSetMedicationStatus,
} from "@/lib/data";

export const Route = createFileRoute("/_authenticated/medicamentos/$id")({
  head: () => ({
    meta: [
      { title: "Editar medicamento — Pastillero Digital" },
      { name: "description", content: "Cambia el nombre, la dosis, los horarios o las fechas." },
      { property: "og:title", content: "Editar medicamento — Pastillero Digital" },
      { property: "og:description", content: "Cambia el nombre, la dosis o los horarios." },
    ],
  }),
  component: Editar,
});

function Editar() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: medications = [], isLoading } = useMedications();
  const { data: schedules = [] } = useSchedules();
  const guardar = useSaveMedication();
  const cambiarEstado = useSetMedicationStatus();
  const borrar = useDeleteMedication();
  const [confirmar, setConfirmar] = useState(false);

  const med = medications.find((m) => m.id === id);
  const horarios = schedules.filter((s) => s.medication_id === id);

  if (isLoading) {
    return (
      <AppShell title="Editar medicamento">
        <p className="text-lg">Un momento…</p>
      </AppShell>
    );
  }

  if (!med) {
    return (
      <AppShell title="Editar medicamento">
        <p className="text-xl font-semibold">No encontramos este medicamento.</p>
      </AppShell>
    );
  }

  const activo = med.status === "active";

  return (
    <AppShell title="Editar medicamento">
      <h1 className="text-2xl font-bold">Editar {med.name}</h1>

      <MedicationForm
        guardando={guardar.isPending}
        textoBoton="GUARDAR CAMBIOS"
        inicial={{
          name: med.name,
          dosage: med.dosage,
          description: med.description ?? "",
          notes: med.notes ?? "",
          start_date: med.start_date,
          end_date: med.end_date ?? "",
          frequency: horarios[0]?.frequency ?? "daily",
          days_of_week: horarios[0]?.days_of_week ?? [0, 1, 2, 3, 4, 5, 6],
          times: horarios.map((h) => h.time),
        }}
        onSubmit={async (input) => {
          try {
            await guardar.mutateAsync({ id: med.id, input });
            toast.success("Medicamento guardado.");
            navigate({ to: "/medicamentos" });
          } catch {
            toast.error("No pudimos guardar. Intenta otra vez.");
          }
        }}
      />

      <div className="card-surface mt-6 space-y-3 p-6">
        <button
          type="button"
          onClick={async () => {
            await cambiarEstado.mutateAsync({ id: med.id, status: activo ? "paused" : "active" });
            toast.success(activo ? "Medicamento pausado." : "Medicamento activado.");
          }}
          className="min-h-16 w-full rounded-2xl bg-accent text-lg font-semibold text-accent-foreground"
        >
          {activo ? "Pausar este medicamento" : "Activar este medicamento"}
        </button>

        {!confirmar ? (
          <button
            type="button"
            onClick={() => setConfirmar(true)}
            className="min-h-16 w-full rounded-2xl border-2 border-destructive text-lg font-semibold text-destructive"
          >
            Eliminar medicamento
          </button>
        ) : (
          <div className="rounded-2xl bg-warning-soft p-5">
            <p className="text-lg font-semibold">¿Quieres eliminar este medicamento?</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setConfirmar(false)}
                className="min-h-14 flex-1 rounded-xl border-2 border-primary text-lg font-semibold text-primary"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={async () => {
                  await borrar.mutateAsync(med.id);
                  toast.success("Medicamento eliminado.");
                  navigate({ to: "/medicamentos" });
                }}
                className="min-h-14 flex-1 rounded-xl bg-destructive text-lg font-semibold text-destructive-foreground"
              >
                ELIMINAR
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
