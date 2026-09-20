"use client";

import { useEffect } from "react";

export default function SWRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/serwist/sw.js")
        .then((registration) => {
          console.log(
            "✅ Service Worker registered:",
            registration.scope
          );
        })
        .catch((error) => {
          console.error(
            "❌ Service Worker registration failed:",
            error
          );
        });
    }
  }, []);

  return null;
}