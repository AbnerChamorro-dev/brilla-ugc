"use client";

import { ChangeEvent, useEffect, useState } from "react";

const benefits = [
  { icon: "✦", title: "Se ve como tú", text: "Elige colores, tipografías y una plantilla que encaje con tu estilo." },
  { icon: "◉", title: "Videos que venden", text: "Muestra cada pieza en formato limpio o dentro de un teléfono elegante." },
  { icon: "↗", title: "Lista para compartir", text: "Publica en minutos y envía un solo enlace a todas tus marcas favoritas." },
];

const faqs = [
  ["¿Necesito saber diseñar?", "No. Eliges una plantilla, agregas tu contenido y Brilla mantiene todo alineado y bonito por ti."],
  ["¿Puedo usar mi propio dominio?", "Sí, en el plan Pro puedes conectar un dominio personal y quitar la marca de Brilla."],
  ["¿Los videos pueden verse sin teléfono?", "Claro. Cada video puede mostrarse limpio, dentro de un teléfono o combinar ambos estilos en el mismo portafolio."],
];

export default function Home() {
  const [withPhone, setWithPhone] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);

  function loadVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(URL.createObjectURL(file));
  }

  return (
    <main>
      <nav className="nav shell" aria-label="Navegación principal">
        <a className="brand" href="#inicio" aria-label="Brilla UGC, inicio">brilla<span>•</span></a>
        <div className="navLinks">
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#portafolios">Ejemplos</a>
          <a href="#precios">Precios</a>
        </div>
        <a className="navCta" href="/crear">Crear mi portafolio</a>
      </nav>

      <section className="hero shell" id="inicio">
        <div className="heroCopy">
          <div className="eyebrow"><span>✦</span> Tu trabajo merece brillar</div>
          <h1>Tu portafolio UGC.<br /><em>Imposible de ignorar.</em></h1>
          <p className="heroText">Crea una página que se sienta tan auténtica como tu contenido. Sin diseñar, sin complicarte y lista para compartir con tus marcas favoritas.</p>
          <div className="heroActions">
            <a className="primaryButton" href="/crear">Crear gratis <span>↗</span></a>
            <a className="textButton" href="#como-funciona"><span className="play">▶</span> Ver cómo funciona</a>
          </div>
          <div className="socialProof">
            <div className="avatars" aria-hidden="true"><span>AM</span><span>LV</span><span>CS</span><span>+</span></div>
            <p><strong>Más de 2.000 creadoras</strong><br />ya muestran su talento con Brilla</p>
          </div>
        </div>

        <div className="heroVisual" aria-label="Ejemplo de un portafolio UGC con video en un marco de teléfono">
          <div className="spark sparkOne">✦</div><div className="spark sparkTwo">✦</div>
          <div className="noteCard"><span className="noteIcon">♡</span><p><strong>Contenido que conecta</strong><br />Belleza · Lifestyle · Travel</p></div>
          <div className="phoneShadow" />
          <div className="phone heroPhone">
            <div className="phoneTop"><span /></div>
            <div className="videoScene beautyScene">
              <div className="sceneGlow" /><div className="sceneProduct">GLOW<br /><small>serum</small></div>
              <div className="creatorSilhouette"><span className="head" /><span className="body" /></div>
              <button className="videoPlay" aria-label="Reproducir video de muestra">▶</button>
              <div className="videoMeta"><span>Rutina glow de mañana</span><span>0:24</span></div>
            </div>
            <div className="phoneBar" />
          </div>
          <div className="resultCard"><span className="resultIcon">↗</span><p><strong>+84%</strong><br />más respuestas de marcas</p></div>
        </div>
      </section>

      <section className="marquee" aria-label="Tipos de creadores"><div>BEAUTY <span>✦</span> LIFESTYLE <span>✦</span> FOOD <span>✦</span> TRAVEL <span>✦</span> FITNESS <span>✦</span> FASHION <span>✦</span></div></section>

      <section className="benefits shell" id="como-funciona">
        <div className="sectionIntro"><span className="kicker">Todo en un solo lugar</span><h2>Tu talento al frente.<br /><em>La parte difícil, resuelta.</em></h2></div>
        <div className="benefitGrid">
          {benefits.map((item, index) => <article className="benefit" key={item.title}><span className={`benefitIcon tone${index}`}>{item.icon}</span><h3>{item.title}</h3><p>{item.text}</p><span className="stepNumber">0{index + 1}</span></article>)}
        </div>
      </section>

      <section className="studioSection" id="probar">
        <div className="studio shell">
          <div className="studioCopy">
            <span className="kicker light">Tu contenido, a tu manera</span>
            <h2>Un marco de teléfono.<br /><em>Cuando tú quieras.</em></h2>
            <p>Puedes activar o quitar el teléfono en cada video. Sube uno ahora y prueba cómo se verá en tu portafolio.</p>
            <div className="styleToggle" aria-label="Estilo del video">
              <button className={withPhone ? "active" : ""} onClick={() => setWithPhone(true)} aria-pressed={withPhone}>Con teléfono</button>
              <button className={!withPhone ? "active" : ""} onClick={() => setWithPhone(false)} aria-pressed={!withPhone}>Sin teléfono</button>
            </div>
            <label className="uploadButton">Subir video de prueba<input type="file" accept="video/*" onChange={loadVideo} /></label>
            <small>Tu video se previsualiza solo en este dispositivo.</small>
          </div>
          <div className={`previewStage ${withPhone ? "framed" : "frameless"}`}>
            <div className="previewVideoShell">
              {withPhone && <><div className="phoneTop"><span /></div><div className="phoneBar" /></>}
              {videoUrl ? <video className="uploadedVideo" src={videoUrl} controls playsInline /> : <div className="videoScene travelScene"><div className="sun" /><div className="mountain mountainOne" /><div className="mountain mountainTwo" /><div className="travelLabel">Un fin de semana<br /><strong>que sí repetiría</strong></div><span className="demoPlay">▶</span></div>}
            </div>
            <div className="previewBadge"><span>✓</span> Vista previa en vivo</div>
          </div>
        </div>
      </section>

      <section className="portfolioSection shell" id="portafolios">
        <div className="portfolioHeader"><div><span className="kicker">Diseñado para destacar</span><h2>Portafolios con<br /><em>personalidad.</em></h2></div><p>Empieza con una plantilla y hazla tuya. Cada diseño está pensado para verse impecable en móvil y computador.</p></div>
        <div className="templateGrid">
          <article className="template templateCoral"><div className="templateNav"><b>SOFÍA</b><span>WORK · ABOUT · CONTACT</span></div><div className="templateBody"><p>BEAUTY CREATOR</p><h3>Stories that<br />feel <i>real.</i></h3><div className="miniPhone"><div className="miniScene scenePink" /></div></div><span className="templateName">Editorial</span></article>
          <article className="template templateLime"><div className="templateNav"><b>MARA.</b><span>UGC / COLOMBIA</span></div><div className="templateBody"><p>LIFESTYLE + TRAVEL</p><h3>Creo contenido<br /><i>que conecta.</i></h3><div className="miniGallery"><span /><span /><span /></div></div><span className="templateName">Fresh</span></article>
          <article className="template templateInk"><div className="templateNav"><b>LUNA—UGC</b><span>01 02 03</span></div><div className="templateBody"><p>FOOD · FASHION · BEAUTY</p><h3>Ideas que<br /><i>se sienten.</i></h3><div className="miniPhone"><div className="miniScene sceneDark" /></div></div><span className="templateName">Noir</span></article>
        </div>
      </section>

      <section className="stepsSection">
        <div className="shell stepsWrap">
          <div className="sectionIntro centered"><span className="kicker">Así de fácil</span><h2>De cero a publicado<br /><em>en tres pasos.</em></h2></div>
          <div className="stepsLine"><article><span>1</span><h3>Elige tu estilo</h3><p>Selecciona la plantilla que mejor se sienta como tú.</p></article><article><span>2</span><h3>Sube tu contenido</h3><p>Agrega videos, fotos, servicios y formas de contacto.</p></article><article><span>3</span><h3>Comparte tu enlace</h3><p>Publica y empieza a presentarte ante tus marcas soñadas.</p></article></div>
        </div>
      </section>

      <section className="pricing shell" id="precios">
        <div className="pricingCopy"><span className="kicker">Empieza sin riesgo</span><h2>Tu primer portafolio,<br /><em>gratis.</em></h2><p>Crece a Pro cuando necesites más personalización y herramientas para cerrar colaboraciones.</p></div>
        <div className="priceCards">
          <article className="priceCard"><span className="plan">ESENCIAL</span><div className="price"><strong>$0</strong><span>para siempre</span></div><ul><li>✓ 1 portafolio publicado</li><li>✓ 6 videos y 10 fotos</li><li>✓ 3 plantillas esenciales</li><li>✓ Enlace personal Brilla</li></ul><a href="/crear">Empezar gratis</a></article>
          <article className="priceCard featured"><span className="popular">MÁS POPULAR</span><span className="plan">PRO</span><div className="price"><strong>$9</strong><span>USD / mes</span></div><ul><li>✓ Contenido ilimitado</li><li>✓ Todas las plantillas</li><li>✓ Dominio personalizado</li><li>✓ Estadísticas de visitas</li><li>✓ Sin marca de Brilla</li></ul><a href="/crear">Probar Pro gratis <span>↗</span></a></article>
        </div>
      </section>

      <section className="faq shell"><div><span className="kicker">Preguntas frecuentes</span><h2>Lo que necesitas<br /><em>saber.</em></h2></div><div className="faqList">{faqs.map(([question, answer], index) => <article className={openFaq === index ? "open" : ""} key={question}><button onClick={() => setOpenFaq(openFaq === index ? -1 : index)} aria-expanded={openFaq === index}><span>{question}</span><b>{openFaq === index ? "−" : "+"}</b></button>{openFaq === index && <p>{answer}</p>}</article>)}</div></section>

      <section className="finalCta shell"><span className="ctaSpark">✦</span><p>NO ESPERES A SENTIRTE LISTA</p><h2>Tu próxima colaboración<br />empieza con un <em>link.</em></h2><a className="primaryButton lightButton" href="/crear">Crear mi portafolio <span>↗</span></a></section>

      <footer className="footer shell"><a className="brand" href="#inicio">brilla<span>•</span></a><p>Portafolios que hacen brillar tu talento.</p><div><a href="#como-funciona">Cómo funciona</a><a href="#precios">Precios</a><a href="#portafolios">Plantillas</a></div><small>© 2026 Brilla UGC</small></footer>
    </main>
  );
}
