"use client";

import { LegalConsentCheckbox } from "./legal-consent-checkbox";
import styles from "./legal-consent-gate.module.css";

export function LegalConsentGate({
  checked,
  busy,
  error,
  onCheckedChange,
  onAccept,
  onSignOut,
}: {
  checked: boolean;
  busy: boolean;
  error: string;
  onCheckedChange: (checked: boolean) => void;
  onAccept: () => void;
  onSignOut: () => void;
}) {
  return <div className={styles.overlay} role="presentation">
    <section className={styles.card} role="dialog" aria-modal="true" aria-labelledby="legal-consent-title">
      <span className={styles.mark}>§</span>
      <small>PRIVACIDAD Y CONDICIONES</small>
      <h2 id="legal-consent-title">Antes de continuar.</h2>
      <p>Necesitamos registrar tu autorización vigente. Puedes abrir y leer ambos documentos antes de decidir.</p>
      <LegalConsentCheckbox id="authenticated-legal-consent" checked={checked} onChange={onCheckedChange} />
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button className={styles.accept} type="button" onClick={onAccept} disabled={busy || !checked}>{busy ? "Guardando autorización…" : "Autorizar y continuar"}</button>
      <button className={styles.signOut} type="button" onClick={onSignOut} disabled={busy}>No aceptar y cerrar sesión</button>
    </section>
  </div>;
}
