/**
 * Lógica y tipos compartidos de Pastillero Digital.
 * Esta capa NO interpreta ni modifica la dosis escrita por la persona:
 * solo organiza, recuerda y registra.
 */

export const APP_NAME = "Pastillero Digital";
export const APP_TAGLINE = "Tus medicamentos organizados, a la hora correcta.";
export const DISCLAIMER =
  "Pastillero Digital es una herramienta de organización y recordatorio. No sustituye las indicaciones de un profesional de salud.";

export type Medication = {
  id: string;
  user_id: string;
  name: string;
  dosage: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  status: string;
};

export type Schedule = {
  id: string;
  medication_id: string;
  time: string;
  frequency: string;
  days_of_week: number[];
  active: boolean;
};

export type DoseStatus = "pending" | "taken" | "snoozed" | "missed";

export type DoseRow = {
  id: string;
  medication_id: string;
  schedule_id: string | null;
  scheduled_date: string;
  scheduled_time: string;
  taken_at: string | null;
  status: string;
  snoozed_until: string | null;
};

export type PlannedDose = {
  key: string;
  medication: Medication;
  scheduleId: string;
  date: string;
  time: string;
  status: DoseStatus;
  takenAt: string | null;
  snoozedUntil: string | null;
};

/** Fecha local en formato AAAA-MM-DD (sin desfase de zona horaria). */
export function dateKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** "08:00:00" -> "08:00 a. m." */
export function formatTime(time: string): string {
  const [hRaw, m] = time.split(":");
  const h = Number(hRaw);
  const sufijo = h < 12 ? "a. m." : "p. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:${m} ${sufijo}`;
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function formatDayLong(key: string): string {
  const d = parseDateKey(key);
  const hoy = dateKey();
  if (key === hoy) return "Hoy";
  if (key === dateKey(addDays(new Date(), -1))) return "Ayer";
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const ESTADOS: Record<DoseStatus, { icono: string; texto: string }> = {
  taken: { icono: "✅", texto: "Tomado" },
  pending: { icono: "🔔", texto: "Pendiente" },
  snoozed: { icono: "⏰", texto: "Pospuesto" },
  missed: { icono: "⚠️", texto: "No registrada" },
};

function medicationActiveOn(med: Medication, date: string): boolean {
  if (med.status !== "active") return false;
  if (med.start_date && date < med.start_date) return false;
  if (med.end_date && date > med.end_date) return false;
  return true;
}

/**
 * Construye la lista de tomas de un día combinando los horarios programados
 * con los registros ya guardados.
 */
export function buildDosesForDate(
  date: string,
  medications: Medication[],
  schedules: Schedule[],
  doses: DoseRow[],
): PlannedDose[] {
  const dow = parseDateKey(date).getDay();
  const hoy = dateKey();
  const medById = new Map(medications.map((m) => [m.id, m]));
  const result: PlannedDose[] = [];

  for (const s of schedules) {
    if (!s.active) continue;
    const med = medById.get(s.medication_id);
    if (!med || !medicationActiveOn(med, date)) continue;
    if (!s.days_of_week.includes(dow)) continue;

    const row = doses.find(
      (d) => d.medication_id === med.id && d.scheduled_date === date && d.scheduled_time === s.time,
    );
    let status: DoseStatus = (row?.status as DoseStatus) ?? "pending";
    if (status === "pending" && date < hoy) status = "missed";

    result.push({
      key: `${med.id}-${s.time}`,
      medication: med,
      scheduleId: s.id,
      date,
      time: s.time,
      status,
      takenAt: row?.taken_at ?? null,
      snoozedUntil: row?.snoozed_until ?? null,
    });
  }

  // Tomas registradas de medicamentos ya pausados o con horario borrado.
  for (const row of doses) {
    if (row.scheduled_date !== date) continue;
    const med = medById.get(row.medication_id);
    if (!med) continue;
    const key = `${med.id}-${row.scheduled_time}`;
    if (result.some((r) => r.key === key)) continue;
    result.push({
      key,
      medication: med,
      scheduleId: row.schedule_id ?? "",
      date,
      time: row.scheduled_time,
      status: (row.status as DoseStatus) ?? "pending",
      takenAt: row.taken_at,
      snoozedUntil: row.snoozed_until,
    });
  }

  return result.sort((a, b) => a.time.localeCompare(b.time));
}

/** La próxima toma pendiente del día (o la primera pendiente atrasada). */
export function nextDose(doses: PlannedDose[]): PlannedDose | null {
  const pendientes = doses.filter((d) => d.status === "pending" || d.status === "snoozed");
  if (pendientes.length === 0) return null;
  const ahora = new Date();
  const horaActual = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}:00`;
  const atrasadas = pendientes.filter((d) => d.time <= horaActual);
  return atrasadas.length > 0 ? atrasadas[0]! : pendientes[0]!;
}

export function isDoseDue(dose: PlannedDose): boolean {
  const ahora = new Date();
  if (dose.snoozedUntil) return new Date(dose.snoozedUntil) <= ahora;
  const [h, m] = dose.time.split(":").map(Number);
  const programada = parseDateKey(dose.date);
  programada.setHours(h ?? 0, m ?? 0, 0, 0);
  return programada <= ahora;
}
