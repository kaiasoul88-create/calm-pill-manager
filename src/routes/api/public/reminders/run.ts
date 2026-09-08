import { createFileRoute } from "@tanstack/react-router";

type Subscripcion = { endpoint: string; p256dh: string; auth: string; user_id: string };
type Perfil = { id: string; timezone: string; notification_preferences: { browser?: boolean } | null };
type Med = {
  id: string;
  user_id: string;
  name: string;
  dosage: string;
  start_date: string;
  end_date: string | null;
  status: string;
};
type Horario = {
  medication_id: string;
  user_id: string;
  time: string;
  days_of_week: number[];
  active: boolean;
};

/** Fecha, hora y día de la semana de una persona según su zona horaria. */
function ahoraEnZona(timezone: string) {
  let partes: Intl.DateTimeFormatPart[];
  try {
    partes = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "short",
    }).formatToParts(new Date());
  } catch {
    return ahoraEnZona("UTC");
  }
  const get = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  const dias: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hora = get("hour") === "24" ? "00" : get("hour");
  return {
    fecha: `${get("year")}-${get("month")}-${get("day")}`,
    minutos: Number(hora) * 60 + Number(get("minute")),
    dow: dias[get("weekday")] ?? 0,
  };
}

function formatearHora(time: string): string {
  const [hRaw, m] = time.split(":");
  const h = Number(hRaw);
  const sufijo = h < 12 ? "a. m." : "p. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:${m} ${sufijo}`;
}

