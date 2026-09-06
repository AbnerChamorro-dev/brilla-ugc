import Link from "next/link";
import { LEGAL_AUTHORIZATION_TEXT } from "../lib/legal-consent";
import styles from "./legal-consent-checkbox.module.css";

export function LegalConsentCheckbox({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return <div className={styles.consent}>
    <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    <label htmlFor={id}>
      <span aria-hidden="true">{checked ? "✓" : ""}</span>
      <span>{LEGAL_AUTHORIZATION_TEXT} <Link href="/privacidad" target="_blank" rel="noreferrer">Leer Política de Tratamiento de Datos</Link> y <Link href="/terminos" target="_blank" rel="noreferrer">Términos de Uso</Link>.</span>
    </label>
  </div>;
}
