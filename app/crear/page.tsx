"use client";

import { ChangeEvent, CSSProperties, useEffect, useState } from "react";
import "./crear.css";
import "./showreel.css";
import "./world.css";

type Portfolio = {
  name: string; role: string; bio: string; location: string; niches: string[];
  template: string; accent: string; email: string; instagram: string; services: string[];
};
type Media = { id: number; name: string; type: "video" | "image"; url: string; framed: boolean };

const steps = [
  ["Perfil", "Cuéntanos quién eres", "Esta información será lo primero que verán las marcas."],
  ["Estilo", "Haz que se sienta tuyo", "Elige una dirección visual y personaliza el color principal."],
  ["Contenido", "Muestra tu mejor trabajo", "Sube videos o fotos y decide cuáles llevan marco de teléfono."],
  ["Contacto", "Prepárate para colaborar", "Agrega tus servicios y la forma en que pueden contactarte."],
];
const nicheOptions = ["Beauty", "Lifestyle", "Fashion", "Food", "Travel", "Fitness", "Tech", "Wellness"];
const serviceOptions = ["Video UGC", "Fotografía", "Unboxing", "Testimoniales", "Voice over", "Ads para redes"];
const colors = ["#ee8f72", "#dceb82", "#b88cff", "#71c9b8", "#ffbf69"];
const initial: Portfolio = {
  name: "Sofía Mendoza", role: "Creadora UGC que convierte ideas en historias reales.",
  bio: "Creo contenido cercano, estético y estratégico para marcas que quieren conectar de verdad con su comunidad.",
  location: "Bogotá, Colombia", niches: ["Beauty", "Lifestyle", "Travel"], template: "editorial",
  accent: "#ee8f72", email: "hola@sofiaugc.com", instagram: "@sofia.crea",
  services: ["Video UGC", "Fotografía", "Unboxing"],
};

