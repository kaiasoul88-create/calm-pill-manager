import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { DoseItem } from "@/components/DoseItem";
import { useDoses, useMarkTaken, useMedications, useProfile, useSchedules, useSnooze } from "@/lib/data";
import { buildDosesForDate, dateKey, formatTime, isDoseDue, nextDose } from "@/lib/pastillero";
import { suscripcionActual } from "@/lib/push-client";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Tu próxima toma — Pastillero Digital" },
      { name: "description", content: "Mira qué medicamento te toca ahora y registra tu toma." },
      { property: "og:title", content: "Tu próxima toma — Pastillero Digital" },
      { property: "og:description", content: "Mira qué medicamento te toca ahora." },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const hoy = dateKey();
  const { data: profile } = useProfile();
  const { data: medications = [], isLoading: cargandoMeds } = useMedications();
  const { data: schedules = [] } = useSchedules();
  const { data: doses = [] } = useDoses(hoy, hoy);
  const marcar = useMarkTaken();
  const posponer = useSnooze();
  const [mostrarPosponer, setMostrarPosponer] = useState(false);

  const tomasHoy = useMemo(
    () => buildDosesForDate(hoy, medications, schedules, doses),
    [hoy, medications, schedules, doses],
  );
  const proxima = useMemo(() => nextDose(tomasHoy), [tomasHoy]);

  // Recordatorio dentro de la aplicación cuando llega la hora.
  const [avisada, setAvisada] = useState<string | null>(null);
  useEffect(() => {
    if (!proxima) return;
    const revisar = () => {
      if (isDoseDue(proxima) && avisada !== proxima.key) {
        setAvisada(proxima.key);
        toast("Es hora de tu medicamento", {
          description: `💊 ${proxima.medication.name} ${proxima.medication.dosage} · ${formatTime(proxima.time)}`,
          duration: 15000,
        });
      }
    };
    revisar();
    const id = setInterval(revisar, 30000);
    return () => clearInterval(id);
  }, [proxima, avisada]);

  const nombre = profile?.name?.split(" ")[0] ?? "";

  const [sinAvisos, setSinAvisos] = useState(false);
  useEffect(() => {
    suscripcionActual()
      .then((s) => setSinAvisos(!s))
      .catch(() => setSinAvisos(false));
  }, []);

  return (
    <AppShell title="Inicio">
      <h1 className="text-2xl font-bold">Hola{nombre ? `, ${nombre}` : ""} 👋</h1>

      {sinAvisos && (
        <Link
          to="/perfil"
          className="card-surface mt-4 flex min-h-16 items-center gap-3 p-4 text-lg font-semibold"
        >
          🔔 Activa los avisos para que te recordemos aunque la aplicación esté cerrada.
        </Link>
      )}


      <section aria-labelledby="proxima-toma" className="mt-5">
        <h2
          id="proxima-toma"
          className="text-base font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Tu próxima toma
        </h2>

        {proxima ? (
          <div className="card-surface mt-3 p-6">
            <p className="text-4xl font-bold">{formatTime(proxima.time)}</p>
            <p className="mt-2 text-2xl font-semibold">💊 {proxima.medication.name}</p>
            {proxima.medication.dosage ? (
              <p className="text-xl text-muted-foreground">{proxima.medication.dosage}</p>
            ) : null}

            <button
              type="button"
              disabled={marcar.isPending}
              onClick={async () => {
                try {
                  await marcar.mutateAsync(proxima);
                  toast.success("✅ Listo. Toma registrada.");
                  setMostrarPosponer(false);
                } catch {
                  toast.error("No pudimos guardar la toma. Intenta otra vez.");
                }
              }}
              className="mt-6 min-h-20 w-full rounded-2xl bg-primary text-2xl font-bold text-primary-foreground disabled:opacity-60"
            >
              YA LO TOMÉ
            </button>

            <div className="mt-8">
              <button
                type="button"
                onClick={() => setMostrarPosponer((v) => !v)}
                aria-expanded={mostrarPosponer}
                className="min-h-16 w-full rounded-2xl border-2 border-primary text-lg font-semibold text-primary"
              >
                RECORDAR MÁS TARDE
              </button>

              {mostrarPosponer && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    { min: 15, txt: "En 15 minutos" },
                    { min: 30, txt: "En 30 minutos" },
                    { min: 60, txt: "En 1 hora" },
                  ].map(({ min, txt }) => (
                    <button
                      key={min}
                      type="button"
                      onClick={async () => {
                        try {
                          await posponer.mutateAsync({ dose: proxima, minutes: min });
                          setAvisada(null);
                          setMostrarPosponer(false);
                          toast.success(`Te avisamos ${txt.toLowerCase()}.`);
                        } catch {
                          toast.error("No pudimos posponer. Intenta otra vez.");
                        }
                      }}
                      className="min-h-14 rounded-xl bg-accent px-4 text-lg font-semibold text-accent-foreground"
                    >
                      {txt}
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-3 text-base text-muted-foreground">
                Posponer solo cambia este aviso. Tu horario sigue igual.
              </p>
            </div>
          </div>
        ) : (
          <div className="card-surface mt-3 p-6">
            <p className="text-xl font-semibold">
              {cargandoMeds
                ? "Un momento…"
                : medications.length === 0
                  ? "Todavía no tienes medicamentos programados."
                  : "No te queda ninguna toma pendiente hoy. ✅"}
            </p>
            {medications.length === 0 && (
              <>
                <p className="mt-2 text-lg text-muted-foreground">
                  Agrega tu primer medicamento para comenzar.
                </p>
                <Link
                  to="/medicamentos/nuevo"
                  className="mt-5 flex min-h-16 items-center justify-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground"
                >
                  + AGREGAR MEDICAMENTO
                </Link>
              </>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="hoy" className="mt-10">
        <h2 id="hoy" className="text-base font-semibold uppercase tracking-wide text-muted-foreground">
          Medicamentos de hoy
        </h2>
        {tomasHoy.length === 0 ? (
          <p className="card-surface mt-3 p-5 text-lg">Todavía no tienes tomas para hoy.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {tomasHoy.map((d) => (
              <DoseItem key={d.key} dose={d} />
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
