import type { SupabaseClient } from "@supabase/supabase-js";

export const DATA_POLICY_VERSION = "2026-09-06";
export const TERMS_VERSION = "2026-09-06";
export const LEGAL_AUTHORIZATION_TEXT = "Autorizo de manera previa, expresa e informada a TECNOLOGYC S.A.S. para recolectar, almacenar, usar, circular, transmitir y suprimir mis datos personales con las finalidades descritas en la Política de Tratamiento de Datos de Brilla, y declaro que leí y acepto los Términos de Uso.";

const pendingConsentKey = "brilla-pending-legal-consent-v1";
const pendingConsentLifetimeMs = 2 * 60 * 60 * 1000;

type PendingConsent = {
  dataPolicyVersion: string;
  termsVersion: string;
  initiatedAt: string;
};

type ConsentResult = {
  accepted: boolean;
  error?: string;
};

function readPendingConsent(): PendingConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = JSON.parse(window.localStorage.getItem(pendingConsentKey) ?? "null") as Partial<PendingConsent> | null;
    if (!stored || stored.dataPolicyVersion !== DATA_POLICY_VERSION || stored.termsVersion !== TERMS_VERSION || typeof stored.initiatedAt !== "string") return null;
    const initiatedAt = new Date(stored.initiatedAt).getTime();
    if (!Number.isFinite(initiatedAt) || Date.now() - initiatedAt > pendingConsentLifetimeMs) return null;
    return stored as PendingConsent;
  } catch {
    return null;
  }
}

export function markLegalConsentPending() {
  const pending: PendingConsent = {
    dataPolicyVersion: DATA_POLICY_VERSION,
    termsVersion: TERMS_VERSION,
    initiatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(pendingConsentKey, JSON.stringify(pending));
}

export function clearPendingLegalConsent() {
  if (typeof window !== "undefined") window.localStorage.removeItem(pendingConsentKey);
}

async function currentConsentExists(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("creator_legal_consents")
    .select("id")
    .eq("user_id", userId)
    .eq("data_policy_version", DATA_POLICY_VERSION)
    .eq("terms_version", TERMS_VERSION)
    .maybeSingle();
  return { exists: Boolean(data), error };
}

export async function recordCurrentLegalConsent(
  supabase: SupabaseClient,
  userId: string,
  acceptedVia: "google_oauth" | "authenticated_prompt",
): Promise<ConsentResult> {
  const existing = await currentConsentExists(supabase, userId);
  if (existing.error) return { accepted: false, error: existing.error.message };
  if (existing.exists) {
    clearPendingLegalConsent();
    return { accepted: true };
  }

  const { error } = await supabase.from("creator_legal_consents").insert({
    user_id: userId,
    accepted_via: acceptedVia,
  });
  if (error && error.code !== "23505") return { accepted: false, error: error.message };
  clearPendingLegalConsent();
  return { accepted: true };
}

export async function resolveCurrentLegalConsent(
  supabase: SupabaseClient,
  userId: string,
): Promise<ConsentResult> {
  const existing = await currentConsentExists(supabase, userId);
  if (existing.error) return { accepted: false, error: existing.error.message };
  if (existing.exists) {
    clearPendingLegalConsent();
    return { accepted: true };
  }
  if (!readPendingConsent()) return { accepted: false };
  return recordCurrentLegalConsent(supabase, userId, "google_oauth");
}
