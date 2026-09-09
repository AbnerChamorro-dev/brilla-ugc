"use client";

/* The public portfolio keeps a plain external-style link back to Brilla. */
/* eslint-disable @next/next/no-html-link-for-pages */

import {
  PortfolioDeck,
  WebsitePortfolio,
  templateSchemas,
  type BrandAsset,
  type Media,
  type Portfolio,
} from "../crear/page";
import { useEffect, useRef } from "react";
import "./public-portfolio.css";

type AnalyticsTarget = "portfolio" | "email" | "whatsapp" | "instagram" | "tiktok";

const visitorStorageKey = "brilla-anonymous-visitor-v1";
let memoryVisitorToken = "";

function anonymousVisitorToken() {
  if (/^[a-f0-9]{64}$/.test(memoryVisitorToken)) return memoryVisitorToken;
  try {
    const stored = window.localStorage.getItem(visitorStorageKey);
    if (stored && /^[a-f0-9]{64}$/.test(stored)) {
      memoryVisitorToken = stored;
      return stored;
    }
  } catch {
    // A session-only token is enough when the browser blocks local storage.
  }

  const bytes = window.crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  memoryVisitorToken = token;
  try { window.localStorage.setItem(visitorStorageKey, token); } catch { /* Keep the in-memory token. */ }
  return token;
}

function recordAnalyticsEvent(slug: string, event: "view" | "click", target: AnalyticsTarget, preferBeacon = false) {
  const body = JSON.stringify({ slug, visitorToken: anonymousVisitorToken(), event, target });
  if (preferBeacon && navigator.sendBeacon) {
    const accepted = navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
    if (accepted) return;
  }
  void fetch("/api/analytics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export default function PublicPortfolioClient({ slug, data, media, brands }: { slug: string; data: Portfolio; media: Media[]; brands: BrandAsset[] }) {
  const selectedTemplate = data.format === "website" ? data.webTemplate : data.template;
  const schema = templateSchemas[selectedTemplate] ?? templateSchemas.pop;
  const page = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = page.current;
    const trackClick = (event: Event) => {
      const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[data-analytics-target]");
      const target = anchor?.dataset.analyticsTarget as AnalyticsTarget | undefined;
      if (!target || target === "portfolio") return;
      recordAnalyticsEvent(slug, "click", target, true);
    };
    root?.addEventListener("click", trackClick);

    let cameFromEditor = false;
    try {
      const referrer = document.referrer ? new URL(document.referrer) : null;
      cameFromEditor = Boolean(referrer?.origin === window.location.origin && ["/crear", "/cuenta"].some((path) => referrer.pathname.startsWith(path)));
    } catch {
      // An invalid referrer should not prevent an otherwise valid public visit.
    }
    if (!cameFromEditor) recordAnalyticsEvent(slug, "view", "portfolio");
    return () => root?.removeEventListener("click", trackClick);
  }, [slug]);

  return <main ref={page} className={`publicPortfolioPage public-${data.format}`}>
    <a className="publicBrillaBadge" href="/" aria-label="Crear mi portafolio con Brilla">Hecho con <strong>brilla<span>•</span></strong></a>
    {data.format === "presentation"
      ? <PortfolioDeck data={data} media={media} brands={brands} schema={schema} expanded />
      : <WebsitePortfolio data={data} media={media} brands={brands} schema={schema} expanded />}
  </main>;
}
