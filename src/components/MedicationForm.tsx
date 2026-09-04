import { useState } from "react";
import type { MedicationInput } from "@/lib/data";
import { dateKey } from "@/lib/pastillero";

const DIAS = [
  { v: 1, label: "Lun" },
  { v: 2, label: "Mar" },
  { v: 3, label: "Mié" },
  { v: 4, label: "Jue" },
  { v: 5, label: "Vie" },
  { v: 6, label: "Sáb" },
  { v: 0, label: "Dom" },
];

const inputClass =
  "mt-2 min-h-14 w-full rounded-xl border-2 border-input bg-background px-4 text-lg";

export function MedicationForm({
  inicial,
  guardando,
  onSubmit,
  textoBoton,
}: {
  inicial?: Partial<MedicationInput>;
  guardando: boolean;
  textoBoton: string;
  onSubmit: (input: MedicationInput) => void;
}) {
  const [name, setName] = useState(inicial?.name ?? "");
  const [dosage, setDosage] = useState(inicial?.dosage ?? "");
  const [description, setDescription] = useState(inicial?.description ?? "");
  const [notes, setNotes] = useState(inicial?.notes ?? "");
  const [startDate, setStartDate] = useState(inicial?.start_date ?? dateKey());
  const [endDate, setEndDate] = useState(inicial?.end_date ?? "");
  const [frequency, setFrequency] = useState(inicial?.frequency ?? "daily");
  const [days, setDays] = useState<number[]>(inicial?.days_of_week ?? [0, 1, 2, 3, 4, 5, 6]);
  const [times, setTimes] = useState<string[]>(
    inicial?.times?.map((t) => t.slice(0, 5)) ?? ["08:00"],
  );
  const [error, setError] = useState("");

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Escribe el nombre del medicamento.");
    if (times.length === 0 || times.some((t) => !t)) return setError("Escribe al menos una hora.");
    if (frequency === "days" && days.length === 0)
      return setError("Elige al menos un día de la semana.");
    setError("");
    onSubmit({
      name,
      dosage,
      description,
      notes,
      start_date: startDate,
      end_date: endDate || null,
      frequency,
      days_of_week: frequency === "daily" ? [0, 1, 2, 3, 4, 5, 6] : days,
      times,
    });
  }

  return (
    <form onSubmit={enviar} className="card-surface mt-6 space-y-6 p-6">
      <div>
        <label htmlFor="name" className="block text-lg font-semibold">
          Nombre del medicamento
        </label>
        <input
          id="name"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          required
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="dosage" className="block text-lg font-semibold">
          Dosis o cantidad
        </label>
        <input
          id="dosage"
          value={dosage}
          maxLength={60}
          placeholder="Por ejemplo: 500 mg"
          onChange={(e) => setDosage(e.target.value)}
          className={inputClass}
        />
        <p className="mt-1 text-base text-muted-foreground">
          Escríbela igual que te la indicó tu médico. Nosotros no la cambiamos.
        </p>
      </div>

      <fieldset>
        <legend className="text-lg font-semibold">Horarios</legend>
        <div className="mt-2 space-y-3">
          {times.map((t, i) => (
            <div key={i} className="flex items-center gap-3">
              <label className="sr-only" htmlFor={`hora-${i}`}>
                Hora {i + 1}
              </label>
              <input
                id={`hora-${i}`}
                type="time"
                value={t}
                required
                onChange={(e) =>
                  setTimes((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)))
                }
                className="min-h-14 flex-1 rounded-xl border-2 border-input bg-background px-4 text-lg"
              />
              {times.length > 1 && (
                <button
                  type="button"
                  onClick={() => setTimes((prev) => prev.filter((_, idx) => idx !== i))}
                  className="min-h-14 rounded-xl border-2 border-input px-4 text-lg font-semibold"
                >
                  Quitar
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setTimes((prev) => [...prev, "20:00"])}
          className="mt-3 min-h-14 w-full rounded-xl bg-accent text-lg font-semibold text-accent-foreground"
        >
          + Agregar otra hora
        </button>
      </fieldset>

      <fieldset>
        <legend className="text-lg font-semibold">Frecuencia</legend>
        <div className="mt-2 space-y-3">
          <label className="flex min-h-14 items-center gap-3 rounded-xl border-2 border-input px-4 text-lg">
            <input
              type="radio"
              name="frecuencia"
              className="size-6"
              checked={frequency === "daily"}
              onChange={() => setFrequency("daily")}
            />
            Todos los días
          </label>
          <label className="flex min-h-14 items-center gap-3 rounded-xl border-2 border-input px-4 text-lg">
            <input
              type="radio"
              name="frecuencia"
              className="size-6"
              checked={frequency === "days"}
              onChange={() => setFrequency("days")}
            />
            Solo algunos días
          </label>
        </div>
        {frequency === "days" && (
          <div className="mt-3 flex flex-wrap gap-2">
            {DIAS.map((d) => {
              const activo = days.includes(d.v);
              return (
                <button
                  key={d.v}
                  type="button"
                  aria-pressed={activo}
                  onClick={() =>
                    setDays((prev) =>
                      prev.includes(d.v) ? prev.filter((x) => x !== d.v) : [...prev, d.v],
                    )
                  }
                  className={`min-h-14 min-w-20 rounded-xl border-2 text-lg font-semibold ${
                    activo
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background"
                  }`}
                >
                  {activo ? "✔ " : ""}
                  {d.label}
                </button>
              );
            })}
          </div>
        )}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="inicio" className="block text-lg font-semibold">
            Fecha de inicio
          </label>
          <input
            id="inicio"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="fin" className="block text-lg font-semibold">
            Fecha de finalización <span className="font-normal">(opcional)</span>
          </label>
          <input
            id="fin"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="descripcion" className="block text-lg font-semibold">
          Presentación <span className="font-normal">(opcional)</span>
        </label>
        <input
          id="descripcion"
          value={description}
          maxLength={100}
          placeholder="Por ejemplo: pastilla blanca"
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="notas" className="block text-lg font-semibold">
          Notas <span className="font-normal">(opcional)</span>
        </label>
        <textarea
          id="notas"
          value={notes}
          maxLength={300}
          rows={3}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-2 w-full rounded-xl border-2 border-input bg-background p-4 text-lg"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-warning-soft p-4 text-lg font-semibold">
          ⚠️ {error}
        </p>
      )}

      <button
        type="submit"
        disabled={guardando}
        className="min-h-20 w-full rounded-2xl bg-primary text-xl font-bold text-primary-foreground disabled:opacity-60"
      >
        {guardando ? "Guardando…" : textoBoton}
      </button>
    </form>
  );
}
