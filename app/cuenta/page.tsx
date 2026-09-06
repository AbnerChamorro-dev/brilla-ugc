"use client";

/* Account navigation intentionally uses plain links across authentication redirects. */
/* eslint-disable @next/next/no-html-link-for-pages */

import { CSSProperties, useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { LegalConsentCheckbox } from "../components/legal-consent-checkbox";
import { LegalConsentGate } from "../components/legal-consent-gate";
import { rememberAuthRedirect } from "../lib/auth-redirect";
import {
  clearPendingLegalConsent,
  markLegalConsentPending,
  recordCurrentLegalConsent,
  resolveCurrentLegalConsent,
} from "../lib/legal-consent";
import { getSupabaseBrowserClient } from "../lib/supabase";
import "./cuenta.css";

type PortfolioContent = {
  name?: string;
  title?: string;
  bio?: string;
  location?: string;
  niches?: string[];
  format?: "website" | "presentation";
  webTemplate?: string;
  template?: string;
  accent?: string;
  followers?: string;
  monthlyViews?: string;
  videoRate?: string;
  collabRate?: string;
  storyRate?: string;
  email?: string;
  whatsapp?: string;
  instagram?: string;
  portfolioSlug?: string;
};

type CreatorPortfolio = {
  id: string;
  content: PortfolioContent;
  status: "draft" | "published" | "unpublished";
  slug: string | null;
  created_at: string;
  updated_at: string;
};

type PortfolioAnalytics = {
  total_views: number;
  unique_visitors: number;
  views_last_30_days: number;
  last_view_at: string | null;
  clicks: { email: number; whatsapp: number; instagram: number; tiktok: number };
};

type NotificationPreferences = {
  email_digest_enabled: boolean;
  digest_frequency: "daily" | "weekly";
};

type ConfirmAction = "unpublish" | "delete" | null;

const localPortfolioKeys = [
  "brilla-portfolio-draft-v2",
  "brilla-post-auth-step-v1",
  "brilla-pending-cloud-upload-v1",
  "brilla-published-v1",
  "brilla-demo-views",
];

const emptyAnalytics: PortfolioAnalytics = {
  total_views: 0,
  unique_visitors: 0,
  views_last_30_days: 0,
  last_view_at: null,
  clicks: { email: 0, whatsapp: 0, instagram: 0, tiktok: 0 },
};

function normalizedAnalytics(value: unknown): PortfolioAnalytics {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyAnalytics;
  const analytics = value as Partial<PortfolioAnalytics>;
  const clicks = analytics.clicks && typeof analytics.clicks === "object" ? analytics.clicks : emptyAnalytics.clicks;
  return {
    total_views: Number(analytics.total_views) || 0,
    unique_visitors: Number(analytics.unique_visitors) || 0,
    views_last_30_days: Number(analytics.views_last_30_days) || 0,
    last_view_at: typeof analytics.last_view_at === "string" ? analytics.last_view_at : null,
    clicks: {
      email: Number(clicks.email) || 0,
      whatsapp: Number(clicks.whatsapp) || 0,
      instagram: Number(clicks.instagram) || 0,
      tiktok: Number(clicks.tiktok) || 0,
    },
  };
}

function safeNextPath() {
  if (typeof window === "undefined") return "/cuenta";
  const candidate = new URLSearchParams(window.location.search).get("next") ?? "/cuenta";
  return candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : "/cuenta";
}

function authRedirectOrigin() {
  if (typeof window === "undefined") return "";
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredSiteUrl) {
    try {
      return new URL(configuredSiteUrl).origin;
    } catch {
      // Use the current origin when the optional production URL is invalid.
    }
  }
  return window.location.origin;
}

function creatorName(user: User, portfolio?: CreatorPortfolio | null) {
  return String(
    portfolio?.content.name ??
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.user_metadata?.display_name ??
    user.email?.split("@")[0] ??
    "creadora",
  );
}