export default function CreatePortfolio() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Portfolio>(initial);
  const [media, setMedia] = useState<Media[]>([]);
  const [saved, setSaved] = useState(true);
  const [finalView, setFinalView] = useState(false);

  useEffect(() => {
    const draft = window.localStorage.getItem("brilla-portfolio-draft");
    if (draft) { try { setData(JSON.parse(draft)); } catch { /* use initial content */ } }
  }, []);
  useEffect(() => {
    setSaved(false);
    const timer = window.setTimeout(() => {
      window.localStorage.setItem("brilla-portfolio-draft", JSON.stringify(data)); setSaved(true);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [data]);

  const update = (field: keyof Portfolio, value: string | string[]) => setData((current) => ({ ...current, [field]: value }));
  const toggleList = (field: "niches" | "services", value: string) => update(field, data[field].includes(value) ? data[field].filter((item) => item !== value) : [...data[field], value]);
  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const additions = Array.from(event.target.files ?? []).map((file, index): Media => ({
      id: Date.now() + index, name: file.name, type: file.type.startsWith("video") ? "video" : "image",
      url: URL.createObjectURL(file), framed: file.type.startsWith("video"),
    }));
    setMedia((current) => [...current, ...additions]);
  };
  const toggleFrame = (id: number) => setMedia((current) => current.map((item) => item.id === id ? { ...item, framed: !item.framed } : item));
  const remove = (id: number) => setMedia((current) => current.filter((item) => { if (item.id === id) URL.revokeObjectURL(item.url); return item.id !== id; }));
  const themeStyle = { "--builder-accent": data.accent } as CSSProperties;

  if (finalView) return (
    <main className="builderApp finalMode" style={themeStyle}>
      <div className="finalToolbar"><a className="builderBrand" href="/">brilla<span>•</span></a><div className="finalNotice"><span>✓</span> Tu portafolio está listo</div><button onClick={() => setFinalView(false)}>Volver al editor</button></div>
      <div className="publishedShell"><PortfolioPreview data={data} media={media} expanded /></div>
      <div className="draftToast"><span>✦</span><div><strong>Borrador guardado</strong><small>Esta primera versión vive en tu dispositivo.</small></div></div>
    </main>
  );

  return (
    <main className="builderApp" style={themeStyle}>
      <header className="builderTopbar"><a className="builderBrand" href="/">brilla<span>•</span></a><div className="builderStatus"><span className={saved ? "saved" : "saving"} />{saved ? "Borrador guardado" : "Guardando cambios..."}</div><a className="exitBuilder" href="/">Salir del editor</a></header>
      <div className="builderGrid">
        <aside className="builderSidebar">
          <p className="sidebarLabel">TU PORTAFOLIO</p>
          <nav aria-label="Pasos del portafolio">{steps.map((item, index) => <button key={item[0]} className={index === step ? "current" : index < step ? "done" : ""} onClick={() => setStep(index)}><span>{index < step ? "✓" : "0" + (index + 1)}</span><div><small>PASO 0{index + 1}</small><strong>{item[0]}</strong></div></button>)}</nav>
          <div className="sidebarTip"><span>✦</span><p><strong>Tip de Brilla</strong>Los portafolios con 6 a 10 piezas reciben más atención.</p></div>
        </aside>

        <section className="builderFormArea">
          <div className="mobileProgress"><span style={{ width: ((step + 1) * 25) + "%" }} /></div>
          <div className="formHeading"><span>0{step + 1} / 04</span><h1>{steps[step][1]}</h1><p>{steps[step][2]}</p></div>

          {step === 0 && <div className="formPanel">
            <div className="avatarUpload"><span>{data.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>Tu foto de perfil</strong><small>La imagen se habilitará con el almacenamiento.</small></div><b>＋</b></div>
            <Field label="Nombre público" value={data.name} set={(value) => update("name", value)} placeholder="Tu nombre" />
            <Field label="Tu frase principal" value={data.role} set={(value) => update("role", value)} placeholder="¿Qué hace especial tu contenido?" />
            <label className="builderField"><span>Sobre ti <small>{data.bio.length}/220</small></span><textarea maxLength={220} value={data.bio} onChange={(event) => update("bio", event.target.value)} /></label>
            <Field label="Ubicación" value={data.location} set={(value) => update("location", value)} placeholder="Ciudad, País" />
            <Choice title="Tus nichos" options={nicheOptions} selected={data.niches} toggle={(value) => toggleList("niches", value)} />
          </div>}

          {step === 1 && <div className="formPanel">
            <div className="choiceField"><span>Elige una plantilla</span><div className="themeCards">
              <Theme name="Editorial" note="Expresiva y sofisticada" mode="editorial" current={data.template} choose={(value) => update("template", value)} />
              <Theme name="Minimal" note="Limpia y contemporánea" mode="minimal" current={data.template} choose={(value) => update("template", value)} />
              <Theme name="Bold" note="Potente y atrevida" mode="bold" current={data.template} choose={(value) => update("template", value)} />
            </div></div>
            <div className="choiceField colorChoice"><span>Color protagonista</span><div>{colors.map((color) => <button key={color} aria-label={"Elegir color " + color} className={data.accent === color ? "selected" : ""} style={{ background: color }} onClick={() => update("accent", color)} />)}<label><input aria-label="Color personalizado" type="color" value={data.accent} onChange={(event) => update("accent", event.target.value)} />＋</label></div></div>
          </div>}

          {step === 2 && <div className="formPanel">
            <label className="mediaDrop"><input type="file" accept="video/*,image/*" multiple onChange={upload} /><span>↑</span><strong>Arrastra o selecciona tus archivos</strong><small>Videos MP4/MOV o imágenes JPG/PNG</small><b>Seleccionar archivos</b></label>
            {media.length === 0 ? <div className="emptyMedia"><span>◌</span><p><strong>Aún no has subido contenido</strong>La vista previa usa ejemplos para que puedas diseñar primero.</p></div> : <div className="mediaList">{media.map((item) => <article key={item.id}><div className={item.framed ? "mediaThumb phoneThumb" : "mediaThumb"}>{item.type === "video" ? <video src={item.url} muted /> : <img src={item.url} alt="Contenido subido" />}</div><div><strong>{item.name}</strong><small>{item.type === "video" ? "Video" : "Imagen"}</small></div>{item.type === "video" && <button className={item.framed ? "frameSwitch on" : "frameSwitch"} onClick={() => toggleFrame(item.id)}><span /> Teléfono</button>}<button className="removeMedia" onClick={() => remove(item.id)} aria-label="Eliminar archivo">×</button></article>)}</div>}
          </div>}

          {step === 3 && <div className="formPanel">
            <div className="twoFields"><Field label="Correo de contacto" type="email" value={data.email} set={(value) => update("email", value)} placeholder="hola@tucorreo.com" /><Field label="Instagram" value={data.instagram} set={(value) => update("instagram", value)} placeholder="@tuusuario" /></div>
            <Choice title="Servicios que ofreces" options={serviceOptions} selected={data.services} toggle={(value) => toggleList("services", value)} services />
            <div className="readyCard"><span>✦</span><div><strong>Ya casi está</strong><p>Revisa la vista previa y termina tu portafolio. Podrás volver a editarlo cuando quieras.</p></div></div>
          </div>}

          <div className="builderActions"><button className="backButton" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>← Atrás</button>{step < 3 ? <button className="nextButton" onClick={() => setStep(step + 1)}>Continuar <span>→</span></button> : <button className="nextButton finishButton" onClick={() => setFinalView(true)}>Ver mi portafolio <span>↗</span></button>}</div>
        </section>

        <aside className="livePreview"><div className="previewHeader"><div><span>VISTA PREVIA</span><strong>Se actualiza en vivo</strong></div><div className="deviceButtons"><button className="active" aria-label="Vista móvil">▯</button><button aria-label="Vista de computador">▭</button></div></div><PortfolioPreview data={data} media={media} /></aside>
      </div>
    </main>
  );
}

function Field({ label, value, set, placeholder, type = "text" }: { label: string; value: string; set: (value: string) => void; placeholder: string; type?: string }) {
  return <label className="builderField"><span>{label}</span><input type={type} value={value} onChange={(event) => set(event.target.value)} placeholder={placeholder} /></label>;
}
function Choice({ title, options, selected, toggle, services = false }: { title: string; options: string[]; selected: string[]; toggle: (value: string) => void; services?: boolean }) {
  return <div className="choiceField"><span>{title}</span><div className={services ? "serviceGrid" : "chipList"}>{options.map((option) => <button key={option} className={selected.includes(option) ? "selected" : ""} onClick={() => toggle(option)}><i>{selected.includes(option) ? "✓" : "+"}</i>{option}</button>)}</div></div>;
}
function Theme({ name, note, mode, current, choose }: { name: string; note: string; mode: string; current: string; choose: (value: string) => void }) {
  return <button className={current === mode ? "selected" : ""} onClick={() => choose(mode)}><i className={"themePreview " + mode + "Preview"}><b>{mode === "bold" ? "LUNA—UGC" : name[0] + "."}</b><em>{mode === "bold" ? "MAKE IT REAL." : "Stories that feel real."}</em></i><strong>{name}</strong><small>{note}</small></button>;
}
function PortfolioPreview({ data, media, expanded = false }: { data: Portfolio; media: Media[]; expanded?: boolean }) {
  const visible = media.slice(0, 4);
  if (expanded) return <WorldPortfolio data={data} media={media} />;
  const samples = ["SKINCARE", "TRAVEL", "LIFESTYLE", "BEAUTY"];
  return <div className={(expanded ? "portfolioExperience expanded " : "portfolioExperience ") + "portfolioTheme-" + data.template}>
    <header className="experienceTop">
      <strong>{data.name || "Tu nombre"}<i>•</i></strong>
      <nav><span>Selected work</span><span>About</span><a href={"mailto:" + data.email}>Let&apos;s talk ↗</a></nav>
    </header>
    <div className="experienceCanvas">
      <section className="experienceCopy">
        <p className="experienceOverline">UGC CREATOR · {data.location || "TU CIUDAD"}</p>
        <h2><span>Ideas</span><em>que se sienten</em><b>reales.</b></h2>
        <p className="experienceBio">{data.role || data.bio}</p>
        <div className="experienceTags">{data.niches.map((niche) => <span key={niche}>{niche}</span>)}</div>
      </section>
      <section className="showreel" aria-label="Showreel de trabajos. Desliza horizontalmente para explorar.">
        <div className="reelTrack">
          {visible.length ? visible.map((item, index) => <article key={item.id} className={item.framed && item.type === "video" ? "reelCard phoneReel" : "reelCard"}>
            <div className="reelNumber">0{index + 1}</div>{item.framed && item.type === "video" && <i className="reelNotch" />}
            {item.type === "video" ? <video src={item.url} muted playsInline controls={expanded} /> : <img src={item.url} alt="Trabajo UGC" />}
            <div className="reelCaption"><span>{data.niches[index % Math.max(data.niches.length, 1)] || "UGC"}</span><b>Ver proyecto ↗</b></div>
          </article>) : samples.map((sample, index) => <article key={sample} className={index === 1 ? "reelCard phoneReel sampleReel sampleReel" + index : "reelCard sampleReel sampleReel" + index}>
            <div className="reelNumber">0{index + 1}</div>{index === 1 && <i className="reelNotch" />}<span className="sampleOrb" /><div className="sampleTitle">{sample}<small>{index % 2 ? "content diary" : "brand story"}</small></div><span className="reelPlay">▶</span><div className="reelCaption"><span>{sample}</span><b>Ver proyecto ↗</b></div>
          </article>)}
        </div>
      </section>
      <div className="creatorStamp"><span>{data.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><p><strong>Disponible para crear</strong>{data.instagram}</p></div>
    </div>
    <footer className="experienceBottom"><div><i /> Disponible para proyectos</div><span>DESLIZA PARA EXPLORAR <b>→</b></span><a href={"mailto:" + data.email}>Hablemos <b>↗</b></a></footer>
  </div>;
}


function WorldPortfolio({ data, media }: { data: Portfolio; media: Media[] }) {
  const [progress, setProgress] = useState(0);
  const position = progress * 3;
  const scene = Math.min(3, Math.round(position));
  const worldMedia = media.slice(0, 3);
  const layerStyle = (index: number) => {
    const distance = index - position;
    const magnitude = Math.abs(distance);
    return {
      opacity: Math.max(0, 1 - magnitude * 1.25),
      transform: "translate3d(" + (distance * 72) + "%, " + (magnitude * 7) + "%, " + (-magnitude * 420) + "px) scale(" + Math.max(.72, 1 - magnitude * .12) + ")",
      pointerEvents: magnitude < .45 ? "auto" : "none",
    } as CSSProperties;
  };
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    const available = node.scrollHeight - node.clientHeight;
    setProgress(available ? node.scrollTop / available : 0);
  };

  return <div className="worldScroller" onScroll={handleScroll}>
    <div className="worldSticky" style={{ "--world-progress": progress } as CSSProperties}>
      <header className="worldNav"><strong>{data.name}<i>•</i></strong><div><span>UGC CREATOR</span><a href={"mailto:" + data.email}>COLABOREMOS ↗</a></div></header>
      <div className="worldProgress"><span>0{scene + 1}</span><div>{[0, 1, 2, 3].map((item) => <i key={item} className={scene === item ? "active" : ""} />)}</div><span>04</span></div>
      <main className="worldStage">
        <section className="worldLayer studioWorld" style={layerStyle(0)}>
          <div className="worldCopy"><small>01 · BIENVENIDA</small><h1>Entra a mi<br /><em>mundo creativo.</em></h1><p>{data.role}</p><div className="worldTags">{data.niches.map((niche) => <span key={niche}>{niche}</span>)}</div></div>
          <div className="studioDiorama">
            <div className="studioPlatform" /><div className="backWall"><i /><i /><i /></div><div className="studioDesk"><span className="laptop">UGC</span><span className="productBottle" /><span className="coffee" /></div><div className="ringLight"><i>{data.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</i></div><div className="studioPlant"><i /><i /><i /></div>
          </div>
          <div className="floatingNote noteTop">✦ IDEAS QUE CONECTAN</div><div className="floatingNote noteBottom">{data.location}</div>
        </section>

        <section className="worldLayer contentWorld" style={layerStyle(1)}>
          <div className="sceneLabel"><small>02 · SHOWREEL</small><h2>Historias para<br /><em>detener el scroll.</em></h2></div>
          <div className="contentTunnel">
            {(worldMedia.length ? worldMedia : [null, null, null]).map((item, index) => <article key={item?.id ?? index} className={(item?.framed || index === 1) ? "worldScreen worldPhone" : "worldScreen"}>
              {(item?.framed || index === 1) && <i className="worldNotch" />}
              {item ? item.type === "video" ? <video src={item.url} muted playsInline controls /> : <img src={item.url} alt="Trabajo UGC" /> : <div className={"worldSample sampleWorld" + index}><span>{data.niches[index] || ["BEAUTY", "TRAVEL", "LIFESTYLE"][index]}</span><b>0{index + 1}</b><i>▶</i></div>}
            </article>)}
          </div>
          <div className="worldRibbon">CREATIVE DIRECTION ✦ AUTHENTIC STORIES ✦ SOCIAL FIRST ✦</div>
        </section>

        <section className="worldLayer serviceWorld" style={layerStyle(2)}>
          <div className="sceneLabel servicesTitle"><small>03 · LO QUE HAGO</small><h2>Una idea.<br /><em>Muchas formas.</em></h2><p>{data.bio}</p></div>
          <div className="serviceUniverse"><div className="serviceCore">CREA<br /><span>CONMIGO</span></div>{(data.services.length ? data.services : serviceOptions.slice(0, 5)).slice(0, 6).map((service, index) => <span key={service} className={"servicePlanet planet" + index}>{service}</span>)}</div>
          <div className="worldStat"><strong>100%</strong><span>contenido<br />hecho con intención</span></div>
        </section>

        <section className="worldLayer contactWorld" style={layerStyle(3)}>
          <div className="contactGlow" /><div className="contactPlanet"><span>✦</span></div>
          <div className="contactMessage"><small>04 · HAGAMOS ALGO INCREÍBLE</small><h2>Tu marca.<br />Mi mirada.<br /><em>Una historia real.</em></h2><a href={"mailto:" + data.email}>HABLEMOS <span>↗</span></a></div>
          <div className="contactDetails"><span>{data.instagram}</span><span>{data.email}</span><span>{data.location}</span></div>
        </section>
      </main>
      <footer className="worldFooter"><span><i /> DISPONIBLE PARA PROYECTOS</span><div>SCROLL PARA VIAJAR <b>↓</b></div><span>BRILLA WORLD · 2026</span></footer>
    </div>
    <div className="worldScrollSpace" aria-hidden="true" />
  </div>;
}
