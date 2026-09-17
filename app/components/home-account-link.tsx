"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";

export function HomeAccountLink() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user));
    });
    return () => subscription.unsubscribe();
  }, []);
  // A normal navigation lets the editor restore the session before showing any fields.
  return <a className="homeAccountLink" href={signedIn ? "/crear" : "/cuenta?next=/crear"}>{signedIn ? "Mi portafolio" : "Iniciar sesión"}</a>;
}
