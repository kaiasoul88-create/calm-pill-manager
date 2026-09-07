import { getPushPublicKey, removePushSubscription, savePushSubscription } from "@/lib/push.functions";

export type EstadoAviso =
  | "activado"
  | "no-configurado"
  | "no-compatible"
  | "abrir-en-pestana"
  | "sin-permiso";

const SW_URL = "/push-sw.js";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSoportado(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function dentroDeMarco(): boolean {
  return typeof window !== "undefined" && window.top !== window.self;
}

export async function suscripcionActual(): Promise<PushSubscription | null> {
  if (!pushSoportado()) return null;
  const registration = await navigator.serviceWorker.getRegistration(SW_URL);
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

/** Debe llamarse desde un clic de la persona. */
export async function activarAvisos(): Promise<EstadoAviso> {
  if (!pushSoportado()) return "no-compatible";
  if (dentroDeMarco()) return "abrir-en-pestana";

  const { publicKey } = await getPushPublicKey();
  if (!publicKey) return "no-configurado";

  const permiso =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permiso !== "granted") return "sin-permiso";

  const registration = await navigator.serviceWorker.register(SW_URL);
  await navigator.serviceWorker.ready;

  const existente = await registration.pushManager.getSubscription();
  const subscription =
    existente ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
    }));

  const json = subscription.toJSON() as { endpoint?: string; keys?: Record<string, string> };
  await savePushSubscription({
    data: {
      endpoint: json.endpoint ?? subscription.endpoint,
      p256dh: json.keys?.["p256dh"] ?? "",
      auth: json.keys?.["auth"] ?? "",
      userAgent: navigator.userAgent,
    },
  });
  return "activado";
}

export async function desactivarAvisos(): Promise<void> {
  const subscription = await suscripcionActual();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => undefined);
  await removePushSubscription({ data: { endpoint } });
}
