import { useEffect, useState } from "react";
import { Icon } from "./icons";

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
      return;
    }

    // Android/Chrome install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSPrompt(true);
    }
  };

  if (isStandalone || (!deferredPrompt && !isIOS)) {
    return null;
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl bg-white/70 p-4 text-center shadow-sm backdrop-blur-md">
      <div className="flex items-center justify-center gap-3">
        <img
          src="https://res.cloudinary.com/dmxeqe939/image/upload/v1784820761/ChatGPT_Image_23_de_jul._de_2026_12_31_59_nlds50.png"
          alt="Logo"
          className="h-10 w-10 rounded-xl object-cover shadow-md"
        />
        <div className="text-left text-sm text-stone-700">
          <p className="font-semibold">Instale o App</p>
          <p className="text-xs text-stone-500">Acesse direto da tela inicial</p>
        </div>
      </div>
      <button
        onClick={handleInstallClick}
        className="w-full rounded-xl bg-stone-800 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-stone-700"
      >
        Adicionar à Tela Inicial
      </button>

      {showIOSPrompt && (
        <div className="mt-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-800">
          Para instalar no iPhone, toque no botão de Compartilhar <span className="inline-block px-1">⬆️</span> na barra do navegador e depois em <strong>"Adicionar à Tela de Início"</strong>.
        </div>
      )}
    </div>
  );
}
