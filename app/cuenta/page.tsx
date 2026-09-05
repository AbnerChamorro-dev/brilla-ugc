"use client";

/* Account navigation intentionally uses plain links across authentication redirects. */
/* eslint-disable @next/next/no-html-link-for-pages */

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase";
import "./cuenta.css";

function safeNextPath() {
  if (typeof window === "undefined") return "/crear";
  const candidate = new URLSearchParams(window.location.search).get("next") ?? "/crear";
  return candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : "/crear";
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

function creatorName(user: User) {
  return String(
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.user_metadata?.display_name ??
    user.email?.split("@")[0] ??
    "creadora",
  );
}

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setChecking(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    setBusy(true);
    setError("");
    const next = safeNextPath();
    const { error: authError } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${authRedirectOrigin()}${next}` },
    });

    if (authError) {
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
    setUser(null);
    setBusy(false);
  };

  return <main className="accountPage">
    <section className="accountStory">
      <a className="accountBrand" href="/">brilla<span>•</span></a>
      <div className="accountStoryCopy"><span>✦ TU PORTAFOLIO, SIEMPRE CONTIGO</span><h1>Tu trabajo queda<br /><em>guardado y listo.</em></h1><p>Entra con Google para continuar tu portafolio desde cualquier dispositivo.</p></div>
      <div className="accountProof"><article><b>01</b><span><strong>Un solo acceso</strong><small>Sin otra contraseña que recordar.</small></span></article><article><b>02</b><span><strong>Progreso protegido</strong><small>Tu borrador permanece en este dispositivo.</small></span></article><article><b>03</b><span><strong>Sesión segura</strong><small>Google confirma tu identidad.</small></span></article></div>
      <small className="accountFoot">Brilla UGC · Hecho para creadoras</small>
    </section>

    <section className="accountAccess">
      <div className="accountCard">
        {checking ? <div className="accountLoading"><i />Comprobando tu cuenta…</div> : user ? <>
          <span className="accountKicker">CUENTA ACTIVA</span><h2>Hola, {creatorName(user)}.</h2><p className="accountLead">Tu sesión de Google está conectada. Puedes continuar donde quedaste.</p>
          <div className="accountIdentity"><span>{creatorName(user).slice(0, 1).toUpperCase()}</span><div><strong>{creatorName(user)}</strong><small>{user.email}</small></div><i>✓</i></div>
          <a className="accountPrimary" href={safeNextPath()}>Continuar a mi portafolio <span>→</span></a>
          <button className="accountSignOut" type="button" onClick={signOut} disabled={busy}>Cerrar sesión en este dispositivo</button>
        </> : <>
          <span className="accountKicker">UN ACCESO, CERO COMPLICACIONES</span><h2>Continúa con Google.</h2><p className="accountLead">No necesitas crear otra contraseña. Usaremos tu cuenta de Google únicamente para identificarte y proteger tu portafolio.</p>
          <div className="accountProgressPromise"><span>✓</span><p><strong>No perderás tu progreso</strong><small>Cuando vuelvas, continuarás exactamente donde quedaste.</small></p></div>
          {error && <p className="accountNotice error" role="alert">{error}</p>}
          <button className="googleAccountButton" type="button" onClick={signInWithGoogle} disabled={busy}><b>G</b>{busy ? "Abriendo Google…" : "Continuar con Google"}<span>→</span></button>
          <a className="accountBackLink" href="/crear">Volver al editor</a>
          <p className="accountLegal">Google compartirá con Brilla tu nombre, correo y foto de perfil. No tendremos acceso a tu contraseña.</p>
        </>}
      </div>
    </section>
  </main>;
}
