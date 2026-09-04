import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useMedications, useSchedules, useSetMedicationStatus } from "@/lib/data";
import { formatTime } from "@/lib/pastillero";

export const Route = createFileRoute("/_authenticated/medicamentos/")({
  head: () => ({
    meta: [
      { title: "Mis medicamentos — Pastillero Digital" },
      { name: "description", content: "Consulta, edita o pausa los medicamentos que tomas." },
      { property: "og:title", content: "Mis medicamentos — Pastillero Digital" },
      { property: "og:description", content: "Consulta, edita o pausa tus medicamentos." },
    ],
  }),
  component: Medicamentos,
});

function Medicamentos() {
  const { data: medications = [], isLoading } = useMedications();
  const { data: schedules = [] } = useSchedules();
  const cambiarEstado = useSetMedicationStatus();

  return (
    <AppShell title="Medicamentos">
      <h1 className="text-2xl font-bold">Mis medicamentos</h1>

      <Link
        to="/medicamentos/nuevo"
        className="mt-5 flex min-h-16 items-center justify-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground"
      >
        + AGREGAR MEDICAMENTO
      </Link>

      {isLoading ? (
        <p className="mt-6 text-lg">Un momento…</p>
      ) : medications.length === 0 ? (
        <div className="card-surface mt-6 p-6">
          <p className="text-xl font-semibold">Todavía no tienes medicamentos programados.</p>
          <p className="mt-2 text-lg text-muted-foreground">
            Agrega tu primer medicamento para comenzar.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {medications.map((med) => {
            const horarios = schedules
              .filter((s) => s.medication_id === med.id)
              .map((s) => formatTime(s.time));
            const activo = med.status === "active";
            return (
              <li key={med.id} className="card-surface p-5">
                <h2 className="text-xl font-semibold">💊 {med.name}</h2>
                {med.dosage ? <p className="text-lg text-muted-foreground">{med.dosage}</p> : null}
                <p className="mt-2 text-lg">
                  <span className="font-semibold">Horarios: </span>
                  {horarios.length ? horarios.join(" · ") : "Sin horario"}
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {activo ? "✅ Activo" : "⏸️ Pausado"}
                </p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <Link
                    to="/medicamentos/$id"
                    params={{ id: med.id }}
                    className="flex min-h-14 flex-1 items-center justify-center rounded-xl border-2 border-primary text-lg font-semibold text-primary"
                  >
                    Editar
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      await cambiarEstado.mutateAsync({
                        id: med.id,
                        status: activo ? "paused" : "active",
                      });
                      toast.success(activo ? "Medicamento pausado." : "Medicamento activado.");
                    }}
                    className="min-h-14 flex-1 rounded-xl bg-accent text-lg font-semibold text-accent-foreground"
                  >
                    {activo ? "Pausar" : "Activar"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
