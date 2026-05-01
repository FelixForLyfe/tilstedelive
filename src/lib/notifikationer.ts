export async function bedOmNotifikationsTilladelse(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return await Notification.requestPermission();
}

export function visNotifikation(titel: string, krop: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(titel, { body: krop, tag: "tilstede-hjem", renotify: true } as NotificationOptions);
  } catch {
    // ignorer
  }
}
