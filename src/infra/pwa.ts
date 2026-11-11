import { OFFLINE_ART } from "../assets/railway/art";

/** Ready means the application document and every route illustration are cached. */
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
    const stored = await Promise.all(
      ["/index.html", ...OFFLINE_ART].map((url) => caches.match(url)),
    );
    onReady(stored.every(Boolean));
  } catch {
    // Browsers may block service workers or storage. Lessons still work online.
    onReady(false);
  }
}
