"use client";

/* User media uses local blob URLs and private signed URLs. */
/* eslint-disable @next/next/no-img-element */

import { CSSProperties, useEffect, useState } from "react";
import type { BrandAsset, CaseStudy, Media, Portfolio, TemplateSchema } from "./page";

type ExperienceProps = {
  data: Portfolio;
  media: Media[];
  brands: BrandAsset[];
  schema: TemplateSchema;
  expanded: boolean;
};

function emailLink(value: string) { return `mailto:${value.trim()}`; }
function whatsappLink(value: string) { return `https://wa.me/${value.replace(/\D/g, "")}`; }
function socialLink(network: "instagram" | "tiktok", value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${network}.com/${trimmed.replace(/^@/, "")}`;
}
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "UGC"; }
function visibleWork(data: Portfolio, media: Media[]) { return media.filter((item) => data.portfolioCategories.includes(item.category)); }
function categoryGroups(data: Portfolio, media: Media[], schema: TemplateSchema) {
  const work = visibleWork(data, media);
  return data.portfolioCategories.map((category) => ({
    category,
    items: work.filter((item) => item.category === category).slice(0, category === "Fotografía" ? schema.photoLimit : schema.categoryLimit),
  })).filter((group) => group.items.length);
}
function servicePrice(data: Portfolio, service: string) {
  const normalized = service.toLowerCase();
  if (normalized.includes("reel")) return data.collabRate;
  if (normalized.includes("pack") && normalized.includes("historia")) return data.storyPackRate;
  if (normalized.includes("historia")) return data.storyRate;
  if (normalized.includes("pauta") || normalized.includes("ads")) return data.usageRate;
  if (normalized.includes("video")) return data.videoRate;
  return "Cotización personalizada";
}

function ExperienceMedia({ item, label, ambient = false, priority = false }: { item: Media | null; label: string; ambient?: boolean; priority?: boolean }) {
  return <div className={`experienceMedia ${item?.type === "video" ? "isVideo" : "isImage"}`}>
    {item ? item.type === "video"
      ? <video src={item.url} poster={item.previewUrl} muted playsInline controls={!ambient} autoPlay={ambient} loop={ambient} preload={ambient ? "auto" : "metadata"} aria-label={`Video UGC de ${label}`} />
      : <img src={item.url} alt={`Pieza UGC de ${label}`} loading={priority ? "eager" : "lazy"} />
      : <div className="experiencePlaceholder"><span>{label}</span><b>UGC</b><i>▶</i></div>}
    {item && (item.instagram || item.tiktok) && <div className="experienceSocials">{item.instagram && <a href={item.instagram} target="_blank" rel="noreferrer" aria-label="Ver pieza en Instagram" data-analytics-target="instagram">IG</a>}{item.tiktok && <a href={item.tiktok} target="_blank" rel="noreferrer" aria-label="Ver pieza en TikTok" data-analytics-target="tiktok">TK</a>}</div>}
  </div>;
}

const emptyCase: CaseStudy = { client: "", brief: "", hook: "", result: "", testimonial: "" };

export function CreatorFeedPortfolio({ data, media, brands, schema, expanded }: ExperienceProps) {
  const portrait = media.find((item) => item.category === "__portrait") ?? null;
  const work = visibleWork(data, media);
  const pinned = Array.from({ length: 3 }, (_, index) => work[index] ?? null);
  const pinnedIds = new Set(pinned.flatMap((item) => item ? [item.id] : []));
  const groups = categoryGroups(data, media.filter((item) => !pinnedIds.has(item.id)), schema);
  const countries = data.topCountries.split("·").map((item) => item.trim()).filter(Boolean);
  const handle = data.instagram.trim() || data.tiktok.trim() || `@${data.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
  return <div className={`creatorFeed font-${data.fontStyle} ${expanded ? "expanded" : "compact"}`} style={{ "--site-accent": data.accent, "--experience-accent": data.accent } as CSSProperties}>
    <header className="feedNav"><a className="feedIdentity" href="#feed-top"><span className="feedAvatar">{initials(data.name)}</span><span><strong>{data.name}</strong><small>UGC creator · {data.location}</small></span></a><nav><a href="#feed-work">Contenido</a><a href="#feed-story">Sobre mí</a><a href="#feed-services">Servicios</a></nav><a className="feedNavCta" href={emailLink(data.email)} data-analytics-target="email">Trabajemos ↗</a></header>
    <section className="feedHero" id="feed-top"><div className="feedHeroCopy"><span className="feedStatus"><i />{data.availability}</span><h1><span>Contenido que</span><em>se siente real.</em></h1><p className="feedHeroLead">{data.bio}</p><div className="feedHeroTags">{data.niches.map((niche) => <span key={niche}>#{niche.toLowerCase()}</span>)}</div><div className="feedHeroActions"><a href="#feed-work">Ver mis elegidos ↓</a><div className="feedSocialLinks"><a href={socialLink("instagram", data.instagram)} data-analytics-target="instagram">IG</a><a href={socialLink("tiktok", data.tiktok)} data-analytics-target="tiktok">TK</a></div></div></div><div className="feedProfileVisual"><div className="feedPhone"><ExperienceMedia item={portrait} label="Retrato principal" priority /></div><div className="feedProfileBadge"><span>✦</span><div><b>{handle}</b><small>{data.title}</small></div></div></div></section>
    <section className="feedPinned feedSection" id="feed-work"><div className="feedSectionHeader"><div><small className="feedKicker">MIS FIJADOS</small><h2>Tres piezas para conocer mi estilo.</h2></div><p>Ideas de marca convertidas en contenido que la gente sí quiere ver.</p></div><div className="feedPinnedGrid">{pinned.map((item, index) => <article className="feedPost" key={item?.id ?? `feed-${index}`}><span className="feedPinLabel">✦ FIJADO</span><div className="feedPinnedMedia"><ExperienceMedia item={item} label={item?.category ?? data.niches[index] ?? "UGC"} /></div><div className="feedPostMeta"><strong>{item?.category ?? "Tu próxima pieza"}</strong><small>{data.contentTypes[index % Math.max(1, data.contentTypes.length)] ?? "Contenido UGC"}</small><span>▶</span></div></article>)}</div></section>
    <section className="feedStory feedSection" id="feed-story"><div className="feedStoryCopy"><span className="feedStoryLabel">MI MANERA DE CREAR</span><h2>No hago anuncios. <em>Creo recomendaciones.</em></h2><p>{data.bio}</p></div><div className="feedStoryPanel"><small>FORMATOS QUE DISFRUTO</small><div className="feedFormats">{data.contentTypes.map((type) => <span key={type}>{type}</span>)}</div><div className="feedMicroMetrics"><span><b>{data.followers}</b>seguidores</span><span><b>{data.monthlyViews}</b>vistas / mes</span><span><b>{data.womenAudience}</b>mujeres</span></div></div></section>
    {groups.length > 0 && <section className="feedLibrary feedSection">{groups.map((group) => <article className="feedLibraryGroup" key={group.category}><header><h3>{group.category}</h3><span>{String(group.items.length).padStart(2, "0")} PIEZAS</span></header><div className="feedLibraryRow" style={{ "--feed-count": Math.min(group.items.length, 4) } as CSSProperties}>{group.items.map((item) => <div className="feedLibraryMedia" key={item.id}><ExperienceMedia item={item} label={group.category} /></div>)}</div></article>)}</section>}
    {brands.length > 0 && <section className="feedBrands feedSection"><small className="feedKicker">HAN CONFIADO EN MI MIRADA</small><h2>Marcas con las que he creado.</h2><div className="feedBrandRail">{brands.map((brand) => <article key={brand.id}><img src={brand.url} alt={`Logo de ${brand.name}`} /><span>{brand.name}</span></article>)}</div></section>}
    <section className="feedCollab feedSection" id="feed-services"><div><small className="feedKicker">TRABAJEMOS JUNTAS</small><h2>Un menú de contenido hecho para tu marca.</h2><div className="feedServiceList">{data.services.map((service, index) => <div className="feedServiceRow" key={service}><span>{String(index + 1).padStart(2, "0")}</span><strong>{service}</strong><small>{servicePrice(data, service)}</small></div>)}</div></div><aside className="feedAudienceCard"><small>MI COMUNIDAD</small><h3>Personas reales conectando con historias reales.</h3><div className="feedAudienceHero"><b>{data.womenAudience}</b><span>audiencia femenina</span></div><div className="feedCountryList">{countries.map((country) => <p key={country}><span>{country}</span></p>)}</div></aside></section>
    <section className="feedContact"><small className="feedKicker">¿TIENES UNA IDEA?</small><h2>Hagamos contenido que no parezca publicidad.</h2><p>{data.availability}</p><a className="feedContactButton" href={emailLink(data.email)} data-analytics-target="email">Empecemos un proyecto <span>↗</span></a></section>
    <footer className="feedFooter"><strong>{data.name} · UGC Creator</strong><span>{data.location}</span><span>Hecho para conectar.</span></footer>
  </div>;
}

export function PostcardJournalPortfolio({ data, media, brands, schema, expanded }: ExperienceProps) {
  const portrait = media.find((item) => item.category === "__portrait") ?? null;
  const work = visibleWork(data, media).slice(0, Math.max(6, schema.categoryLimit * 2));
  const countries = data.topCountries.split("·").map((item) => item.trim()).filter(Boolean);
  const cards = work.length ? work : [null, null, null, null, null, null];
  return <div className={`portfolioExperiencePage postcardJournal font-${data.fontStyle} ${expanded ? "expanded" : "compact"}`} style={{ "--experience-accent": data.accent } as CSSProperties}>
    <header className="pcNav"><a href="#pc-top"><b>{data.name}</b><span>FIELD NOTES / UGC</span></a><nav><a href="#pc-stops">Paradas</a><a href="#pc-kit">Kit creativo</a><a href={emailLink(data.email)} data-analytics-target="email">Enviar postal ↗</a></nav></header>
    <section className="pcHero" id="pc-top"><div className="pcHeroCopy"><span>DESPACHOS DESDE {data.location.toUpperCase()}</span><h1>Historias para marcas<br /><em>con ganas de viajar.</em></h1><p>{data.title}</p><div>{data.niches.map((niche) => <b key={niche}>{niche}</b>)}</div></div><div className="pcHeroPostcard"><div><ExperienceMedia item={portrait} label="Retrato de creadora" priority /></div><span className="pcStamp">UGC<br />AIR MAIL</span><small>{data.location}<br />{data.availability}</small></div></section>
    <div className="pcRoute">{[...data.niches, ...data.contentTypes].slice(0, 6).map((item, index) => <span key={`${item}-${index}`}><i>{index + 1}</i>{item}</span>)}</div>
    <section className="pcIntro"><small>NOTA DE LA CREADORA</small><h2>Recolecto momentos cotidianos y los convierto en lugares donde una marca quiere estar.</h2><p>{data.creativeDiary || data.bio}</p></section>
    <section className="pcStops" id="pc-stops"><header><span>CAMERA ROLL / {String(cards.length).padStart(2, "0")}</span><h2>Paradas recientes.</h2><p>{data.campaignTitle}</p></header><div className="pcWall">{cards.map((item, index) => <article key={item?.id ?? `postcard-${index}`} className={`pcCard pcCard-${index % 4}`}><div><ExperienceMedia item={item} label={item?.category ?? "Próxima parada"} /></div><footer><span>{item?.category ?? data.niches[index % Math.max(1, data.niches.length)] ?? "UGC"}</span><b>{data.contentTypes[index % Math.max(1, data.contentTypes.length)] ?? "Story"}</b><i>✦</i></footer></article>)}</div></section>
    <section className="pcPassport" id="pc-kit"><div><small>PASAPORTE CREATIVO</small><h2>Lista para producir, grabar y entregar.</h2><p>{data.includes.join(" · ")}</p></div><div className="pcServices">{data.services.map((service, index) => <article key={service}><span>0{index + 1}</span><strong>{service}</strong><b>{servicePrice(data, service)}</b></article>)}</div></section>
    <section className="pcProof"><div><small>COMUNIDAD EN RUTA</small><b>{data.followers}</b><span>seguidores</span></div><div><small>VENTANA MENSUAL</small><b>{data.monthlyViews}</b><span>visualizaciones</span></div><div><small>DESTINOS PRINCIPALES</small>{countries.slice(0, 4).map((country) => <span key={country}>{country}</span>)}</div></section>
    {brands.length > 0 && <section className="pcBrands"><span>SELLOS EN EL PASAPORTE</span><div>{brands.map((brand) => <article key={brand.id}><img src={brand.url} alt={`Logo de ${brand.name}`} /><small>{brand.name}</small></article>)}</div></section>}
    <section className="pcContact"><span>PRÓXIMO DESTINO</span><h2>Tu marca puede ser la siguiente historia.</h2><a href={emailLink(data.email)} data-analytics-target="email">Reservemos la fecha <b>→</b></a><footer><a href={socialLink("instagram", data.instagram)} data-analytics-target="instagram">{data.instagram}</a><a href={whatsappLink(data.whatsapp)} data-analytics-target="whatsapp">{data.whatsapp}</a><b>{data.location}</b></footer></section>
  </div>;
}

export function CampaignStoriesPortfolio({ data, media, brands, schema, expanded }: ExperienceProps) {
  const portrait = media.find((item) => item.category === "__portrait") ?? null;
  const groups = categoryGroups(data, media, schema);
  const cases = groups.length ? groups : [{ category: data.portfolioCategories[0] ?? "Campaña", items: [] }];
  return <div className={`portfolioExperiencePage campaignStories font-${data.fontStyle} ${expanded ? "expanded" : "compact"}`} style={{ "--experience-accent": data.accent } as CSSProperties}>
    <header className="csNav"><a href="#cs-top"><strong>{data.name}</strong><span>Creative portfolio</span></a><nav aria-label="Secciones"><a href="#cs-cases">Casos</a><a href="#cs-services">Servicios</a><a className="csContactLink" href={emailLink(data.email)} data-analytics-target="email">Contacto ↗</a></nav></header>
    <section className="csHero" id="cs-top"><div className="csHeroCopy"><span className="csEdition">UGC · CREATIVE CASE FILES</span><h1>Ideas que se sienten.<br /><em>Estrategia que funciona.</em></h1><p>{data.bio}</p><div className="csHeroMeta"><span><b>{data.followers}</b> seguidores</span><span><b>{data.monthlyViews}</b> vistas / mes</span><span><b>{data.location}</b> base creativa</span></div></div><div className="csPortrait"><ExperienceMedia item={portrait} label="Retrato de creadora" priority /><span>ESTRATEGIA<br />+ PRODUCCIÓN</span></div></section>
    <section className="csCases" id="cs-cases"><header className="csSectionIntro"><span>CASOS SELECCIONADOS</span><h2>{data.campaignTitle}</h2><p>Cada pieza parte de una idea clara y termina lista para conectar, convertir o construir confianza.</p></header>{cases.map((group, index) => {
      const story = data.caseStudies[group.category] ?? emptyCase;
      const mediaSlots = Array.from({ length: Math.max(1, Math.min(3, group.items.length || 1)) }, (_, mediaIndex) => group.items[mediaIndex] ?? null);
      return <article className="csCase" key={group.category}><div className="csCaseNumber">CASE {String(index + 1).padStart(2, "0")}</div><div className="csCaseCopy"><small>{story.client || group.category}</small><h3>{group.category}</h3><dl><div><dt>EL BRIEF</dt><dd>{story.brief || data.bio}</dd></div><div className="csHook"><dt>EL HOOK</dt><dd>“{story.hook || data.campaignTitle}”</dd></div><div><dt>EL RESULTADO</dt><dd>{story.result || `Contenido producido para ${group.category.toLowerCase()}, listo para publicación orgánica o pauta.`}</dd></div></dl>{story.testimonial && <blockquote>“{story.testimonial}”<cite>— {story.client || "Cliente"}</cite></blockquote>}</div><div className={`csCaseMedia count-${mediaSlots.length}`}>{mediaSlots.map((item, mediaIndex) => <ExperienceMedia key={item?.id ?? `${group.category}-${mediaIndex}`} item={item} label={group.category} />)}</div></article>;
    })}</section>
    {brands.length > 0 && <section className="csBrands"><span>EXPERIENCIA DE MARCA</span><div>{brands.map((brand) => <article key={brand.id}><img src={brand.url} alt={`Logo de ${brand.name}`} /><small>{brand.name}</small></article>)}</div></section>}
    <section className="csServices" id="cs-services"><div><span>DEL CONCEPTO A LA ENTREGA</span><h2>Contenido con intención en cada etapa.</h2><p>{data.includes.join(" · ")}</p></div><div className="csServiceList">{data.services.map((service, index) => <article key={service}><span>{String(index + 1).padStart(2, "0")}</span><strong>{service}</strong><small>{servicePrice(data, service)}</small></article>)}</div></section>
    <section className="csContact"><span>PRÓXIMO CASO</span><h2>Hagamos una campaña que merezca ser contada.</h2><a href={emailLink(data.email)} data-analytics-target="email">Cuéntame sobre tu marca <b>↗</b></a><div><a href={socialLink("instagram", data.instagram)} target="_blank" rel="noreferrer" data-analytics-target="instagram">{data.instagram}</a><a href={whatsappLink(data.whatsapp)} target="_blank" rel="noreferrer" data-analytics-target="whatsapp">{data.whatsapp}</a></div></section>
  </div>;
}

function usePhotoAccent(source: string | undefined, fallback: string) {
  const [sampled, setSampled] = useState<{ source: string; accent: string } | null>(null);
  useEffect(() => {
    if (!source) return;
    let active = true;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 24;
        canvas.height = 24;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;
        context.drawImage(image, 0, 0, 24, 24);
        const pixels = context.getImageData(0, 0, 24, 24).data;
        let red = 0; let green = 0; let blue = 0; let weight = 0;
        for (let index = 0; index < pixels.length; index += 16) {
          if (pixels[index + 3] < 180) continue;
          const brightness = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
          if (brightness < 28 || brightness > 238) continue;
          red += pixels[index]; green += pixels[index + 1]; blue += pixels[index + 2]; weight += 1;
        }
        if (!weight || !active) return;
        const soften = (channel: number) => Math.round(channel / weight * .74 + 255 * .26);
        const hex = [soften(red), soften(green), soften(blue)].map((channel) => channel.toString(16).padStart(2, "0")).join("");
        setSampled({ source, accent: `#${hex}` });
      } catch { /* The selected accent remains the cross-origin fallback. */ }
    };
    image.src = source;
    return () => { active = false; };
  }, [source]);
  return source && sampled?.source === source ? sampled.accent : fallback;
}

export function PersonalScrapbookPortfolio({ data, media, brands, schema, expanded }: ExperienceProps) {
  const portrait = media.find((item) => item.category === "__portrait") ?? null;
  const work = visibleWork(data, media).slice(0, schema.categoryLimit * 2);
  const palette = usePhotoAccent(portrait?.previewUrl ?? (portrait?.type === "image" ? portrait.url : undefined), data.accent);
  const collage = [portrait, work[0] ?? null, work[1] ?? null];
  const process = data.includes.slice(0, 3);
  return <div className={`portfolioExperiencePage personalScrapbook font-${data.fontStyle} ${expanded ? "expanded" : "compact"}`} style={{ "--experience-accent": palette, "--chosen-accent": data.accent } as CSSProperties}>
    <header className="psNav"><a href="#ps-top">{data.name}<i>♡</i></a><nav><a href="#ps-diary">Mi diario</a><a href="#ps-work">Creaciones</a><a href={emailLink(data.email)} data-analytics-target="email">Escríbeme ↗</a></nav></header>
    <section className="psHero" id="ps-top"><div className="psHeroCopy"><span>MI PEQUEÑO RINCÓN CREATIVO</span><h1>Historias bonitas,<br /><em>momentos reales.</em></h1><p>{data.title}</p><div>{data.niches.map((niche) => <span key={niche}>#{niche.toLowerCase()}</span>)}</div></div><div className="psHeroCollage">{collage.map((item, index) => <div className={`psPolaroid psPolaroid-${index + 1}`} key={item?.id ?? `ps-hero-${index}`}><i className="psTape" /><ExperienceMedia item={item} label={index === 0 ? "Este soy yo" : item?.category ?? "Mi contenido"} priority={index === 0} /><span>{index === 0 ? "hola, soy yo ✦" : item?.category ?? "próxima idea"}</span></div>)}<b className="psDoodle">create<br />with<br />feeling!</b></div></section>
    <section className="psDiary" id="ps-diary"><aside><span>NOTA PARA LAS MARCAS</span><b>{data.availability}</b><small>{data.location}</small></aside><div><small>ASÍ CREO CONTENIDO</small><h2>Mi proceso comienza con una emoción, no con un anuncio.</h2><p>{data.creativeDiary || data.bio}</p><div className="psProcess">{process.map((item, index) => <span key={item}><b>0{index + 1}</b>{item}</span>)}</div></div></section>
    <section className="psWork" id="ps-work"><header><span>RECIÉN SALIDO DE MI CÁMARA</span><h2>Creaciones que guardaría en favoritos.</h2></header><div className="psWall">{(work.length ? work : [null, null, null, null, null]).map((item, index) => <article key={item?.id ?? `ps-placeholder-${index}`}><i className="psTape" /><ExperienceMedia item={item} label={item?.category ?? data.niches[index % Math.max(1, data.niches.length)] ?? "UGC"} /><footer><span>{item?.category ?? "Nueva idea"}</span><b>{data.contentTypes[index % Math.max(1, data.contentTypes.length)] ?? "UGC"}</b></footer></article>)}</div></section>
    <section className="psNotes"><div><span>LO QUE PUEDO CREAR</span><h2>Ideas listas para cobrar vida.</h2>{data.services.map((service) => <p key={service}>✦ {service}</p>)}</div><aside><small>MI COMUNIDAD</small><strong>{data.followers}</strong><span>personas siguiendo la historia</span><b>{data.monthlyViews} vistas / mes</b></aside><div className="psFormats">{data.contentTypes.map((type) => <span key={type}>{type}</span>)}</div></section>
    {brands.length > 0 && <section className="psBrands"><span>HE CREADO CON</span><div>{brands.map((brand) => <article key={brand.id}><img src={brand.url} alt={`Logo de ${brand.name}`} /><small>{brand.name}</small></article>)}</div></section>}
    <section className="psContact"><span>UNA ÚLTIMA NOTITA</span><h2>¿Creamos algo juntas?</h2><p>Cuéntame qué imaginas para tu marca. Yo pongo la cámara, las ideas y el cuidado en cada detalle.</p><a href={emailLink(data.email)} data-analytics-target="email">Sí, hablemos <b>♡</b></a><div><a href={socialLink("instagram", data.instagram)} target="_blank" rel="noreferrer" data-analytics-target="instagram">Instagram · {data.instagram}</a><a href={socialLink("tiktok", data.tiktok)} target="_blank" rel="noreferrer" data-analytics-target="tiktok">TikTok · {data.tiktok}</a></div></section>
  </div>;
}

export function ShowreelFirstPortfolio({ data, media, brands, schema, expanded }: ExperienceProps) {
  const portrait = media.find((item) => item.category === "__portrait") ?? null;
  const work = visibleWork(data, media);
  const heroItem = work.find((item) => item.type === "video") ?? work[0] ?? portrait;
  const groups = categoryGroups(data, media, schema);
  return <div className={`portfolioExperiencePage showreelFirst font-${data.fontStyle} ${expanded ? "expanded" : "compact"}`} style={{ "--experience-accent": data.accent } as CSSProperties}>
    <a className="srFloatingContact" href={emailLink(data.email)} data-analytics-target="email">Trabajemos <span>↗</span></a>
    <section className="srHero" id="sr-top"><div className="srHeroMedia"><ExperienceMedia item={heroItem} label="Showreel principal" ambient /></div><header><strong>{data.name}</strong><nav><a href="#sr-work">Reel</a><a href="#sr-services">Servicios</a></nav></header><div className="srHeroCopy"><span>SHOWREEL · UGC CREATOR</span><h1>{data.name}</h1><p>{data.title}</p></div><div className="srNow"><i /> NOW PLAYING <span>{heroItem?.category ?? "Tu mejor pieza"}</span></div><a className="srScroll" href="#sr-work">Explorar ↓</a></section>
    <div className="srTicker">{[...data.contentTypes, ...data.niches].map((item, index) => <span key={`${item}-${index}`}>{item} <b>✦</b></span>)}</div>
    <section className="srWork" id="sr-work"><header><small>SELECCIÓN DE TRABAJO</small><h2>Todo lo que necesitas ver.</h2></header>{(groups.length ? groups : [{ category: "Showreel", items: [null, null, null] }]).map((group, groupIndex) => <article className="srCategory" key={group.category}><div className="srCategoryTitle"><span>{String(groupIndex + 1).padStart(2, "0")}</span><h3>{group.category}</h3><small>{group.items.length} PIEZAS</small></div><div className="srReelRow" style={{ "--sr-count": group.items.length } as CSSProperties}>{group.items.map((item, index) => <div className="srReelCard" key={item?.id ?? `${group.category}-${index}`}><ExperienceMedia item={item} label={group.category} /><span>{String(index + 1).padStart(2, "0")}</span><small>{data.contentTypes[index % Math.max(1, data.contentTypes.length)] ?? "UGC"}</small></div>)}</div></article>)}</section>
    <section className="srProof"><span><b>{data.followers}</b> seguidores</span><span><b>{data.monthlyViews}</b> vistas mensuales</span><span><b>{data.womenAudience}</b> audiencia femenina</span><span><b>{brands.length || "—"}</b> marcas</span></section>
    {brands.length > 0 && <section className="srBrands"><small>SELECTED CLIENTS</small><div>{brands.map((brand) => <article key={brand.id}><img src={brand.url} alt={`Logo de ${brand.name}`} /></article>)}</div></section>}
    <section className="srServices" id="sr-services"><header><small>SERVICIOS + TARIFAS</small><h2>¿Qué creamos?</h2></header><div>{data.services.map((service, index) => <article key={service}><span>{String(index + 1).padStart(2, "0")}</span><h3>{service}</h3><b>{servicePrice(data, service)}</b></article>)}</div><p>{data.includes.join(" · ")}</p></section>
    <section className="srContact"><span>FIN DEL REEL · INICIO DE ALGO NUEVO</span><h2>Tu producto.<br />Mi próxima historia.</h2><a href={emailLink(data.email)} data-analytics-target="email">{data.email} ↗</a><footer><span>{data.location}</span><a href={socialLink("instagram", data.instagram)} target="_blank" rel="noreferrer" data-analytics-target="instagram">{data.instagram}</a><a href={socialLink("tiktok", data.tiktok)} target="_blank" rel="noreferrer" data-analytics-target="tiktok">{data.tiktok}</a></footer></section>
  </div>;
}

export function TalentProfilePortfolio({ data, media, brands, schema, expanded }: ExperienceProps) {
  const portrait = media.find((item) => item.category === "__portrait") ?? null;
  const groups = categoryGroups(data, media, schema);
  const capabilities = Array.from(new Set([...data.contentTypes, ...data.services])).slice(0, 8);
  const countries = data.topCountries.split("·").map((item) => item.trim()).filter(Boolean);
  return <div className={`portfolioExperiencePage talentProfile font-${data.fontStyle} ${expanded ? "expanded" : "compact"}`} style={{ "--experience-accent": data.accent } as CSSProperties}>
    <header className="tpNav"><a href="#tp-top"><b>BRILLA / TALENT</b><span>UGC CREATOR PROFILE</span></a><nav><a href="#tp-work">Trabajo</a><a href="#tp-rates">Tarifas</a><a className="tpNavContact" href={emailLink(data.email)} data-analytics-target="email">Consultar disponibilidad</a></nav></header>
    <section className="tpHero" id="tp-top"><div className="tpPortrait"><ExperienceMedia item={portrait} label="Retrato profesional" priority /><span>{initials(data.name)}</span></div><div className="tpIntro"><span>CREATOR PROFILE · {data.location}</span><h1>{data.name}</h1><p className="tpRole">{data.title}</p><p className="tpBio">{data.bio}</p><div className="tpFacts"><span><small>BASE</small><b>{data.location}</b></span><span><small>IDIOMAS</small><b>{data.languages || "Español"}</b></span><span><small>ESTADO</small><b>{data.availability}</b></span></div><div className="tpTags">{data.niches.map((niche) => <span key={niche}>{niche}</span>)}</div><div className="tpSocial"><a href={socialLink("instagram", data.instagram)} target="_blank" rel="noreferrer" data-analytics-target="instagram">Instagram ↗</a><a href={socialLink("tiktok", data.tiktok)} target="_blank" rel="noreferrer" data-analytics-target="tiktok">TikTok ↗</a></div></div></section>
    <section className="tpCapabilities"><header><small>CAPACIDADES</small><h2>Formatos que puedo producir para tu marca.</h2></header><div>{capabilities.map((capability, index) => <article key={capability}><span>{String(index + 1).padStart(2, "0")}</span><strong>{capability}</strong><small>{data.clientTypes[index % Math.max(1, data.clientTypes.length)] ?? "Contenido de marca"}</small></article>)}</div></section>
    <section className="tpWork" id="tp-work"><header><small>PORTAFOLIO</small><h2>Trabajo seleccionado por capacidad.</h2><p>{data.campaignTitle}</p></header>{(groups.length ? groups : [{ category: "Contenido UGC", items: [null, null, null] }]).map((group) => <article className="tpWorkGroup" key={group.category}><div><h3>{group.category}</h3><span>{String(group.items.length).padStart(2, "0")} piezas</span></div><section>{group.items.map((item, index) => <div key={item?.id ?? `${group.category}-${index}`}><ExperienceMedia item={item} label={group.category} /><small>{data.contentTypes[index % Math.max(1, data.contentTypes.length)] ?? "UGC"}</small></div>)}</section></article>)}</section>
    {brands.length > 0 && <section className="tpBrands"><small>MARCAS</small><h2>Experiencia seleccionada.</h2><div>{brands.map((brand) => <article key={brand.id}><img src={brand.url} alt={`Logo de ${brand.name}`} /><span>{brand.name}</span></article>)}</div></section>}
    <section className="tpCommercial" id="tp-rates"><div className="tpMetrics"><small>AUDIENCIA</small><h2>Alcance y comunidad.</h2><div><span><b>{data.followers}</b>Seguidores</span><span><b>{data.monthlyViews}</b>Vistas / mes</span><span><b>{data.womenAudience}</b>Mujeres</span></div><p>{countries.join(" · ")}</p></div><div className="tpRates"><small>TARIFAS BASE</small><div><span>Video UGC</span><b>{data.videoRate}</b></div><div><span>Reel colaborativo</span><b>{data.collabRate}</b></div><div><span>Historia con CTA</span><b>{data.storyRate}</b></div><div><span>Pack de historias</span><b>{data.storyPackRate}</b></div><div><span>Derechos de pauta / mes</span><b>{data.usageRate}</b></div><p>Incluye: {data.includes.join(" · ")}</p></div></section>
    <section className="tpContact"><div><span>BOOKING / COLLABORATIONS</span><h2>Disponible para tu próxima campaña.</h2></div><div><a href={emailLink(data.email)} data-analytics-target="email">{data.email} ↗</a><a href={whatsappLink(data.whatsapp)} target="_blank" rel="noreferrer" data-analytics-target="whatsapp">{data.whatsapp}</a></div></section>
    <footer className="tpFooter"><b>{data.name}</b><span>UGC Creator · {data.location}</span><span>Perfil presentado por Brilla</span></footer>
  </div>;
}
