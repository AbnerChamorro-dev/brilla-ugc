import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFImage,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import type { BrandAsset, Media, Portfolio } from "./page";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;

type PdfFonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont };
type PdfTheme = { ink: RGB; paper: RGB; accent: RGB; soft: RGB; muted: RGB; name: string };

const templateNames: Record<string, string> = {
  gallery: "Gallery", studio: "Studio Luv", scrapbook: "Scrapbook", art: "Art Director",
  blue: "Blue OS", whimsy: "Whimsy", sage: "Sage Journal", muse: "Muse Editorial",
  creator: "Creator Studio", aura: "Aura Grid", noir: "Noir Atelier", sorbet: "Sorbet Studio",
  lavender: "Lavender Cloud", mint: "Mint Picnic", electric: "Electric Pulse",
  pop: "Sunny Pop", retro: "Retro Zine", chic: "Éditorial Chic", bold: "Neo Brutal",
  feed: "Creator Feed", stories: "Campaign Stories", personal: "Personal Scrapbook",
  showreel: "Showreel First", talent: "Talent Profile", postcard: "Postcard Journal",
};

function safePdfText(value: string) {
  return value
    .normalize("NFC")
    .replace(/[–—−]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function color(hex: string, fallback: string) {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex : fallback;
  return rgb(
    Number.parseInt(normalized.slice(1, 3), 16) / 255,
    Number.parseInt(normalized.slice(3, 5), 16) / 255,
    Number.parseInt(normalized.slice(5, 7), 16) / 255,
  );
}

function mix(first: RGB, second: RGB, amount: number) {
  return rgb(
    first.red * (1 - amount) + second.red * amount,
    first.green * (1 - amount) + second.green * amount,
    first.blue * (1 - amount) + second.blue * amount,
  );
}

function themeFor(portfolio: Portfolio): PdfTheme {
  const templateId = portfolio.format === "website" ? portfolio.webTemplate : portfolio.template;
  const dark = new Set(["creator", "noir", "electric", "studio", "art", "blue", "showreel"]).has(templateId);
  const accent = color(portfolio.accent, "#6d4dff");
  const paper = dark ? color("#f4f1ff", "#f4f1ff") : color("#fffdf8", "#fffdf8");
  return {
    ink: dark ? color("#17132f", "#17132f") : color("#211a49", "#211a49"),
    paper,
    accent,
    soft: mix(accent, paper, .84),
    muted: color("#6d6880", "#6d6880"),
    name: templateNames[templateId] ?? "Brilla",
  };
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = safePdfText(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) current = candidate;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines;
}

function textBlock(
  page: PDFPage,
  text: string,
  options: { x: number; y: number; width: number; size: number; font: PDFFont; color: RGB; lineHeight?: number; maxLines?: number },
) {
  const lineHeight = options.lineHeight ?? options.size * 1.3;
  const lines = wrap(text, options.font, options.size, options.width).slice(0, options.maxLines);
  lines.forEach((line, index) => page.drawText(line, {
    x: options.x,
    y: options.y - index * lineHeight,
    size: options.size,
    font: options.font,
    color: options.color,
  }));
  return options.y - lines.length * lineHeight;
}

function sectionLabel(page: PDFPage, text: string, x: number, y: number, fonts: PdfFonts, theme: PdfTheme) {
  page.drawText(safePdfText(text).toUpperCase(), { x, y, size: 8, font: fonts.bold, color: theme.accent });
}

function pill(page: PDFPage, text: string, x: number, y: number, fonts: PdfFonts, theme: PdfTheme, maxWidth = 210) {
  const label = safePdfText(text);
  const width = Math.min(maxWidth, fonts.bold.widthOfTextAtSize(label, 8) + 20);
  page.drawRectangle({ x, y: y - 5, width, height: 24, color: theme.soft });
  page.drawText(label, { x: x + 10, y: y + 3, size: 8, font: fonts.bold, color: theme.ink });
  return width;
}

async function imageBytes(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo descargar una imagen (${response.status}).`);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  try {
    const maximum = 1400;
    const scale = Math.min(1, maximum / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas no disponible.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const jpeg = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error("No se pudo convertir la imagen.")),
      "image/jpeg",
      .84,
    ));
    return new Uint8Array(await jpeg.arrayBuffer());
  } finally {
    bitmap.close();
  }
}

async function loadImage(document: PDFDocument, url?: string) {
  if (!url) return null;
  try { return await document.embedJpg(await imageBytes(url)); }
  catch { return null; }
}

function containImage(page: PDFPage, image: PDFImage, x: number, y: number, width: number, height: number, background: RGB) {
  page.drawRectangle({ x, y, width, height, color: background });
  const ratio = Math.min(width / image.width, height / image.height);
  const imageWidth = image.width * ratio;
  const imageHeight = image.height * ratio;
  page.drawImage(image, {
    x: x + (width - imageWidth) / 2,
    y: y + (height - imageHeight) / 2,
    width: imageWidth,
    height: imageHeight,
  });
}

function addBasePage(document: PDFDocument, theme: PdfTheme) {
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: theme.paper });
  return page;
}

function drawMetric(page: PDFPage, label: string, value: string, x: number, y: number, width: number, fonts: PdfFonts, theme: PdfTheme) {
  page.drawRectangle({ x, y, width, height: 96, color: theme.soft });
  textBlock(page, value || "-", { x: x + 14, y: y + 54, width: width - 28, size: 22, font: fonts.bold, color: theme.ink, maxLines: 1 });
  page.drawText(safePdfText(label).toUpperCase(), { x: x + 14, y: y + 18, size: 7, font: fonts.bold, color: theme.muted });
}

async function coverPage(document: PDFDocument, portfolio: Portfolio, media: Media[], fonts: PdfFonts, theme: PdfTheme) {
  const page = addBasePage(document, theme);
  page.drawRectangle({ x: 0, y: 0, width: 18, height: PAGE_HEIGHT, color: theme.accent });
  page.drawText("brilla", { x: MARGIN, y: 778, size: 18, font: fonts.bold, color: theme.ink });
  page.drawCircle({ x: 94, y: 784, size: 3, color: theme.accent });
  page.drawText(`${portfolio.format === "website" ? "WEB" : "PRESENTACION"} - ${safePdfText(theme.name).toUpperCase()}`, {
    x: MARGIN, y: 747, size: 7, font: fonts.bold, color: theme.muted,
  });

  const portrait = media.find((item) => item.category === "__portrait");
  const image = await loadImage(document, portrait?.type === "video" ? portrait.previewUrl : portrait?.url);
  if (image) containImage(page, image, 347, 118, 206, 614, theme.soft);
  else {
    page.drawRectangle({ x: 347, y: 118, width: 206, height: 614, color: theme.ink });
    page.drawText("UGC", { x: 368, y: 350, size: 68, font: fonts.bold, color: theme.accent });
  }

  sectionLabel(page, "MEDIA KIT", MARGIN, 650, fonts, theme);
  let y = textBlock(page, portfolio.name || "Tu nombre", { x: MARGIN, y: 606, width: 275, size: 34, font: fonts.bold, color: theme.ink, lineHeight: 36, maxLines: 3 });
  y -= 20;
  y = textBlock(page, portfolio.title, { x: MARGIN, y, width: 275, size: 16, font: fonts.italic, color: theme.accent, lineHeight: 21, maxLines: 4 });
  y -= 16;
  textBlock(page, portfolio.bio, { x: MARGIN, y, width: 275, size: 10, font: fonts.regular, color: theme.muted, lineHeight: 15, maxLines: 7 });
  page.drawText(safePdfText(portfolio.location || ""), { x: MARGIN, y: 145, size: 9, font: fonts.bold, color: theme.ink });
  page.drawText(safePdfText(portfolio.availability || ""), { x: MARGIN, y: 125, size: 8, font: fonts.regular, color: theme.muted });
}

async function profilePage(document: PDFDocument, portfolio: Portfolio, brands: BrandAsset[], fonts: PdfFonts, theme: PdfTheme) {
  const page = addBasePage(document, theme);
  sectionLabel(page, "01 - PERFIL Y AUDIENCIA", MARGIN, 780, fonts, theme);
  textBlock(page, "Una comunidad lista para descubrir nuevas historias.", { x: MARGIN, y: 738, width: 480, size: 27, font: fonts.bold, color: theme.ink, lineHeight: 31, maxLines: 3 });

  const metricWidth = (PAGE_WIDTH - MARGIN * 2 - 20) / 3;
  drawMetric(page, "Seguidores", portfolio.followers, MARGIN, 550, metricWidth, fonts, theme);
  drawMetric(page, "Vistas mensuales", portfolio.monthlyViews, MARGIN + metricWidth + 10, 550, metricWidth, fonts, theme);
  drawMetric(page, "Audiencia femenina", portfolio.womenAudience, MARGIN + (metricWidth + 10) * 2, 550, metricWidth, fonts, theme);

  sectionLabel(page, "SOBRE MI", MARGIN, 502, fonts, theme);
  textBlock(page, portfolio.bio, { x: MARGIN, y: 474, width: 310, size: 11, font: fonts.regular, color: theme.muted, lineHeight: 17, maxLines: 8 });

  sectionLabel(page, "NICHO Y ENFOQUE", 382, 502, fonts, theme);
  let pillY = 472;
  portfolio.niches.slice(0, 7).forEach((niche) => { pill(page, niche, 382, pillY, fonts, theme, 160); pillY -= 32; });

  sectionLabel(page, "PRINCIPALES UBICACIONES", MARGIN, 310, fonts, theme);
  textBlock(page, portfolio.topCountries, { x: MARGIN, y: 278, width: 500, size: 11, font: fonts.regular, color: theme.ink, lineHeight: 18, maxLines: 5 });

  if (brands.length > 0) {
    sectionLabel(page, "MARCAS Y EXPERIENCIA", MARGIN, 180, fonts, theme);
    textBlock(page, brands.slice(0, 12).map((brand) => brand.name).join(" - "), { x: MARGIN, y: 150, width: 500, size: 10, font: fonts.bold, color: theme.muted, lineHeight: 15, maxLines: 5 });
  }
}

async function portfolioPages(document: PDFDocument, portfolio: Portfolio, media: Media[], fonts: PdfFonts, theme: PdfTheme) {
  const work = media.filter((item) => !item.category.startsWith("__") && portfolio.portfolioCategories.includes(item.category)).slice(0, 18);
  const groups = work.length ? Array.from({ length: Math.ceil(work.length / 6) }, (_, index) => work.slice(index * 6, index * 6 + 6)) : [[]];

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const page = addBasePage(document, theme);
    sectionLabel(page, `02 - PORTAFOLIO${groups.length > 1 ? ` ${groupIndex + 1}/${groups.length}` : ""}`, MARGIN, 780, fonts, theme);
    textBlock(page, portfolio.campaignTitle || "Contenido creado para conectar y convertir.", { x: MARGIN, y: 744, width: 505, size: 23, font: fonts.bold, color: theme.ink, lineHeight: 27, maxLines: 2 });

    if (groups[groupIndex].length === 0) {
      page.drawRectangle({ x: MARGIN, y: 180, width: PAGE_WIDTH - MARGIN * 2, height: 430, color: theme.soft });
      textBlock(page, "Agrega piezas al editor para incluirlas en tu media kit.", { x: 92, y: 405, width: 410, size: 20, font: fonts.bold, color: theme.ink, lineHeight: 26, maxLines: 3 });
      continue;
    }

    for (let index = 0; index < groups[groupIndex].length; index += 1) {
      const item = groups[groupIndex][index];
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = MARGIN + column * 260;
      const y = 500 - row * 210;
      const image = await loadImage(document, item.type === "video" ? item.previewUrl : item.url);
      if (image) containImage(page, image, x, y, 245, 160, theme.soft);
      else {
        page.drawRectangle({ x, y, width: 245, height: 160, color: theme.soft });
        page.drawText(item.type === "video" ? "VIDEO" : "IMAGEN", { x: x + 92, y: y + 76, size: 10, font: fonts.bold, color: theme.accent });
      }
      page.drawText(safePdfText(item.category || "Portafolio").toUpperCase(), { x, y: y - 17, size: 7, font: fonts.bold, color: theme.accent });
      textBlock(page, item.name || "Pieza UGC", { x, y: y - 33, width: 245, size: 9, font: fonts.bold, color: theme.ink, maxLines: 1 });
    }
  }
}

function offerPage(document: PDFDocument, portfolio: Portfolio, fonts: PdfFonts, theme: PdfTheme) {
  const page = addBasePage(document, theme);
  sectionLabel(page, "03 - SERVICIOS Y TARIFAS", MARGIN, 780, fonts, theme);
  textBlock(page, "Una propuesta clara para hacer realidad la siguiente campaña.", { x: MARGIN, y: 740, width: 500, size: 25, font: fonts.bold, color: theme.ink, lineHeight: 30, maxLines: 3 });

  sectionLabel(page, "SERVICIOS", MARGIN, 635, fonts, theme);
  let serviceY = 602;
  portfolio.services.slice(0, 8).forEach((service, index) => {
    page.drawCircle({ x: MARGIN + 7, y: serviceY + 4, size: 7, color: theme.accent });
    page.drawText(String(index + 1).padStart(2, "0"), { x: MARGIN + 2, y: serviceY + 1, size: 5, font: fonts.bold, color: theme.paper });
    textBlock(page, service, { x: MARGIN + 25, y: serviceY, width: 215, size: 10, font: fonts.bold, color: theme.ink, maxLines: 1 });
    serviceY -= 31;
  });

  sectionLabel(page, "INCLUYE", MARGIN, 340, fonts, theme);
  textBlock(page, portfolio.includes.map((item) => `+ ${item}`).join("   "), { x: MARGIN, y: 310, width: 225, size: 9, font: fonts.regular, color: theme.muted, lineHeight: 15, maxLines: 9 });

  const rates = [
    ["Video UGC", portfolio.videoRate],
    ["Reel colaborativo", portfolio.collabRate],
    ["1 historia con CTA", portfolio.storyRate],
    ["Pack de historias", portfolio.storyPackRate],
    ["Derechos de pauta / mes", portfolio.usageRate],
  ];
  page.drawRectangle({ x: 310, y: 260, width: 243, height: 378, color: theme.ink });
  page.drawText("TARIFAS", { x: 332, y: 600, size: 8, font: fonts.bold, color: theme.accent });
  rates.forEach(([name, value], index) => {
    const y = 552 - index * 62;
    page.drawText(safePdfText(name), { x: 332, y, size: 9, font: fonts.regular, color: theme.paper });
    textBlock(page, value, { x: 332, y: y - 22, width: 195, size: 14, font: fonts.bold, color: theme.paper, maxLines: 1 });
    if (index < rates.length - 1) page.drawLine({ start: { x: 332, y: y - 38 }, end: { x: 531, y: y - 38 }, thickness: .5, color: mix(theme.paper, theme.ink, .72) });
  });
}

function contactPage(document: PDFDocument, portfolio: Portfolio, fonts: PdfFonts, theme: PdfTheme) {
  const page = addBasePage(document, theme);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: theme.ink });
  page.drawCircle({ x: 510, y: 730, size: 130, color: theme.accent, opacity: .22 });
  page.drawCircle({ x: 70, y: 90, size: 105, color: theme.accent, opacity: .16 });
  page.drawText("brilla", { x: MARGIN, y: 778, size: 18, font: fonts.bold, color: theme.paper });
  sectionLabel(page, "HABLEMOS", MARGIN, 650, fonts, theme);
  textBlock(page, "Tu marca merece una historia que la gente quiera ver.", { x: MARGIN, y: 600, width: 470, size: 34, font: fonts.bold, color: theme.paper, lineHeight: 39, maxLines: 4 });
  textBlock(page, portfolio.availability, { x: MARGIN, y: 420, width: 470, size: 13, font: fonts.italic, color: theme.accent, lineHeight: 18, maxLines: 3 });

  const contacts = [
    ["EMAIL", portfolio.email], ["WHATSAPP", portfolio.whatsapp],
    ["INSTAGRAM", portfolio.instagram], ["TIKTOK", portfolio.tiktok],
  ].filter(([, value]) => Boolean(value));
  contacts.forEach(([label, value], index) => {
    const x = MARGIN + (index % 2) * 255;
    const y = 300 - Math.floor(index / 2) * 78;
    page.drawText(label, { x, y, size: 7, font: fonts.bold, color: theme.accent });
    textBlock(page, value, { x, y: y - 23, width: 220, size: 12, font: fonts.bold, color: theme.paper, maxLines: 2 });
  });
}

function addFooters(document: PDFDocument, portfolio: Portfolio, fonts: PdfFonts, theme: PdfTheme) {
  const pages = document.getPages();
  pages.forEach((page, index) => {
    const darkPage = index === pages.length - 1;
    const footerColor = darkPage ? theme.paper : theme.muted;
    page.drawText(safePdfText(portfolio.portfolioSlug ? `brillaugc.com/${portfolio.portfolioSlug}` : portfolio.name), { x: MARGIN, y: 27, size: 7, font: fonts.regular, color: footerColor });
    page.drawText(`${index + 1} / ${pages.length}`, { x: 518, y: 27, size: 7, font: fonts.bold, color: footerColor });
  });
}

export async function createPortfolioPdf(portfolio: Portfolio, media: Media[], brands: BrandAsset[]) {
  const document = await PDFDocument.create();
  const fonts: PdfFonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
    italic: await document.embedFont(StandardFonts.HelveticaOblique),
  };
  const theme = themeFor(portfolio);
  document.setTitle(safePdfText(`${portfolio.name} - Media kit UGC`));
  document.setAuthor("Brilla UGC");
  document.setSubject("Portafolio profesional UGC");
  document.setCreator("Brilla UGC");

  await coverPage(document, portfolio, media, fonts, theme);
  await profilePage(document, portfolio, brands, fonts, theme);
  await portfolioPages(document, portfolio, media, fonts, theme);
  offerPage(document, portfolio, fonts, theme);
  contactPage(document, portfolio, fonts, theme);
  addFooters(document, portfolio, fonts, theme);

  return document.save({ useObjectStreams: true });
}

export async function downloadPortfolioPdf(portfolio: Portfolio, media: Media[], brands: BrandAsset[]) {
  const bytes = await createPortfolioPdf(portfolio, media, brands);
  const blob = new Blob([bytes.slice().buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${portfolio.portfolioSlug || "media-kit-ugc"}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
