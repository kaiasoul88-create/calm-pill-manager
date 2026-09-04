import { ESTADOS, formatTime, type PlannedDose } from "@/lib/pastillero";

export function DoseItem({ dose }: { dose: PlannedDose }) {
  const estado = ESTADOS[dose.status];
  const fondo =
    dose.status === "taken"
      ? "bg-success-soft"
      : dose.status === "missed"
        ? "bg-warning-soft"
        : "bg-card";

  return (
    <li className={`card-surface flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 ${fondo}`}>
      <span className="w-28 shrink-0 text-lg font-semibold">{formatTime(dose.time)}</span>
      <span className="flex-1 min-w-40">
        <span className="block text-lg font-semibold">💊 {dose.medication.name}</span>
        {dose.medication.dosage ? (
          <span className="block text-base text-muted-foreground">{dose.medication.dosage}</span>
        ) : null}
      </span>
      <span className="text-base font-semibold">
        <span aria-hidden="true">{estado.icono}</span> {estado.texto}
      </span>
    </li>
  );
}
