"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { clearPendingLegalConsent, markLegalConsentPending } from "../lib/legal-consent";
import { rememberAuthRedirect } from "../lib/auth-redirect";
import { getSupabaseBrowserClient } from "../lib/supabase";
import { Icon } from "./brilla-icon";
import { LegalConsentCheckbox } from "./legal-consent-checkbox";

function authRedirectOrigin() {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredSiteUrl) {
    try { return new URL(configuredSiteUrl).origin; } catch { /* use the current origin */ }
  }
  return window.location.origin;
}

export function HomeAccountLink() {
  const [signedIn, setSignedIn] = useState(false);
  const [open, setOpen] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user));
      if (session?.user) setOpen(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, busy]);

  const signInWithGoogle = async () => {
    if (!consentChecked) return;
    setBusy(true);
    setError("");
    markLegalConsentPending();
    rememberAuthRedirect("/crear");
    const { error: authError } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${authRedirectOrigin()}/crear` },
    });
    if (authError) {
      clearPendingLegalConsent();
      setError(authError.message.toLowerCase().includes("provider")
        ? "El acceso con Google todavía no está habilitado."
        : "No pudimos abrir Google. Inténtalo nuevamente.");
      setBusy(false);
    }
  };

  if (signedIn) return <Link className="homeAccountLink" href="/crear">Mi portafolio</Link>;

  return <>
    <button className="homeAccountLink" type="button" onClick={() => { setError(""); setOpen(true); }}>Iniciar sesión</button>
    {open && <div className="homeAuthOverlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) setOpen(false);
    }}>
      <section className="homeAuthModal" role="dialog" aria-modal="true" aria-labelledby="home-auth-title">
        <button ref={closeButtonRef} className="homeAuthClose" type="button" onClick={() => setOpen(false)} disabled={busy} aria-label="Cerrar inicio de sesión"><Icon glyph="×" /></button>
        <span className="homeAuthMark"><Icon glyph="✦" /></span>
        <small>TU PORTAFOLIO, SIEMPRE CONTIGO</small>
        <h2 id="home-auth-title">Inicia sesión en Brilla</h2>
        <p>Continúa tu portafolio desde cualquier dispositivo con tu cuenta de Google.</p>
        {error && <p className="homeAuthError" role="alert">{error}</p>}
        <LegalConsentCheckbox id="home-login-legal-consent" checked={consentChecked} onChange={setConsentChecked} />
        <button className="homeGoogleButton" type="button" onClick={() => void signInWithGoogle()} disabled={busy || !consentChecked}>
          <b>G</b>{busy ? "Abriendo Google…" : "Continuar con Google"}<span><Icon glyph="→" /></span>
        </button>
        <button className="homeAuthCancel" type="button" onClick={() => setOpen(false)} disabled={busy}>Ahora no</button>
      </section>
    </div>}
  </>;
}
