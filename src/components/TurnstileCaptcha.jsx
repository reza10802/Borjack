"use client";

import { useEffect, useRef } from "react";

const SCRIPT_ID = "borjak-cloudflare-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Conditionally mounted Cloudflare Turnstile widget for suspicious login attempts. */
export default function TurnstileCaptcha({ siteKey, onToken, onError }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const callbacksRef = useRef({ onToken, onError });

  useEffect(() => {
    callbacksRef.current = { onToken, onError };
  }, [onToken, onError]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined;

    let active = true;
    let script = document.getElementById(SCRIPT_ID);
    let createdScript = false;

    const renderWidget = () => {
      if (!active || !window.turnstile || !containerRef.current || widgetIdRef.current !== null) return;
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action: "login",
          theme: "auto",
          callback: (token) => callbacksRef.current.onToken?.(token),
          "error-callback": () => {
            callbacksRef.current.onToken?.("");
            callbacksRef.current.onError?.();
          },
          "expired-callback": () => callbacksRef.current.onToken?.(""),
          "timeout-callback": () => callbacksRef.current.onToken?.(""),
        });
      } catch {
        callbacksRef.current.onError?.();
      }
    };
    const handleScriptError = () => callbacksRef.current.onError?.();

    if (window.turnstile) {
      renderWidget();
    } else {
      if (!script) {
        script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        createdScript = true;
      }
      script.addEventListener("load", renderWidget);
      script.addEventListener("error", handleScriptError);
      if (createdScript) document.head.appendChild(script);
    }

    return () => {
      active = false;
      if (script) {
        script.removeEventListener("load", renderWidget);
        script.removeEventListener("error", handleScriptError);
      }
      if (widgetIdRef.current !== null && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* widget may already be gone */ }
      }
      widgetIdRef.current = null;
    };
  }, [siteKey]);

  return <div ref={containerRef} className="flex min-h-[66px] justify-center" aria-label="تأیید امنیتی" />;
}
