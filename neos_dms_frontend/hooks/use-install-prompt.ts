"use client";

import * as React from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Captures the browser `beforeinstallprompt` event so the app can offer a
 * custom install button (Chromium/desktop). iOS Safari does not fire this
 * event — handle that case separately with "Add to Home Screen" guidance.
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    React.useState<BeforeInstallPromptEvent | null>(null);

  const isStandalone = React.useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia("(display-mode: standalone)");
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(display-mode: standalone)").matches,
    () => false,
  );

  React.useEffect(() => {
    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => setDeferredPrompt(null);

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const isIOS =
    typeof window !== "undefined" &&
    /iPad|iPhone|iPod/.test(window.navigator.userAgent) &&
    !(window as Window & { MSStream?: unknown }).MSStream;

  const promptToInstall = React.useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return {
    canInstall: !isStandalone && Boolean(deferredPrompt || isIOS),
    canPrompt: Boolean(deferredPrompt),
    isStandalone,
    isIOS,
    promptToInstall,
  };
}