function formattedDate(value?: string) {
  if (!value) return "Aún no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Aún no disponible";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function clearLocalPortfolio() {
  for (const key of localPortfolioKeys) window.localStorage.removeItem(key);
  try {
    window.indexedDB.deleteDatabase("brilla-assets-v1");
  } catch {
    // Cloud data is already deleted even when local browser storage is unavailable.
  }
}

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [portfolio, setPortfolio] = useState<CreatorPortfolio | null>(null);
  const [mediaCount, setMediaCount] = useState(0);
  const [analytics, setAnalytics] = useState<PortfolioAnalytics>(emptyAnalytics);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({ email_digest_enabled: false, digest_frequency: "weekly" });
  const [notificationPreferencesExist, setNotificationPreferencesExist] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [loginConsentChecked, setLoginConsentChecked] = useState(false);
  const [legalConsentRequired, setLegalConsentRequired] = useState(false);
  const [authenticatedConsentChecked, setAuthenticatedConsentChecked] = useState(false);
  const [legalBusy, setLegalBusy] = useState(false);
  const [legalError, setLegalError] = useState("");

  const loadDashboard = useCallback(async (account: User) => {
    setDashboardLoading(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const [portfolioResult, mediaResult, analyticsResult, preferencesResult] = await Promise.all([
      supabase
        .from("creator_portfolios")
        .select("id,content,status,slug,created_at,updated_at")
        .eq("user_id", account.id)
        .maybeSingle(),
      supabase
        .from("creator_media")
        .select("id", { count: "exact", head: true })
        .eq("user_id", account.id),
      supabase.rpc("get_my_portfolio_analytics"),
      supabase
        .from("creator_notification_preferences")
        .select("email_digest_enabled,digest_frequency")
        .eq("user_id", account.id)
        .maybeSingle(),
    ]);

    if (portfolioResult.error || mediaResult.error || analyticsResult.error || preferencesResult.error) {
      setError("No pudimos cargar tu panel. Tu portafolio sigue seguro; inténtalo nuevamente.");
    } else {
      setPortfolio((portfolioResult.data as CreatorPortfolio | null) ?? null);
      setMediaCount(mediaResult.count ?? 0);
      setAnalytics(normalizedAnalytics(analyticsResult.data));
      const savedPreferences = preferencesResult.data as NotificationPreferences | null;
      setNotificationPreferences(savedPreferences ?? { email_digest_enabled: false, digest_frequency: "weekly" });
      setNotificationPreferencesExist(Boolean(savedPreferences));
    }
    setDashboardLoading(false);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;
    const initialTimer = window.setTimeout(() => {
      if (!active) return;
      setChecking(false);
      setError("La comprobación de tu sesión tardó demasiado. Puedes intentarlo nuevamente.");
    }, 8000);

    const clearAccount = () => {
      setUser(null);
      setChecking(false);
      setLegalConsentRequired(false);
      setPortfolio(null);
      setMediaCount(0);
      setAnalytics(emptyAnalytics);
      setNotificationPreferences({ email_digest_enabled: false, digest_frequency: "weekly" });
      setNotificationPreferencesExist(false);
    };

    const acceptAccount = async (account: User) => {
      setUser(account);
      const consent = await resolveCurrentLegalConsent(supabase, account.id);
      if (!active) return;
      setChecking(false);
      if (!consent.accepted) {
        setLegalConsentRequired(true);
        setLegalError(consent.error ? "No pudimos comprobar tu autorización. Revisa tu conexión e inténtalo nuevamente." : "");
        return;
      }
      setLegalConsentRequired(false);
      setLegalError("");
      void loadDashboard(account);
    };

    void (async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;
      if (sessionError || !sessionData.session) {
        window.clearTimeout(initialTimer);
        clearAccount();
        if (sessionError) setError("No pudimos comprobar tu sesión. Vuelve a iniciar sesión.");
        return;
      }

      const { data, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      window.clearTimeout(initialTimer);
      const account = data.user ?? null;
      if (authError) setError("No pudimos comprobar tu sesión. Vuelve a iniciar sesión.");
      if (account) await acceptAccount(account);
      else clearAccount();
    })().catch(() => {
      if (!active) return;
      window.clearTimeout(initialTimer);
      setChecking(false);
      setError("No pudimos comprobar tu sesión. Vuelve a intentarlo.");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const account = session?.user ?? null;
      if (account) void acceptAccount(account);
      else clearAccount();
    });

    return () => {
      active = false;
      window.clearTimeout(initialTimer);
      listener.subscription.unsubscribe();
    };
  }, [loadDashboard]);

  const signInWithGoogle = async () => {
    if (!loginConsentChecked) {
      setError("Debes autorizar el tratamiento de datos y aceptar los Términos antes de continuar.");
      return;
    }
    setBusy(true);
    setError("");
    markLegalConsentPending();
    const next = safeNextPath();
    rememberAuthRedirect(next);
    const { error: authError } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${authRedirectOrigin()}${next}` },
    });

    if (authError) {
      clearPendingLegalConsent();
      setError(
        authError.message.toLowerCase().includes("provider")
          ? "El acceso con Google todavía no está habilitado."
          : "No pudimos abrir Google. Inténtalo nuevamente.",
      );
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    await getSupabaseBrowserClient().auth.signOut({ scope: "local" });
    clearPendingLegalConsent();
    setUser(null);
    setPortfolio(null);
    setMediaCount(0);
    setAnalytics(emptyAnalytics);
    setNotificationPreferences({ email_digest_enabled: false, digest_frequency: "weekly" });
    setNotificationPreferencesExist(false);
    setLegalConsentRequired(false);
    setAuthenticatedConsentChecked(false);
    setLoginConsentChecked(false);
    setLegalError("");
    setBusy(false);
  };

  const acceptAuthenticatedConsent = async () => {
    if (!user || !authenticatedConsentChecked) return;
    setLegalBusy(true);
    setLegalError("");
    const result = await recordCurrentLegalConsent(getSupabaseBrowserClient(), user.id, "authenticated_prompt");
    if (!result.accepted) {
      setLegalError("No pudimos guardar tu autorización. Revisa tu conexión e inténtalo nuevamente.");
    } else {
      setLegalConsentRequired(false);
      setAuthenticatedConsentChecked(false);
      void loadDashboard(user);
    }
    setLegalBusy(false);
  };

  const saveNotificationPreferences = async (next: NotificationPreferences) => {
    if (!user) return;
    setNotificationBusy(true);
    setError("");
    setSuccess("");
    const supabase = getSupabaseBrowserClient();
    const result = notificationPreferencesExist
      ? await supabase.from("creator_notification_preferences").update(next).eq("user_id", user.id)
      : await supabase.from("creator_notification_preferences").insert({ user_id: user.id, ...next });

    if (result.error) {
      setError("No pudimos guardar tu preferencia de notificaciones. Inténtalo nuevamente.");
    } else {
      setNotificationPreferences(next);
      setNotificationPreferencesExist(true);
      setSuccess("Tu preferencia de actividad quedó guardada.");
    }
    setNotificationBusy(false);
  };

  const copyPublishedLink = async () => {
    if (!portfolio?.slug || portfolio.status !== "published") return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${portfolio.slug}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("No pudimos copiar el enlace. Ábrelo y cópialo desde el navegador.");
    }
  };

  const unpublishPortfolio = async () => {
    if (!user || !portfolio) return;
    setBusy(true);
    setError("");
    setSuccess("");
    const { data, error: updateError } = await getSupabaseBrowserClient()
      .from("creator_portfolios")
      .update({ status: "unpublished" })
      .eq("user_id", user.id)
      .select("id,content,status,slug,created_at,updated_at")
      .single();

    if (updateError) setError("No pudimos despublicar el portafolio. Inténtalo nuevamente.");
    else {
      setPortfolio(data as CreatorPortfolio);
      setSuccess("Tu portafolio ya no está visible públicamente. Puedes editarlo y publicarlo otra vez.");
      setConfirmAction(null);
    }
    setBusy(false);
  };

  const deletePortfolio = async () => {
    if (!user || !portfolio || deleteConfirmation !== "ELIMINAR") return;
    setBusy(true);
    setError("");
    setSuccess("");
    const supabase = getSupabaseBrowserClient();
    const { data: mediaRows, error: mediaReadError } = await supabase
      .from("creator_media")
      .select("storage_path,preview_path")
      .eq("user_id", user.id);

    if (mediaReadError) {
      setError("No pudimos preparar la eliminación de tus archivos. Nada fue eliminado.");
      setBusy(false);
      return;
    }

    const paths = Array.from(new Set((mediaRows ?? []).flatMap((item) => [item.storage_path, item.preview_path]).filter((path): path is string => Boolean(path))));
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from("creator-media").remove(paths);
      if (storageError) {
        setError("No pudimos eliminar todos los archivos. Nada más fue eliminado; inténtalo nuevamente.");
        setBusy(false);
        return;
      }
    }

    const { error: mediaDeleteError } = await supabase.from("creator_media").delete().eq("user_id", user.id);
    if (mediaDeleteError) {
      setError("Los archivos se retiraron, pero no pudimos terminar de eliminar el portafolio.");
      setBusy(false);
      return;
    }

    const { error: portfolioDeleteError } = await supabase.from("creator_portfolios").delete().eq("user_id", user.id);
    if (portfolioDeleteError) {
      setError("No pudimos eliminar el portafolio. Inténtalo nuevamente.");
      setBusy(false);
      return;
    }

    clearLocalPortfolio();
    setPortfolio(null);
    setMediaCount(0);
    setAnalytics(emptyAnalytics);
    setConfirmAction(null);
    setDeleteConfirmation("");
    setSuccess("Tu portafolio y sus archivos fueron eliminados. Tu cuenta de Google continúa activa.");
    setBusy(false);
  };

  if (checking) {
    return <main className="accountLoadingPage"><a className="accountBrand" href="/">brilla<span>•</span></a><div className="accountLoading"><i />Preparando tu espacio…</div></main>;
  }

  if (user && legalConsentRequired) {
    return <main className="accountLoadingPage"><a className="accountBrand" href="/">brilla<span>•</span></a><LegalConsentGate checked={authenticatedConsentChecked} busy={legalBusy} error={legalError} onCheckedChange={setAuthenticatedConsentChecked} onAccept={() => void acceptAuthenticatedConsent()} onSignOut={() => void signOut()} /></main>;
  }

  if (!user) {
    return <main className="accountPage">
      <section className="accountStory">
        <a className="accountBrand" href="/">brilla<span>•</span></a>
        <div className="accountStoryCopy"><span>✦ TU PORTAFOLIO, SIEMPRE CONTIGO</span><h1>Tu trabajo queda<br /><em>guardado y listo.</em></h1><p>Entra con Google para continuar tu portafolio desde cualquier dispositivo.</p></div>
        <div className="accountProof"><article><b>01</b><span><strong>Un solo acceso</strong><small>Sin otra contraseña que recordar.</small></span></article><article><b>02</b><span><strong>Progreso protegido</strong><small>Tu borrador permanece en este dispositivo.</small></span></article><article><b>03</b><span><strong>Sesión segura</strong><small>Google confirma tu identidad.</small></span></article></div>
        <small className="accountFoot">Brilla UGC · Hecho para creadoras</small>
      </section>
      <section className="accountAccess"><div className="accountCard">
        <span className="accountKicker">UN ACCESO, CERO COMPLICACIONES</span><h2>Continúa con Google.</h2><p className="accountLead">No necesitas crear otra contraseña. Usaremos tu cuenta de Google únicamente para identificarte y proteger tu portafolio.</p>
        <div className="accountProgressPromise"><span>✓</span><p><strong>No perderás tu progreso</strong><small>Cuando vuelvas, continuarás exactamente donde quedaste.</small></p></div>
        {error && <p className="accountNotice error" role="alert">{error}</p>}
        <LegalConsentCheckbox id="account-login-legal-consent" checked={loginConsentChecked} onChange={setLoginConsentChecked} />
        <button className="googleAccountButton" type="button" onClick={signInWithGoogle} disabled={busy || !loginConsentChecked}><b>G</b>{busy ? "Abriendo Google…" : "Continuar con Google"}<span>→</span></button>
        <a className="accountBackLink" href="/crear">Volver al editor</a>
        <p className="accountLegal">Google compartirá con Brilla tu nombre, correo y foto de perfil para identificar tu cuenta. No tendremos acceso a tu contraseña.</p>
      </div></section>
    </main>;
  }

  const content = portfolio?.content ?? {};
  const displayName = creatorName(user, portfolio);
  const isPublished = portfolio?.status === "published" && Boolean(portfolio.slug);
  const statusLabel = portfolio?.status === "published" ? "Publicado" : portfolio?.status === "unpublished" ? "Despublicado" : "Borrador";
  const templateLabel = content.format === "presentation" ? `Presentación · ${content.template ?? "Editorial"}` : `Página web · ${content.webTemplate ?? "Muse"}`;
  const completionChecks = portfolio ? [
    Boolean(content.name && content.title && content.bio && content.location),
    mediaCount > 0,
    Boolean(content.followers || content.monthlyViews),
    Boolean(content.videoRate || content.collabRate || content.storyRate),
    Boolean(content.email || content.whatsapp || content.instagram),
    Boolean(portfolio.slug),
  ] : [];
  const completion = completionChecks.length ? Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100) : 0;
  const accentStyle = { "--dashboard-accent": content.accent || "#6d4dff" } as CSSProperties;

  return <main className="creatorDashboard" style={accentStyle}>
    <header className="dashboardTopbar">
      <a className="dashboardBrand" href="/">brilla<span>•</span></a>
      <nav aria-label="Navegación de cuenta"><a href="/crear">Editor</a><span className="dashboardAccountDot">{displayName.slice(0, 1).toUpperCase()}</span><button type="button" onClick={signOut} disabled={busy}>Cerrar sesión</button></nav>
    </header>

    <section className="dashboardShell">
      <div className="dashboardIntro"><div><span>✦ PANEL DE LA CREADORA</span><h1>Hola, {displayName.split(" ")[0]}.<br /><em>Tu trabajo está aquí.</em></h1></div><a className="dashboardCreateButton" href="/crear">Editar portafolio <span>→</span></a></div>

      {(error || success) && <div className={`dashboardNotice ${error ? "error" : "success"}`} role={error ? "alert" : "status"}><span>{error ? "!" : "✓"}</span><p>{error || success}</p><button type="button" aria-label="Cerrar aviso" onClick={() => { setError(""); setSuccess(""); }}>×</button></div>}

      {dashboardLoading ? <div className="dashboardLoadingCard"><div className="accountLoading"><i />Cargando tu portafolio…</div></div> : !portfolio ? <section className="dashboardEmpty">
        <div className="emptySpark">✦</div><span>EMPIEZA CUANDO QUIERAS</span><h2>Tu primer portafolio<br /><em>está a un paso.</em></h2><p>Elige una plantilla, completa tu identidad y Brilla guardará todo en tu cuenta.</p><a href="/crear">Crear mi portafolio <b>→</b></a>
      </section> : <>
        <section className="dashboardGrid">
          <article className="portfolioOverview">
            <div className="portfolioOverviewTop"><span className={`portfolioStatus ${portfolio.status}`}>● {statusLabel}</span><small>{templateLabel}</small></div>
            <div className="portfolioMiniPreview"><span>UGC · {content.location || "TU CIUDAD"}</span><h2>{content.title || "Tu talento merece una presentación increíble."}</h2><p>{content.bio || "Tu historia, tu contenido y tus mejores colaboraciones en un solo lugar."}</p><div><b>{content.name || displayName}</b><small>{portfolio.slug ? `brillaugc.com/${portfolio.slug}` : "Enlace pendiente"}</small></div></div>
            <div className="portfolioActions">
              <a className="primary" href="/crear">Editar <span>↗</span></a>
              {isPublished ? <a href={`/${portfolio.slug}`} target="_blank" rel="noreferrer">Ver publicado <span>↗</span></a> : <a href="/crear">Vista previa <span>↗</span></a>}
              <button type="button" onClick={copyPublishedLink} disabled={!isPublished}>{copied ? "Enlace copiado ✓" : "Copiar enlace"}<span>⌘</span></button>
            </div>
          </article>

          <aside className="completionCard">
            <div className="completionRing" style={{ "--completion": `${completion * 3.6}deg` } as CSSProperties}><span>{completion}%</span></div>
            <span>PERFIL DEL PORTAFOLIO</span><h2>{completion === 100 ? "Todo listo para brillar." : "Completa lo que falta."}</h2><p>Cada detalle ayuda a que una marca entienda rápidamente lo que puedes ofrecer.</p>
            <ul>
              <li className={completionChecks[0] ? "done" : ""}><i>{completionChecks[0] ? "✓" : "1"}</i>Identidad completa</li>
              <li className={completionChecks[1] ? "done" : ""}><i>{completionChecks[1] ? "✓" : "2"}</i>Contenido cargado</li>
              <li className={completionChecks[2] ? "done" : ""}><i>{completionChecks[2] ? "✓" : "3"}</i>Métricas declaradas</li>
              <li className={completionChecks[3] ? "done" : ""}><i>{completionChecks[3] ? "✓" : "4"}</i>Tarifas agregadas</li>
              <li className={completionChecks[4] ? "done" : ""}><i>{completionChecks[4] ? "✓" : "5"}</i>Contacto disponible</li>
              <li className={completionChecks[5] ? "done" : ""}><i>{completionChecks[5] ? "✓" : "6"}</i>Enlace elegido</li>
            </ul>
            <a href="/crear">Continuar completando →</a>
          </aside>
        </section>

        <section className="dashboardStats" aria-label="Resumen del portafolio">
          <article><span>ESTADO</span><strong>{statusLabel}</strong><small>{isPublished ? "Visible para cualquier marca con el enlace" : "Solo tú puedes acceder por ahora"}</small></article>
          <article><span>CONTENIDO</span><strong>{mediaCount}</strong><small>{mediaCount === 1 ? "archivo en tu portafolio" : "archivos en tu portafolio"}</small></article>
          <article><span>ACTUALIZADO</span><strong>{formattedDate(portfolio.updated_at).split(",")[0]}</strong><small>{formattedDate(portfolio.updated_at)}</small></article>
          <article className="analyticsLive"><span>VISITAS REALES</span><strong>{analytics.total_views}</strong><small>{analytics.unique_visitors} {analytics.unique_visitors === 1 ? "visitante aproximado" : "visitantes aproximados"}</small></article>
        </section>

        <section className="analyticsPanel" aria-labelledby="analytics-title">
          <header><div><span>✦ ACTIVIDAD REAL</span><h2 id="analytics-title">Lo que hacen las marcas.</h2><p>Brilla cuenta actividad anónima y evita repetir una misma acción durante 30 minutos.</p></div><div><small>ÚLTIMA VISITA</small><strong>{formattedDate(analytics.last_view_at ?? undefined)}</strong></div></header>
          <div className="analyticsCards">
            <article><span>30 DÍAS</span><strong>{analytics.views_last_30_days}</strong><small>visitas al portafolio</small></article>
            <article><span>CORREO</span><strong>{analytics.clicks.email}</strong><small>clics para escribirte</small></article>
            <article><span>WHATSAPP</span><strong>{analytics.clicks.whatsapp}</strong><small>clics para conversar</small></article>
            <article><span>INSTAGRAM</span><strong>{analytics.clicks.instagram}</strong><small>visitas desde tu enlace</small></article>
            <article><span>TIKTOK</span><strong>{analytics.clicks.tiktok}</strong><small>visitas desde tu enlace</small></article>
          </div>
          <div className="notificationPreferences">
            <div><span>RESUMEN DE ACTIVIDAD</span><h3>Decide cómo quieres recibirlo.</h3><p>Recibirás un resumen solo cuando haya actividad nueva. Los diarios salen cada mañana y los semanales, los lunes.</p></div>
            <div className="notificationControls">
              <label className="notificationToggle"><span><strong>Resumen por correo</strong><small>{notificationPreferences.email_digest_enabled ? "Preferencia activada" : "Preferencia desactivada"}</small></span><input aria-label="Activar resumen de actividad por correo" type="checkbox" checked={notificationPreferences.email_digest_enabled} disabled={notificationBusy} onChange={(event) => void saveNotificationPreferences({ ...notificationPreferences, email_digest_enabled: event.target.checked })} /><i aria-hidden="true" /></label>
              <label className="notificationFrequency"><span>Frecuencia preferida</span><select value={notificationPreferences.digest_frequency} disabled={notificationBusy || !notificationPreferences.email_digest_enabled} onChange={(event) => void saveNotificationPreferences({ ...notificationPreferences, digest_frequency: event.target.value as NotificationPreferences["digest_frequency"] })}><option value="weekly">Semanal</option><option value="daily">Diaria</option></select></label>
            </div>
          </div>
        </section>

        <section className="dashboardManagement">
          <div><span>ADMINISTRAR</span><h2>Tu portafolio, bajo tu control.</h2><p>Las acciones de esta sección modifican la versión guardada en Brilla.</p></div>
          <div className="managementActions">
            {isPublished && <button type="button" onClick={() => { setError(""); setSuccess(""); setConfirmAction("unpublish"); }}>Despublicar <span>Ocultarlo temporalmente</span></button>}
            <button className="danger" type="button" onClick={() => { setError(""); setSuccess(""); setDeleteConfirmation(""); setConfirmAction("delete"); }}>Eliminar portafolio <span>Borrar contenido y archivos</span></button>
          </div>
        </section>
      </>}
    </section>

    {confirmAction && <div className="dashboardModal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setConfirmAction(null); }}><section role="dialog" aria-modal="true" aria-labelledby="dashboard-confirm-title">
      <button className="modalClose" type="button" aria-label="Cerrar" onClick={() => setConfirmAction(null)} disabled={busy}>×</button>
      <span className={confirmAction === "delete" ? "danger" : ""}>{confirmAction === "delete" ? "!" : "↙"}</span>
      <small>{confirmAction === "delete" ? "ACCIÓN PERMANENTE" : "CAMBIO REVERSIBLE"}</small>
      <h2 id="dashboard-confirm-title">{confirmAction === "delete" ? "¿Eliminar tu portafolio?" : "¿Despublicar por ahora?"}</h2>
      <p>{confirmAction === "delete" ? "Se eliminarán el portafolio, las fotos, los videos y las copias guardadas en este dispositivo. Tu cuenta de Google seguirá activa." : "El enlace dejará de funcionar para las marcas, pero conservarás toda la información y podrás publicarlo nuevamente."}</p>
      {confirmAction === "delete" && <label>Escribe <strong>ELIMINAR</strong> para confirmar<input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value.toUpperCase())} autoComplete="off" /></label>}
      <div><button type="button" onClick={() => setConfirmAction(null)} disabled={busy}>Cancelar</button><button className={confirmAction === "delete" ? "danger" : "confirm"} type="button" onClick={confirmAction === "delete" ? deletePortfolio : unpublishPortfolio} disabled={busy || (confirmAction === "delete" && deleteConfirmation !== "ELIMINAR")}>{busy ? "Procesando…" : confirmAction === "delete" ? "Eliminar definitivamente" : "Sí, despublicar"}</button></div>
    </section></div>}
  </main>;
}
