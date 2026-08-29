import { useEffect } from "react";

const MEASUREMENT_ID = "G-JTWKCV7WWC";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackPageView(path?: string) {
  if (typeof window === "undefined" || !window.gtag) return;
  // Hidden prewarm iframes must not pollute analytics.
  if (window.location.search.includes("prewarm=1")) return;
  const pagePath = path ?? window.location.pathname + window.location.hash;

  window.gtag("event", "page_view", {
    page_path: pagePath,
    page_location: window.location.href,
    page_title: document.title,
  });
}

export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", eventName, params);
}

export function PageTracker() {
  useEffect(() => {
    trackPageView();
    const handler = () => trackPageView();
    window.addEventListener("hashchange", handler);
    window.addEventListener("popstate", handler);
    return () => {
      window.removeEventListener("hashchange", handler);
      window.removeEventListener("popstate", handler);
    };
  }, []);
  return null;
}

export { MEASUREMENT_ID };
