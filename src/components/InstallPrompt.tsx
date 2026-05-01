import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "tilstede:install-dismissed";

/**
 * Diskret prompt der spørger brugeren om at tilføje appen til hjemmeskærmen.
 * - Android/desktop Chrome: bruger native beforeinstallprompt
 * - iOS Safari: viser instruktioner (Del → Føj til hjemmeskærm)
 * Vises ikke hvis allerede installeret eller afvist tidligere.
 */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosVis, setIosVis] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    // Standalone tjek
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      setOpen(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS detektion
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua);
    if (isIOS) {
      setIosVis(true);
      // Lille forsinkelse så det ikke popper ind med det samme
      const t = setTimeout(() => setOpen(true), 4000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  };

  const install = async () => {
    if (!evt) return;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    if (outcome === "accepted") localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
    setEvt(null);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-sm fade-in">
      <div className="glass relative rounded-2xl p-4 shadow-card">
        <button
          aria-label="Luk"
          onClick={dismiss}
          className="absolute right-2 top-2 rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <Download className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Tilføj Tilstede til hjemmeskærmen</p>
            {iosVis ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Tryk på <Share className="mx-0.5 inline h-3 w-3" /> Del og vælg{" "}
                <span className="font-medium text-foreground">Føj til hjemmeskærm</span>.
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Få hurtigere adgang og en bedre app-oplevelse.
              </p>
            )}
            {!iosVis && evt && (
              <button
                onClick={install}
                className="mt-3 w-full rounded-xl bg-gradient-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
              >
                Installér app
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