export const Route = createFileRoute("/api/public/reminders/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { sendWebPush, hasPushConfig } = await import("@/lib/webpush.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Solo el programador interno puede pedir el envío de avisos.
        const token = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
        const { data: config } = await supabaseAdmin
          .from("app_config")
          .select("value")
          .eq("key", "reminders_token")
          .maybeSingle();
        const esperado = (config as { value?: string } | null)?.value;
        const secretoCron = process.env["LOVABLE_CRON_SECRET"];
        const autorizado =
          !!token && ((!!esperado && token === esperado) || (!!secretoCron && token === secretoCron));
        if (!autorizado) {
          return new Response("Unauthorized", { status: 401 });
        }

        if (!hasPushConfig()) return Response.json({ ok: false, reason: "sin-claves" });



        const { data: subsData } = await supabaseAdmin
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth, user_id");
        const subs = (subsData ?? []) as Subscripcion[];
        if (subs.length === 0) return Response.json({ ok: true, enviados: 0 });

        const userIds = [...new Set(subs.map((s) => s.user_id))];
        const porUsuario = new Map<string, Subscripcion[]>();
        for (const s of subs) porUsuario.set(s.user_id, [...(porUsuario.get(s.user_id) ?? []), s]);

        const [{ data: perfilesData }, { data: medsData }, { data: horariosData }] =
          await Promise.all([
            supabaseAdmin
              .from("profiles")
              .select("id, timezone, notification_preferences")
              .in("id", userIds),
            supabaseAdmin
              .from("medications")
              .select("id, user_id, name, dosage, start_date, end_date, status")
              .in("user_id", userIds)
              .eq("status", "active"),
            supabaseAdmin
              .from("medication_schedules")
              .select("medication_id, user_id, time, days_of_week, active")
              .in("user_id", userIds)
              .eq("active", true),
          ]);

        const perfiles = new Map(
          ((perfilesData ?? []) as Perfil[]).map((p) => [p.id, p] as const),
        );
        const meds = (medsData ?? []) as Med[];
        const horarios = (horariosData ?? []) as Horario[];
        const medPorId = new Map(meds.map((m) => [m.id, m] as const));

        type Pendiente = {
          userId: string;
          medId: string;
          nombre: string;
          dosis: string;
          fecha: string;
          hora: string;
          kind: string;
        };
        const pendientes: Pendiente[] = [];

        for (const userId of userIds) {
          const perfil = perfiles.get(userId);
          if (perfil?.notification_preferences?.browser === false) continue;
          const { fecha, minutos, dow } = ahoraEnZona(perfil?.timezone ?? "UTC");

          for (const h of horarios) {
            if (h.user_id !== userId) continue;
            if (!h.days_of_week?.includes(dow)) continue;
            const med = medPorId.get(h.medication_id);
            if (!med || med.user_id !== userId) continue;
            if (med.start_date && fecha < med.start_date) continue;
            if (med.end_date && fecha > med.end_date) continue;

            const [hh, mm] = h.time.split(":");
            const minutosHorario = Number(hh) * 60 + Number(mm);
            const retraso = minutos - minutosHorario;
            if (retraso < 0 || retraso > 10) continue;

            pendientes.push({
              userId,
              medId: med.id,
              nombre: med.name,
              dosis: med.dosage,
              fecha,
              hora: h.time,
              kind: "original",
            });
          }
        }

        // Tomas pospuestas cuyo nuevo horario ya llegó.
        const ahora = new Date();
        const { data: pospuestasData } = await supabaseAdmin
          .from("doses")
          .select("user_id, medication_id, scheduled_date, scheduled_time, snoozed_until, status")
          .eq("status", "snoozed")
          .in("user_id", userIds)
          .lte("snoozed_until", ahora.toISOString())
          .gte("snoozed_until", new Date(ahora.getTime() - 2 * 60 * 60 * 1000).toISOString());

        for (const row of (pospuestasData ?? []) as {
          user_id: string;
          medication_id: string;
          scheduled_date: string;
          scheduled_time: string;
          snoozed_until: string;
        }[]) {
          const med = medPorId.get(row.medication_id);
          if (!med) continue;
          pendientes.push({
            userId: row.user_id,
            medId: row.medication_id,
            nombre: med.name,
            dosis: med.dosage,
            fecha: row.scheduled_date,
            hora: row.scheduled_time,
            kind: `snooze:${row.snoozed_until}`,
          });
        }

        let enviados = 0;
        for (const p of pendientes) {
          // Si ya la registró como tomada, no molestamos.
          const { data: dosisExistente } = await supabaseAdmin
            .from("doses")
            .select("status")
            .eq("user_id", p.userId)
            .eq("medication_id", p.medId)
            .eq("scheduled_date", p.fecha)
            .eq("scheduled_time", p.hora)
            .maybeSingle();
          const estado = (dosisExistente as { status?: string } | null)?.status;
          if (estado === "taken") continue;
          if (p.kind === "original" && estado === "snoozed") continue;

          // Marca de envío: evita repetir el mismo aviso.
          const { error: yaEnviado } = await supabaseAdmin.from("reminder_sends").insert({
            user_id: p.userId,
            medication_id: p.medId,
            scheduled_date: p.fecha,
            scheduled_time: p.hora,
            kind: p.kind,
          } as never);
          if (yaEnviado) continue;

          const cuerpo = `${p.nombre}${p.dosis ? ` · ${p.dosis}` : ""} · ${formatearHora(p.hora)}`;
          for (const sub of porUsuario.get(p.userId) ?? []) {
            const resultado = await sendWebPush(sub, {
              title: "💊 Es hora de tu medicamento",
              body: cuerpo,
              url: "/inicio",
              tag: `${p.medId}-${p.fecha}-${p.hora}`,
            });
            if (resultado.ok) enviados += 1;
            else if (resultado.gone) {
              await supabaseAdmin
                .from("push_subscriptions")
                .delete()
                .eq("endpoint", sub.endpoint);
            } else {
              await supabaseAdmin
                .from("push_subscriptions")
                .update({ last_error: resultado.error ?? `HTTP ${resultado.status}` } as never)
                .eq("endpoint", sub.endpoint);
            }
          }
        }

        return Response.json({ ok: true, enviados, revisados: pendientes.length });
      },
    },
  },
});
