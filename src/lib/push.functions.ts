import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPushPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env["VAPID_PUBLIC_KEY"] ?? null };
});

type SubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  expirationTime?: string | null;
  serviceWorkerScope?: string;
};

function validateSubscription(input: SubscriptionInput): SubscriptionInput {
  if (!input?.endpoint?.startsWith("https://")) throw new Error("Dispositivo no válido.");
  if (!input.p256dh || !input.auth) throw new Error("Dispositivo no válido.");
  return {
    endpoint: input.endpoint.slice(0, 1000),
    p256dh: input.p256dh.slice(0, 200),
    auth: input.auth.slice(0, 100),
    userAgent: (input.userAgent ?? "").slice(0, 200),
    expirationTime: input.expirationTime ?? null,
    serviceWorkerScope: (input.serviceWorkerScope ?? "").slice(0, 500),
  };
}

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateSubscription)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent ?? null,
        last_seen_at: new Date().toISOString(),
        last_error: null,
        expiration_time: data.expirationTime,
        service_worker_scope: data.serviceWorkerScope || null,
      } as never,
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string }) => ({ endpoint: String(input.endpoint ?? "") }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sendWebPush, hasPushConfig } = await import("@/lib/webpush.server");
    if (!hasPushConfig()) return { sent: 0, total: 0, configured: false };

    const { data, error } = await context.supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");
    if (error) throw new Error(error.message);

    const targets = (data ?? []) as { id: string; endpoint: string; p256dh: string; auth: string }[];
    let sent = 0;
    const results: { ok: boolean; status: number; gone: boolean }[] = [];
    for (const target of targets) {
      const result = await sendWebPush(target, {
        title: "🔔 Prueba de Pastillero Digital",
        body: "Este aviso fue enviado por el servidor, sin depender de una dosis.",
        url: "/inicio",
        tag: "prueba",
      });
      results.push({ ok: result.ok, status: result.status, gone: result.gone });
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("push_delivery_attempts").insert({
        user_id: context.userId,
        push_subscription_id: target.id,
        kind: "test",
        http_status: result.status,
        accepted: result.ok,
        error: result.error ?? null,
      } as never);
      if (result.ok) sent += 1;
      else if (result.gone) {
        await context.supabase.from("push_subscriptions").delete().eq("endpoint", target.endpoint);
      } else {
        await context.supabase
          .from("push_subscriptions")
          .update({ last_error: result.error ?? `HTTP ${result.status}` } as never)
          .eq("endpoint", target.endpoint);
      }
    }
    return { sent, total: targets.length, configured: true, results };
  });
