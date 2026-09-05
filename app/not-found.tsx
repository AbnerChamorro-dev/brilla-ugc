/* The fallback keeps a plain home link so it works without client-side JavaScript. */
/* eslint-disable @next/next/no-html-link-for-pages */

export default function NotFound() {
  return <main style={{ minHeight: "100svh", display: "grid", placeItems: "center", padding: 24, color: "#17132f", background: "#f4f1ff", textAlign: "center" }}>
    <section>
      <a href="/" style={{ font: "700 2rem var(--font-serif)", letterSpacing: "-.06em" }}>brilla<span style={{ color: "#6d4dff" }}>•</span></a>
      <p style={{ margin: "26px 0 8px", color: "#6d4dff", fontSize: ".7rem", fontWeight: 800, letterSpacing: ".12em" }}>PORTAFOLIO NO DISPONIBLE</p>
      <h1 style={{ maxWidth: 650, margin: 0, font: "550 clamp(3rem,8vw,6rem)/.95 var(--font-serif)", letterSpacing: "-.06em" }}>Este enlace todavía no está brillando.</h1>
      <p style={{ maxWidth: 520, margin: "24px auto", color: "#6d6880", lineHeight: 1.6 }}>Puede que el portafolio no exista, esté despublicado o haya cambiado de dirección.</p>
      <a href="/" style={{ display: "inline-block", padding: "13px 18px", borderRadius: 999, color: "#fff", background: "#211a49", fontWeight: 800 }}>Ir a Brilla →</a>
    </section>
  </main>;
}
