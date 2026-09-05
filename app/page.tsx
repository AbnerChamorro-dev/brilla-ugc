"use client";

/* The landing page intentionally uses plain anchors for section links and primary CTAs. */
/* eslint-disable @next/next/no-html-link-for-pages */

import { useRef, useState } from "react";

const benefits = [
  { icon: "02", title: "Lista en 2 minutos", text: "Rellena tus datos, elige un estilo y deja que Brilla se encargue del diseño." },
  { icon: "▶", title: "Video de verdad", text: "Reels, TikToks y Shorts se reproducen dentro del portafolio, sin sacar a la marca." },
  { icon: "↻", title: "Métricas siempre vivas", text: "Conecta tus redes o actualiza tus cifras al instante, sin rediseñar ni exportar de nuevo." },
  { icon: "◉", title: "Sabes cuándo te ven", text: "Recibe una alerta cuando una marca abre tu portafolio y consulta su actividad." },
];

const comparison = [
  ["Tiempo de creación", "20–45 min diseñando", "2–3 min rellenando"],
  ["Experiencia móvil", "Diseño rígido o PDF", "100% responsiva y nativa"],
  ["Métricas", "Manuales y estáticas", "Actualizables al instante"],
  ["Video UGC", "Pesado o enlace externo", "Reproducción integrada"],
  ["Publicación", "Un único enlace público", "Enlace profesional actualizable"],
  ["Seguimiento", "Sin alertas de lectura", "Avisos de visualización"],
  ["Media kit", "Maquetación manual", "PDF estético en un clic"],
];

const faqs = [
  ["¿Necesito saber diseñar?", "No. Eliges una plantilla, agregas tu contenido y Brilla mantiene todo alineado y bonito por ti."],
  ["¿De verdad es gratis?", "Sí. Crear, publicar y compartir tu portafolio es gratis. No necesitas tarjeta y no hay un límite artificial de prueba."],
  ["¿Los videos pueden verse sin teléfono?", "Claro. Cada video puede mostrarse limpio, dentro de un teléfono o combinar ambos estilos en el mismo portafolio."],
];

