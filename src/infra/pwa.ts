/** Ready means the full self-contained production document is cached. */
export async function registerPwa(
  onReady: (ready: boolean) => void = () => undefined,
): Promise<void> {
  onReady(false);
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    // This code runs once at startup, never in updatefound during a live run.
    registration.waiting?.postMessage({ type: "ACTIVATE_ON_LAUNCH" });
    await navigator.serviceWorker.ready;
    const stored = await caches.match("/index.html");
    onReady(Boolean(stored));
  } catch {
    // Browsers may block service workers or storage. Lessons still work online.
    onReady(false);
  }
}
