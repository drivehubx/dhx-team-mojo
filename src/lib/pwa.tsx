import { useEffect, useState } from "react";
import { toast } from "sonner";

function isPreviewOrDevHost(): boolean {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1") return true;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  if (h === "lovableproject.com" || h.endsWith(".lovableproject.com")) return true;
  if (h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")) return true;
  if (h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")) return true;
  return false;
}

async function unregisterAll() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => r.unregister()));
}

export function registerPwa() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const url = new URL(window.location.href);
  const inIframe = window.self !== window.top;
  const killed = url.searchParams.get("sw") === "off";

  if (!import.meta.env.PROD || inIframe || isPreviewOrDevHost() || killed) {
    void unregisterAll();
    return;
  }

  window.addEventListener("load", () => {
    let currentReg: ServiceWorkerRegistration | null = null;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        currentReg = reg;

        // Kick off an immediate update check (don't await — must not block rendering).
        reg.update().catch(() => {});

        // If a new SW is already waiting, prompt to update.
        if (reg.waiting) promptUpdate(reg.waiting);

        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              promptUpdate(sw);
            }
          });
        });
      })
      .catch(() => {
        /* ignore registration errors */
      });

    // Check for a new deploy whenever the user returns to the app.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      if (!currentReg) return;
      currentReg.update().catch(() => {});
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}

function promptUpdate(sw: ServiceWorker) {
  toast("New version available", {
    description: "A newer version of DHX Body & Paint is ready.",
    action: {
      label: "Update now",
      onClick: () => sw.postMessage("SKIP_WAITING"),
    },
    duration: Infinity,
  });
}

/**
 * Optional install button hook. Returns { canInstall, install }.
 * Silently unavailable when the browser doesn't fire beforeinstallprompt.
 */
export function useInstallPrompt() {
  const [evt, setEvt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e);
    };
    const installed = () => setEvt(null);
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  return {
    canInstall: !!evt,
    install: async () => {
      if (!evt) return;
      evt.prompt();
      try {
        await evt.userChoice;
      } finally {
        setEvt(null);
      }
    },
  };
}