export default function Home() {
  const [openFaq, setOpenFaq] = useState(0);
  const [heroVideoPlaying, setHeroVideoPlaying] = useState(false);
  const heroVideoRef = useRef<HTMLVideoElement>(null);

  const toggleHeroVideo = () => {
    const video = heroVideoRef.current;
    if (!video) return;

    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  };

  return (
    <main>
      <nav className="nav shell" aria-label="Navegación principal">
        <a className="brand" href="#inicio" aria-label="Brilla UGC, inicio">brilla<span>•</span></a>
        <div className="navLinks">
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#portafolios">Ejemplos</a>
          <a href="#comparativa">Brilla vs. Canva</a>
        </div>
        <a className="navCta" href="/crear">Crear mi portafolio</a>
      </nav>

      <section className="hero shell" id="inicio">
        <div className="heroCopy">
          <div className="eyebrow"><span>✦</span> Hecho para creadoras UGC, no para diseñadoras</div>
          <h1>Tu portafolio listo<br /><em>antes de tu próximo Reel.</em></h1>
          <p className="heroText">Convierte tu contenido, métricas y tarifas en una web rápida que las marcas sí quieren abrir. Sin diseñar, sin PDF diminuto y 100% gratis.</p>
          <div className="heroActions">
            <a className="primaryButton" href="/crear">Crear gratis en 2 min <span>↗</span></a>
            <a className="textButton" href="#como-funciona"><span className="play">▶</span> Ver cómo funciona</a>
          </div>
          <div className="socialProof">
            <div className="avatars" aria-hidden="true"><span>AM</span><span>LV</span><span>CS</span><span>+</span></div>
            <p><strong>Web + video + métricas + PDF</strong><br />todo en un único enlace profesional</p>
          </div>
        </div>

        <div className="heroVisual" aria-label="Ejemplo de un portafolio UGC con video en un marco de teléfono">
          <div className="spark sparkOne">✦</div><div className="spark sparkTwo">✦</div>
          <div className="noteCard"><span className="noteIcon">♡</span><p><strong>Contenido que conecta</strong><br />Belleza · Lifestyle · Travel</p></div>
          <div className="phoneShadow" />
          <div className="phone heroPhone">
            <div className="phoneTop"><span /></div>
            <div className={`videoScene beautyScene ${heroVideoPlaying ? "isPlaying" : ""}`}>
              <video
                ref={heroVideoRef}
                className="heroVideo"
                src="/ugc-skincare.mp4"
                poster="/ugc-skincare-poster.jpg"
                preload="metadata"
                playsInline
                muted
                loop
                onPlay={() => setHeroVideoPlaying(true)}
                onPause={() => setHeroVideoPlaying(false)}
              />
              <div className="videoShade" />
              <button className="videoPlay" type="button" onClick={toggleHeroVideo} aria-label={heroVideoPlaying ? "Pausar video de muestra" : "Reproducir video de muestra"} aria-pressed={heroVideoPlaying}>
                {heroVideoPlaying ? "Ⅱ" : "▶"}
              </button>
              <div className="videoMeta"><span>Rutina real de skincare</span><span>{heroVideoPlaying ? "EN VIVO" : "TOCA PLAY"}</span></div>
            </div>
            <div className="phoneBar" />
          </div>
          <div className="resultCard"><span className="resultIcon">↗</span><p><strong>+84%</strong><br />más respuestas de marcas</p></div>
        </div>
      </section>

      <section className="marquee" aria-label="Tipos de creadores">
        <div className="marqueeTrack">
          <span className="marqueeGroup">BEAUTY <i>✦</i> LIFESTYLE <i>✦</i> FOOD <i>✦</i> TRAVEL <i>✦</i> FITNESS <i>✦</i> FASHION <i>✦</i></span>
          <span className="marqueeGroup" aria-hidden="true">BEAUTY <i>✦</i> LIFESTYLE <i>✦</i> FOOD <i>✦</i> TRAVEL <i>✦</i> FITNESS <i>✦</i> FASHION <i>✦</i></span>
        </div>
      </section>

      <section className="benefits shell" id="como-funciona">
        <div className="sectionIntro"><span className="kicker">Todo en un solo lugar</span><h2>Tu talento al frente.<br /><em>La parte difícil, resuelta.</em></h2></div>
        <div className="benefitGrid competitiveGrid">
          {benefits.map((item, index) => <article className="benefit" key={item.title}><span className={`benefitIcon tone${index}`}>{item.icon}</span><h3>{item.title}</h3><p>{item.text}</p><span className="stepNumber">0{index + 1}</span></article>)}
        </div>
      </section>

      <section className="comparisonSection" id="comparativa">
        <div className="shell comparisonWrap">
          <div className="comparisonIntro"><span className="kicker light">Brilla vs. Canva</span><h2>Canva te da un lienzo.<br /><em>Brilla te da el portafolio.</em></h2><p>Todo lo que una creadora UGC necesita para presentarse, actualizarse y cerrar campañas, sin tener que aprender a diseñar.</p></div>
          <div className="comparisonTable" role="table" aria-label="Comparación entre Canva gratis y Brilla gratis">
            <div className="comparisonHead" role="row"><strong>Función</strong><span>Canva gratis</span><b>Brilla gratis ✦</b></div>
            {comparison.map(([feature, canva, brilla]) => <div className="comparisonRow" role="row" key={feature}><strong>{feature}</strong><span><i>—</i>{canva}</span><b><i>✓</i>{brilla}</b></div>)}
          </div>
        </div>
      </section>

      <section className="portfolioSection shell" id="portafolios">
        <div className="portfolioHeader"><div><span className="kicker">Diseñado para destacar</span><h2>Portafolios con<br /><em>personalidad.</em></h2></div><p>Empieza con una plantilla y hazla tuya. Cada diseño está pensado para verse impecable en móvil y computador.</p></div>
        <div className="templateGrid">
          <article className="template templateCoral"><div className="templateNav"><b>SOFÍA</b><span>WORK · ABOUT · CONTACT</span></div><div className="templateBody"><p>BEAUTY CREATOR</p><h3>Stories that<br />feel <i>real.</i></h3><div className="miniPhone" aria-label="Vista previa de Reel de skincare"><div className="miniReel scenePink"><span>SKINCARE</span><strong>Rutina glow<br />en 3 pasos</strong><i>▶</i><small>0:24 · REEL</small></div></div></div><span className="templateName">Editorial</span></article>
          <article className="template templateLime"><div className="templateNav"><b>MARA.</b><span>UGC / COLOMBIA</span></div><div className="templateBody"><p>LIFESTYLE + TRAVEL</p><h3>Creo contenido<br /><i>que conecta.</i></h3><div className="miniGallery" aria-label="Vista previa de galería UGC"><span><small>01</small><b>Unboxing</b><i>▶</i></span><span><small>02</small><b>Review</b><i>▶</i></span><span><small>03</small><b>Travel</b><i>▶</i></span></div></div><span className="templateName">Fresh</span></article>
          <article className="template templateInk"><div className="templateNav"><b>LUNA—UGC</b><span>01 02 03</span></div><div className="templateBody"><p>FOOD · FASHION · BEAUTY</p><h3>Ideas que<br /><i>se sienten.</i></h3><div className="miniPhone" aria-label="Vista previa de Reel gastronómico"><div className="miniReel sceneDark"><span>FOOD STORY</span><strong>Probando<br />lo nuevo</strong><i>▶</i><small>0:18 · REEL</small></div></div></div><span className="templateName">Noir</span></article>
        </div>
      </section>

      <section className="stepsSection">
        <div className="shell stepsWrap">
          <div className="sectionIntro centered"><span className="kicker">Así de fácil</span><h2>De cero a publicado<br /><em>en tres pasos.</em></h2></div>
          <div className="stepsLine"><article><span>1</span><h3>Elige tu estilo</h3><p>Selecciona la plantilla que mejor se sienta como tú.</p></article><article><span>2</span><h3>Sube tu contenido</h3><p>Agrega videos, fotos, servicios y formas de contacto.</p></article><article><span>3</span><h3>Comparte tu enlace</h3><p>Publica y empieza a presentarte ante tus marcas soñadas.</p></article></div>
        </div>
      </section>

      <section className="pricing shell" id="precios">
        <div className="pricingCopy"><span className="kicker">Gratis de verdad</span><h2>Tu talento ya cuesta.<br /><em>Tu portafolio no.</em></h2><p>Sin tarjeta, sin prueba de 7 días y sin esconder lo importante detrás de un pago.</p></div>
        <div className="freeCard">
          <div><span className="plan">BRILLA GRATIS</span><div className="price"><strong>$0</strong><span>para siempre</span></div></div>
          <ul><li><span>✓</span><strong>Web responsiva</strong><small>con enlace para compartir</small></li><li><span>✓</span><strong>Contenido completo</strong><small>videos, fotos y tarifas</small></li><li><span>✓</span><strong>Métricas y alertas</strong><small>de cada visualización</small></li><li><span>✓</span><strong>Enlace profesional</strong><small>fácil de compartir y actualizar</small></li><li><span>✓</span><strong>Media kit PDF</strong><small>listo en un clic</small></li></ul>
          <a href="/crear">Crear mi portafolio <span>↗</span></a>
        </div>
      </section>

      <section className="faq shell"><div><span className="kicker">Preguntas frecuentes</span><h2>Lo que necesitas<br /><em>saber.</em></h2></div><div className="faqList">{faqs.map(([question, answer], index) => <article className={openFaq === index ? "open" : ""} key={question}><button onClick={() => setOpenFaq(openFaq === index ? -1 : index)} aria-expanded={openFaq === index}><span>{question}</span><b>{openFaq === index ? "−" : "+"}</b></button>{openFaq === index && <p>{answer}</p>}</article>)}</div></section>

      <section className="finalCta shell"><span className="ctaSpark">✦</span><p>NO ESPERES A SENTIRTE LISTA</p><h2>Tu próxima colaboración<br />empieza con un <em>link.</em></h2><a className="primaryButton lightButton" href="/crear">Crear mi portafolio <span>↗</span></a></section>

      <footer className="footer shell"><a className="brand" href="#inicio">brilla<span>•</span></a><p>Portafolios que hacen brillar tu talento.</p><div><a href="#como-funciona">Cómo funciona</a><a href="#comparativa">Brilla vs. Canva</a><a href="#portafolios">Plantillas</a></div><small>© 2026 Brilla UGC</small></footer>
    </main>
  );
}
