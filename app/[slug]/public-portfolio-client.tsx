"use client";

import {
  PortfolioDeck,
  WebsitePortfolio,
  templateSchemas,
  type BrandAsset,
  type Media,
  type Portfolio,
} from "../crear/page";
import { portfolioOption, portfolioOptions, portfolioText } from "../crear/portfolio-i18n";
import { useEffect, useRef, useState } from "react";
import "./public-portfolio.css";

type AnalyticsTarget = "portfolio" | "email" | "whatsapp" | "instagram" | "tiktok";

const visitorStorageKey = "brilla-anonymous-visitor-v1";
let memoryVisitorToken = "";

function hasText(value: string) {
  return value.trim().length > 0;
}

function socialLink(network: "instagram" | "tiktok", value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${network}.com/${trimmed.replace(/^@/, "")}`;
}

function whatsappLink(value: string) {
  return `https://wa.me/${value.replace(/\D/g, "")}`;
}

type SheetView = "profile" | "contact" | null;

function PortfolioInformationSheet({ data, view, close }: { data: Portfolio; view: Exclude<SheetView, null>; close: () => void }) {
  const countries = data.topCountries.split("·").map((item) => item.trim()).filter(Boolean);
  const rates = [
    ["Video UGC", data.videoRate],
    [portfolioText(data, "Reel colaborativo", "Collaborative Reel"), data.collabRate],
    [portfolioText(data, "Historia con CTA", "Story with CTA"), data.storyRate],
    [portfolioText(data, "Pack de historias", "Story Pack"), data.storyPackRate],
    [portfolioText(data, "Derechos de pauta / mes", "Paid Usage Rights / month"), data.usageRate],
  ].filter(([, value]) => hasText(value));
  const hasAudience = [data.followers, data.monthlyViews, data.womenAudience, data.topCountries].some(hasText);
  const hasOffer = data.services.length > 0 || data.contentTypes.length > 0 || data.clientTypes.length > 0 || data.includes.length > 0;

  return <div className="portfolioSheetBackdrop" onClick={close}>
    <section className="portfolioSheet" role="dialog" aria-modal="true" aria-labelledby="portfolio-sheet-title" onClick={(event) => event.stopPropagation()}>
      <header className="portfolioSheetHeader">
        <div><small>{portfolioText(data, "FICHA DEL PORTAFOLIO", "PORTFOLIO PROFILE")}</small><h2 id="portfolio-sheet-title">{view === "contact" ? portfolioText(data, "Hablemos", "Let's talk") : data.name}</h2></div>
        <button type="button" onClick={close} aria-label={portfolioText(data, "Cerrar ficha", "Close profile")}>×</button>
      </header>

      <div className="portfolioSheetBody">
        {view === "profile" ? <>
          <section className="sheetIdentity">
            {hasText(data.title) && <strong>{data.title}</strong>}
            {hasText(data.bio) && <p>{data.bio}</p>}
            <div className="sheetFacts">
              {hasText(data.location) && <span><small>{portfolioText(data, "Ubicación", "Location")}</small><b>{data.location}</b></span>}
              {hasText(data.languages) && <span><small>{portfolioText(data, "Idiomas", "Languages")}</small><b>{data.languages}</b></span>}
              {hasText(data.availability) && <span><small>{portfolioText(data, "Disponibilidad", "Availability")}</small><b>{data.availability}</b></span>}
            </div>
            {data.niches.length > 0 && <div className="sheetChips">{data.niches.map((item) => <span key={item}>{portfolioOption(data, item)}</span>)}</div>}
          </section>

          {hasOffer && <section className="sheetSection"><small>{portfolioText(data, "SERVICIOS Y FORMATOS", "SERVICES AND FORMATS")}</small>
            {data.services.length > 0 && <div><b>{portfolioText(data, "Servicios", "Services")}</b><p>{portfolioOptions(data, data.services).join(" · ")}</p></div>}
            {data.contentTypes.length > 0 && <div><b>{portfolioText(data, "Contenido", "Content")}</b><p>{portfolioOptions(data, data.contentTypes).join(" · ")}</p></div>}
            {data.clientTypes.length > 0 && <div><b>{portfolioText(data, "Experiencia", "Experience")}</b><p>{portfolioOptions(data, data.clientTypes).join(" · ")}</p></div>}
            {data.includes.length > 0 && <div><b>{portfolioText(data, "Incluye", "Includes")}</b><p>{portfolioOptions(data, data.includes).join(" · ")}</p></div>}
          </section>}

          {hasAudience && <section className="sheetSection"><small>{portfolioText(data, "AUDIENCIA", "AUDIENCE")}</small><div className="sheetMetrics">
            {hasText(data.followers) && <span><b>{data.followers}</b><small>{portfolioText(data, "Seguidores", "Followers")}</small></span>}
            {hasText(data.monthlyViews) && <span><b>{data.monthlyViews}</b><small>{portfolioText(data, "Vistas / mes", "Views / month")}</small></span>}
            {hasText(data.womenAudience) && <span><b>{data.womenAudience}</b><small>{portfolioText(data, "Audiencia femenina", "Female audience")}</small></span>}
          </div>{countries.length > 0 && <p>{countries.join(" · ")}</p>}</section>}

          {rates.length > 0 && <section className="sheetSection"><small>{portfolioText(data, "TARIFAS", "RATES")}</small><div className="sheetRates">{rates.map(([label, value]) => <span key={label}><b>{label}</b><strong>{value}</strong></span>)}</div></section>}
        </> : <section className="sheetContact">
          <p>{portfolioText(data, "Elige el canal que prefieras para conversar sobre una colaboración.", "Choose your preferred channel to discuss a collaboration.")}</p>
          {hasText(data.whatsapp) && <a className="sheetPrimaryAction" href={whatsappLink(data.whatsapp)} target="_blank" rel="noreferrer" data-analytics-target="whatsapp">WhatsApp <span>↗</span></a>}
          {hasText(data.email) && <a href={`mailto:${data.email.trim()}`} data-analytics-target="email"><b>Email</b><span>{data.email}</span></a>}
          {hasText(data.instagram) && <a href={socialLink("instagram", data.instagram)} target="_blank" rel="noreferrer" data-analytics-target="instagram"><b>Instagram</b><span>{data.instagram}</span></a>}
          {hasText(data.tiktok) && <a href={socialLink("tiktok", data.tiktok)} target="_blank" rel="noreferrer" data-analytics-target="tiktok"><b>TikTok</b><span>{data.tiktok}</span></a>}
          {!hasText(data.whatsapp) && !hasText(data.email) && !hasText(data.instagram) && !hasText(data.tiktok) && <p>{portfolioText(data, "Esta creadora todavía no ha publicado canales de contacto.", "This creator has not published contact channels yet.")}</p>}
        </section>}
      </div>
    </section>
  </div>;
}

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
  const [sheetView, setSheetView] = useState<SheetView>(null);

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

  useEffect(() => {
    if (!sheetView) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSheetView(null); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [sheetView]);

  const goToStart = () => {
    const scrollSurface = page.current?.querySelector<HTMLElement>(".websitePortfolio, .creatorFeed, .portfolioExperiencePage");
    const slideTrack = page.current?.querySelector<HTMLElement>(".deckTrack");
    scrollSurface?.scrollTo({ top: 0, behavior: "smooth" });
    slideTrack?.scrollTo({ left: 0, behavior: "smooth" });
  };

  return <main ref={page} className={`publicPortfolioPage public-${data.format}`}>
    {data.format === "presentation"
      ? <PortfolioDeck data={data} media={media} brands={brands} schema={schema} expanded />
      : <WebsitePortfolio data={data} media={media} brands={brands} schema={schema} expanded />}
    <nav className="portfolioAppDock" aria-label={portfolioText(data, "Navegación del portafolio", "Portfolio navigation")}>
      <button type="button" onClick={goToStart}><span>⌂</span>{portfolioText(data, "Inicio", "Home")}</button>
      <button type="button" onClick={() => setSheetView("profile")}><span>≡</span>{portfolioText(data, "Información", "Profile")}</button>
      <button type="button" onClick={() => setSheetView("contact")}><span>✦</span>{portfolioText(data, "Contacto", "Contact")}</button>
    </nav>
    {sheetView && <PortfolioInformationSheet data={data} view={sheetView} close={() => setSheetView(null)} />}
  </main>;
}
