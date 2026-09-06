"use client";

import { useEffect } from "react";
import { consumeAuthRedirect } from "../lib/auth-redirect";
import { getSupabaseBrowserClient } from "../lib/supabase";

function hasAuthResponse(hash: string) {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  return params.has("access_token") || params.has("refresh_token") || params.has("error") || params.has("error_description");
}

export function AuthRedirectHandler() {
  useEffect(() => {
    if (!hasAuthResponse(window.location.hash)) return;

    const destination = consumeAuthRedirect(window.location.pathname === "/" ? "/cuenta" : `${window.location.pathname}${window.location.search}`);
    const finishRedirect = () => {
      const currentPath = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(null, "", currentPath);
      if (currentPath !== destination) window.location.replace(destination);
    };

    let active = true;
    void getSupabaseBrowserClient().auth.getSession().then(() => {
      if (!active) return;
      finishRedirect();
    }).catch(() => {
      if (active) finishRedirect();
    });

    return () => { active = false; };
  }, []);

  return null;
}
