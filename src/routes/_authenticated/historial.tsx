import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DoseItem } from "@/components/DoseItem";
import { useDoses, useMedications, useSchedules } from "@/lib/data";
import { addDays, buildDosesForDate, capitalize, dateKey, formatDayLong } from "@/lib/pastillero";

export const Route = createFileRoute("/_authenticated/historial")({
  head: () => ({
    meta: [
      { title: "Historial de tomas — Pastillero Digital" },
      { name: "description", content: "Mira los últimos días y qué tomas quedaron registradas." },
      { property: "og:title", content: "Historial de tomas — Pastillero Digital" },
      { property: "og:description", content: "Mira qué tomas quedaron registradas." },
    ],
  }),
  component: Historial,
});

function Historial() {
  const hoy = new Date();
  const desde = dateKey(addDays(hoy, -6));
  const hasta = dateKey(hoy);
  const { data: medications = [] } = useMedications();
  const { data: schedules = [] } = useSchedules();
  const { data: doses = [] } = useDoses(desde, hasta);
  const [abierto, setAbierto] = useState<string | null>(null);

  const dias = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => dateKey(addDays(hoy, -i))).map((d) => {
      const tomas = buildDosesForDate(d, medications, schedules, doses);
      const registradas = tomas.filter((t) => t.status === "taken").length;
      return { fecha: d, tomas, registradas, total: tomas.length };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medications, schedules, doses]);

  const hayAlgo = dias.some((d) => d.total > 0);

  return (
    <AppShell title="Historial">
      <h1 className="text-2xl font-bold">Últimos 7 días</h1>

      {!hayAlgo ? (
        <p className="card-surface mt-5 p-6 text-lg">Todavía no tienes tomas registradas.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {dias.map((d) => {
            const completo = d.total > 0 && d.registradas === d.total;
            const icono = d.total === 0 ? "—" : completo ? "✅" : "⚠️";
            const expandido = abierto === d.fecha;
            return (
              <li key={d.fecha} className="card-surface overflow-hidden">
                <button
                  type="button"
                  aria-expanded={expandido}
                  onClick={() => setAbierto(expandido ? null : d.fecha)}
                  className="flex min-h-20 w-full flex-col items-start justify-center gap-1 px-5 py-4 text-left"
                >
                  <span className="text-lg font-semibold">{capitalize(formatDayLong(d.fecha))}</span>
                  <span className="text-base">
                    <span aria-hidden="true">{icono}</span>{" "}
                    {d.total === 0
                      ? "Sin tomas programadas"
                      : `${d.registradas} de ${d.total} tomas registradas`}
                  </span>
                </button>
                {expandido && d.total > 0 && (
                  <ul className="space-y-3 border-t border-border p-4">
                    {d.tomas.map((t) => (
                      <DoseItem key={t.key} dose={t} />
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
