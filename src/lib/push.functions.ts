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
};

function validateSubscription(input: SubscriptionInput): SubscriptionInput {
  if (!input?.endpoint?.startsWith("https://")) throw new Error("Dispositivo no válido.");
  if (!input.p256dh || !input.auth) throw new Error("Dispositivo no válido.");
  return {
    endpoint: input.endpoint.slice(0, 1000),
    p256dh: input.p256dh.slice(0, 200),
    auth: input.auth.slice(0, 100),
    userAgent: (input.userAgent ?? "").slice(0, 200),
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
      .select("endpoint, p256dh, auth");
    if (error) throw new Error(error.message);

    const targets = (data ?? []) as { endpoint: string; p256dh: string; auth: string }[];
    let sent = 0;
    for (const target of targets) {
      const result = await sendWebPush(target, {
        title: "Aviso de prueba",
        body: "Así te avisaremos cuando llegue la hora de tu medicamento.",
        url: "/inicio",
        tag: "prueba",
      });
      if (result.ok) sent += 1;
      else if (result.gone) {
        await context.supabase.from("push_subscriptions").delete().eq("endpoint", target.endpoint);
      }
    }
    return { sent, total: targets.length, configured: true };
  });
