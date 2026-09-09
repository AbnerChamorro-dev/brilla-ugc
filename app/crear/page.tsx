"use client";

/* The editor intentionally uses plain anchors for navigation outside the form. */
/* eslint-disable @next/next/no-html-link-for-pages */
/* User media uses local blob URLs and private signed URLs, so Next image optimization is not applicable here. */
/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, CSSProperties, PointerEvent, UIEvent, WheelEvent, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { LegalConsentCheckbox } from "../components/legal-consent-checkbox";
import { LegalConsentGate } from "../components/legal-consent-gate";
import { rememberAuthRedirect } from "../lib/auth-redirect";
import {
  clearPendingLegalConsent,
  markLegalConsentPending,
  recordCurrentLegalConsent,
  resolveCurrentLegalConsent,
} from "../lib/legal-consent";
import { getSupabaseBrowserClient } from "../lib/supabase";
import {
  CampaignStoriesPortfolio,
  CreatorFeedPortfolio,
  PersonalScrapbookPortfolio,
  PostcardJournalPortfolio,
  ShowreelFirstPortfolio,
  TalentProfilePortfolio,
} from "./portfolio-experiences";
import "./crear.css";
import "./templates.css";
import "./website.css";
import "./template-refresh.css";
import "./creator-feed.css";
import "./portfolio-experiences.css";
import "./portfolio-additions.css";

export type CaseStudy = { client: string; brief: string; hook: string; result: string; testimonial: string };
export type Portfolio = {
  name: string; title: string; bio: string; location: string; niches: string[]; format: "website" | "presentation"; webTemplate: string; template: string; fontStyle: string; accent: string; portfolioCategories: string[];
  creativeDiary: string; languages: string; caseStudies: Record<string, CaseStudy>;
  campaignTitle: string; contentTypes: string[]; clientTypes: string[]; services: string[]; includes: string[];
  followers: string; monthlyViews: string; womenAudience: string; topCountries: string;
  videoRate: string; collabRate: string; storyRate: string; storyPackRate: string; usageRate: string;
  email: string; whatsapp: string; instagram: string; tiktok: string; availability: string;
  notifyViews: boolean; metricSync: boolean; portfolioSlug: string;
};
export type Media = { id: number; name: string; type: "video" | "image"; url: string; framed: boolean; category: string; instagram: string; tiktok: string; storagePath?: string; previewUrl?: string; previewPath?: string };
export type BrandAsset = { id: number; name: string; url: string; storagePath?: string };
export type TemplateSchema = { id: string; format: "website" | "presentation"; categoryLimit: number; photoLimit: number; portrait: boolean; contactVisual: boolean; label: string };
type StoredAsset = { id: number; kind: "media" | "brand"; name: string; blob: Blob; type?: "video" | "image"; framed?: boolean; category?: string; instagram?: string; tiktok?: string; storagePath?: string; previewBlob?: Blob; previewPath?: string };
type RemoteAsset = { asset_id: number; kind: "media" | "brand"; storage_path: string; preview_path: string | null; original_name: string; media_type: "video" | "image"; category: string; framed: boolean; instagram: string; tiktok: string; sort_order: number; size_bytes: number; mime_type: string };

const assetDbName = "brilla-assets-v1";
const assetStoreName = "assets";
const draftStorageKey = "brilla-portfolio-draft-v2";
const pendingStepStorageKey = "brilla-post-auth-step-v1";
const draftUploadPendingKey = "brilla-pending-cloud-upload-v1";
const creatorMediaBucket = "creator-media";
const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const videoMimeTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const maxImageBytes = 10 * 1024 * 1024;
const maxVideoBytes = 50 * 1024 * 1024;
const signedAssetLifetimeSeconds = 24 * 60 * 60;
const reservedPortfolioSlugs = new Set(["crear", "cuenta", "api", "auth", "login", "admin"]);

type CloudSaveState = "local" | "loading" | "saved" | "error";
type SlugState = "idle" | "checking" | "available" | "taken" | "invalid";

function normalizePortfolioSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function validPortfolioSlug(value: string) {
  return value.length >= 3 && value.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && !reservedPortfolioSlugs.has(value);
}

function authRedirectOrigin() {
  if (typeof window === "undefined") return "";
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredSiteUrl) {
    try { return new URL(configuredSiteUrl).origin; } catch { /* use the current origin */ }
  }
  return window.location.origin;
}
function assetDb() { return new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(assetDbName, 1); request.onupgradeneeded = () => request.result.createObjectStore(assetStoreName, { keyPath: ["kind", "id"] }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
async function storeAsset(asset: StoredAsset) { const db = await assetDb(); const transaction = db.transaction(assetStoreName, "readwrite"); transaction.objectStore(assetStoreName).put(asset); await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); }); db.close(); }
async function deleteAsset(kind: "media" | "brand", id: number) { const db = await assetDb(); const transaction = db.transaction(assetStoreName, "readwrite"); transaction.objectStore(assetStoreName).delete([kind, id]); await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); }); db.close(); }
async function readAssets() { const db = await assetDb(); const transaction = db.transaction(assetStoreName, "readonly"); const request = transaction.objectStore(assetStoreName).getAll(); const assets = await new Promise<StoredAsset[]>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); db.close(); return assets; }
async function updateStoredAsset(kind: "media" | "brand", id: number, changes: Partial<StoredAsset>) { const db = await assetDb(); const transaction = db.transaction(assetStoreName, "readwrite"); const store = transaction.objectStore(assetStoreName); const request = store.get([kind, id]); const current = await new Promise<StoredAsset | undefined>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); if (current) store.put({ ...current, ...changes, kind, id }); await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); }); db.close(); }

function validateAssetFile(file: Pick<File, "name" | "type" | "size">, kind: "media" | "brand") {
  const image = imageMimeTypes.has(file.type);
  const video = videoMimeTypes.has(file.type);
  if (kind === "brand" && !image) return "Los logos deben ser JPG, PNG, WebP o GIF.";
  if (kind === "media" && !image && !video) return "Usa imágenes JPG, PNG, WebP o GIF, o videos MP4, WebM o MOV.";
  const limit = video ? maxVideoBytes : maxImageBytes;
  if (file.size > limit) return `${file.name} supera el límite de ${video ? "50 MB" : "10 MB"}.`;
  return "";
}

async function resizeImageBlob(blob: Blob, maxDimension: number, quality: number) {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) { bitmap.close(); throw new Error("Canvas no disponible"); }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("No se pudo optimizar la imagen")), "image/webp", quality));
}

async function videoPreviewBlob(blob: Blob) {
  const source = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = source;
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("El video tardó demasiado en abrir")), 8000);
      video.onloadeddata = () => { window.clearTimeout(timeout); resolve(); };
      video.onerror = () => { window.clearTimeout(timeout); reject(new Error("No se pudo leer el video")); };
      video.load();
    });
    const maxDimension = 640;
    const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas no disponible");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("No se pudo crear la portada")), "image/webp", .78));
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(source);
  }
}

async function optimizeUploadFile(file: File) {
  if (!imageMimeTypes.has(file.type) || file.type === "image/gif") return file;
  try {
    const optimized = await resizeImageBlob(file, 2400, .86);
    if (optimized.size >= file.size) return file;
    return new File([optimized], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

async function createAssetPreview(blob: Blob, type: "video" | "image") {
  try { return type === "video" ? await videoPreviewBlob(blob) : await resizeImageBlob(blob, 640, .76); }
  catch { return undefined; }
}

function safeStorageName(name: string) {
  const normalized = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const safe = normalized.replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  return safe || "archivo";
}

async function uploadStoredAsset(userId: string, asset: StoredAsset, sortOrder: number, previousPath?: string, previousPreviewPath?: string) {
  const supabase = getSupabaseBrowserClient();
  const path = `${userId}/${asset.kind}/${asset.id}-${safeStorageName(asset.name)}`;
  const previewPath = asset.previewBlob ? `${userId}/previews/${asset.kind}-${asset.id}.webp` : undefined;
  const { error: storageError } = await supabase.storage.from(creatorMediaBucket).upload(path, asset.blob, {
    upsert: true,
    contentType: asset.blob.type,
    cacheControl: "3600",
  });
  if (storageError) throw storageError;
  if (previewPath && asset.previewBlob) {
    const { error: previewError } = await supabase.storage.from(creatorMediaBucket).upload(previewPath, asset.previewBlob, {
      upsert: true,
      contentType: "image/webp",
      cacheControl: "86400",
    });
    if (previewError) {
      if (path !== previousPath) await supabase.storage.from(creatorMediaBucket).remove([path]);
      throw previewError;
    }
  }

  const mediaType = asset.kind === "brand" ? "image" : asset.type ?? "image";
  const { error: metadataError } = await supabase.from("creator_media").upsert({
    user_id: userId,
    asset_id: asset.id,
    kind: asset.kind,
    storage_path: path,
    preview_path: previewPath ?? null,
    original_name: asset.name,
    media_type: mediaType,
    category: asset.category ?? "",
    framed: asset.framed ?? false,
    instagram: asset.instagram ?? "",
    tiktok: asset.tiktok ?? "",
    sort_order: sortOrder,
    size_bytes: asset.blob.size,
    mime_type: asset.blob.type,
  }, { onConflict: "user_id,asset_id" });

  if (metadataError) {
    const uploadedPaths = [path !== previousPath ? path : undefined, previewPath && previewPath !== previousPreviewPath ? previewPath : undefined].filter((item): item is string => Boolean(item));
    if (uploadedPaths.length) await supabase.storage.from(creatorMediaBucket).remove(uploadedPaths);
    throw metadataError;
  }
  if (previousPath && previousPath !== path) await supabase.storage.from(creatorMediaBucket).remove([previousPath]);
  if (previousPreviewPath && previousPreviewPath !== previewPath) await supabase.storage.from(creatorMediaBucket).remove([previousPreviewPath]);
  return { path, previewPath };
}

async function signedAssetUrl(path: string) {
  const { data, error } = await getSupabaseBrowserClient().storage.from(creatorMediaBucket).createSignedUrl(path, signedAssetLifetimeSeconds);
  if (error || !data?.signedUrl) throw error ?? new Error("No se pudo abrir el archivo.");
  return data.signedUrl;
}

const steps = [
  ["Dirección", "Elige el lenguaje visual", "Decide entre una página web profesional o una experiencia presentacional."],
  ["Identidad", "Cuéntales quién eres", "Tu portada y presentación personal."],
  ["Portafolio", "Organiza tus mejores piezas", "Asigna fotos y videos a cada categoría de trabajo."],
  ["Audiencia", "Demuestra tu alcance", "Agrega las cifras que ayudan a una marca a tomar decisiones."],
  ["Tarifas", "Define tu oferta comercial", "Explica entregables, precios y derechos de uso."],
  ["Contacto", "Abre la conversación", "Deja claros tus canales, formatos y disponibilidad."],
  ["Publicar", "Comparte tu portafolio", "Elige tu enlace, revisa el resultado y publícalo."],
];
const categories = ["Campañas", "Cabello", "Beauty", "Familia", "Empresas", "Lugares", "Fotografía"];
const nicheOptions = ["Beauty", "Lifestyle", "Fashion", "Food", "Travel", "Fitness", "Tech", "Wellness", "Maternidad", "Hogar"];
const serviceOptions = ["Video UGC", "Fotografía UGC", "Reel colaborativo", "Historias", "Voice over", "Ads para redes", "Derechos de pauta"];
const contentOptions = ["Unboxings", "Vlogs", "ASMR", "Trends", "Testimonios", "Tutoriales", "Reseñas", "Storytelling"];
const includeOptions = ["Concepto creativo", "Guion estratégico", "Grabación", "Edición", "Formato vertical", "Subtítulos", "CTA", "Entrega de brutos"];
const clientOptions = ["Belleza", "Cuidado del cabello", "Skincare", "Maquillaje", "Hogar", "Familia", "Hoteles", "Restaurantes", "Productos"];
const colors = ["#c15f7a", "#f4a6b8", "#a9c8ff", "#b6dfc4", "#ffd6a5", "#a855f7", "#7c3cff", "#00d7ff", "#ff3dbb", "#d7ff2f"];
const fontOptions = [
  { name: "Editorial", value: "editorial", sample: "Aa", note: "Elegante y sofisticada" },
  { name: "Moderna", value: "modern", sample: "Ag", note: "Limpia y estratégica" },
  { name: "Romántica", value: "romantic", sample: "Ab", note: "Suave y femenina" },
  { name: "Magazine", value: "magazine", sample: "AA", note: "Impactante y expresiva" },
];
const templateOptions = [
  { name: "Gallery", note: "Revista crema · entrada suave", mode: "gallery", font: "Editorial", defaultFont: "editorial" },
  { name: "Studio Luv", note: "Cine berry · efecto telón", mode: "studio", font: "Romántica", defaultFont: "romantic" },
  { name: "Scrapbook", note: "Collage coral · ritmo artesanal", mode: "scrapbook", font: "Magazine", defaultFont: "magazine" },
  { name: "Art Director", note: "Brutalismo pop · cortes gráficos", mode: "art", font: "Magazine", defaultFont: "magazine" },
  { name: "Blue OS", note: "Tech azul · pulso digital", mode: "blue", font: "Moderna", defaultFont: "modern" },
  { name: "Whimsy", note: "Pop rosado · rebote juguetón", mode: "whimsy", font: "Romántica", defaultFont: "romantic" },
  { name: "Sage Journal", note: "Botánico suave · calma editorial", mode: "sage", font: "Editorial", defaultFont: "editorial" },
];
const websiteOptions = [
  { name: "Sunny Pop", note: "Colorida y divertida · stickers y color", mode: "pop", font: "Moderna", defaultFont: "modern" },
  { name: "Retro Zine", note: "Collage scrapbook · polaroids y cinta", mode: "retro", font: "Editorial", defaultFont: "editorial" },
  { name: "Éditorial Chic", note: "Elegante y profesional · aire de revista", mode: "chic", font: "Editorial", defaultFont: "editorial" },
  { name: "Neo Brutal", note: "Audaz y juvenil · bordes y sombras duras", mode: "bold", font: "Magazine", defaultFont: "magazine" },
  { name: "Creator Feed", note: "Perfil social · UGC nativo y piezas fijadas", mode: "feed", font: "Moderna", defaultFont: "modern" },
  { name: "Campaign Stories", note: "Casos editoriales · estrategia y resultados", mode: "stories", font: "Editorial", defaultFont: "editorial" },
  { name: "Personal Scrapbook", note: "Diario creativo · collage íntimo", mode: "personal", font: "Romántica", defaultFont: "romantic" },
  { name: "Showreel First", note: "Video protagonista · recorrido cinematográfico", mode: "showreel", font: "Moderna", defaultFont: "modern" },
  { name: "Talent Profile", note: "Perfil de agencia · lectura comercial", mode: "talent", font: "Editorial", defaultFont: "editorial" },
  { name: "Postcard Journal", note: "Bitácora viajera · lugares y descubrimientos", mode: "postcard", font: "Magazine", defaultFont: "magazine" },
];
export const templateSchemas: Record<string, TemplateSchema> = {
  gallery: { id: "gallery", format: "presentation", categoryLimit: 6, photoLimit: 5, portrait: true, contactVisual: true, label: "hasta 6 piezas por categoría" },
  studio: { id: "studio", format: "presentation", categoryLimit: 4, photoLimit: 4, portrait: true, contactVisual: true, label: "hasta 4 piezas por categoría" },
  scrapbook: { id: "scrapbook", format: "presentation", categoryLimit: 5, photoLimit: 5, portrait: true, contactVisual: true, label: "hasta 5 piezas por categoría" },
  art: { id: "art", format: "presentation", categoryLimit: 4, photoLimit: 4, portrait: true, contactVisual: true, label: "hasta 4 piezas por categoría" },
  blue: { id: "blue", format: "presentation", categoryLimit: 6, photoLimit: 5, portrait: true, contactVisual: true, label: "hasta 6 piezas por categoría" },
  whimsy: { id: "whimsy", format: "presentation", categoryLimit: 4, photoLimit: 4, portrait: true, contactVisual: true, label: "hasta 4 piezas por categoría" },
  sage: { id: "sage", format: "presentation", categoryLimit: 5, photoLimit: 5, portrait: true, contactVisual: true, label: "hasta 5 piezas por categoría" },
  muse: { id: "muse", format: "website", categoryLimit: 4, photoLimit: 4, portrait: true, contactVisual: false, label: "hasta 4 piezas por categoría" },
  creator: { id: "creator", format: "website", categoryLimit: 6, photoLimit: 6, portrait: true, contactVisual: false, label: "hasta 6 piezas por categoría" },
  aura: { id: "aura", format: "website", categoryLimit: 4, photoLimit: 4, portrait: true, contactVisual: false, label: "hasta 4 piezas por categoría" },
  noir: { id: "noir", format: "website", categoryLimit: 5, photoLimit: 5, portrait: true, contactVisual: false, label: "hasta 5 piezas por categoría" },
  sorbet: { id: "sorbet", format: "website", categoryLimit: 5, photoLimit: 5, portrait: true, contactVisual: false, label: "hasta 5 piezas por categoría" },
  lavender: { id: "lavender", format: "website", categoryLimit: 4, photoLimit: 6, portrait: true, contactVisual: false, label: "hasta 6 fotos y 4 videos por categoría" },
  mint: { id: "mint", format: "website", categoryLimit: 6, photoLimit: 5, portrait: true, contactVisual: false, label: "hasta 6 piezas por categoría" },
  electric: { id: "electric", format: "website", categoryLimit: 6, photoLimit: 6, portrait: true, contactVisual: false, label: "hasta 6 piezas por categoría" },
  pop: { id: "pop", format: "website", categoryLimit: 6, photoLimit: 6, portrait: true, contactVisual: false, label: "hasta 6 piezas por categoría" },
  retro: { id: "retro", format: "website", categoryLimit: 5, photoLimit: 5, portrait: true, contactVisual: false, label: "hasta 5 piezas por categoría" },
  chic: { id: "chic", format: "website", categoryLimit: 4, photoLimit: 6, portrait: true, contactVisual: false, label: "hasta 6 fotos y 4 videos por categoría" },
  bold: { id: "bold", format: "website", categoryLimit: 6, photoLimit: 6, portrait: true, contactVisual: false, label: "hasta 6 piezas por categoría" },
  feed: { id: "feed", format: "website", categoryLimit: 6, photoLimit: 6, portrait: true, contactVisual: false, label: "hasta 6 piezas por categoría" },
  stories: { id: "stories", format: "website", categoryLimit: 4, photoLimit: 4, portrait: true, contactVisual: false, label: "hasta 4 piezas por caso" },
  personal: { id: "personal", format: "website", categoryLimit: 6, photoLimit: 6, portrait: true, contactVisual: false, label: "hasta 6 piezas por categoría" },
  showreel: { id: "showreel", format: "website", categoryLimit: 8, photoLimit: 8, portrait: true, contactVisual: false, label: "hasta 8 piezas por categoría" },
  talent: { id: "talent", format: "website", categoryLimit: 6, photoLimit: 6, portrait: true, contactVisual: false, label: "hasta 6 piezas por categoría" },
  postcard: { id: "postcard", format: "website", categoryLimit: 5, photoLimit: 6, portrait: true, contactVisual: false, label: "hasta 6 fotos y 5 videos por categoría" },
};
const initial: Portfolio = {
  name: "Sofía Mendoza", title: "Creadora de Contenido UGC | Beauty, Lifestyle & Travel.",
  bio: "Creo contenido auténtico, cercano y estratégico que muestra procesos y resultados reales para generar confianza y conexión con la audiencia.",
  creativeDiary: "Me gusta comenzar cada idea observando cómo una persona usaría el producto en su vida real. Después convierto ese momento cotidiano en una historia sencilla, visual y fácil de recordar.", languages: "Español", caseStudies: {},
  location: "Bogotá, Colombia", niches: ["Beauty", "Lifestyle", "Travel"], format: "website", webTemplate: "pop", template: "gallery", fontStyle: "modern", accent: "#c15f7a", portfolioCategories: categories,
  campaignTitle: "Piezas UGC para campañas publicitarias", contentTypes: ["Unboxings", "Vlogs", "Testimonios", "Tutoriales"],
  clientTypes: ["Belleza", "Skincare", "Hogar", "Hoteles", "Productos"], services: ["Video UGC", "Fotografía UGC", "Reel colaborativo", "Historias"],
  includes: ["Concepto creativo", "Guion estratégico", "Grabación", "Edición", "Formato vertical"],
  followers: "50.5 mil", monthlyViews: "700.2 K", womenAudience: "82.9%", topCountries: "Colombia 79.2% · Estados Unidos 3.3% · México 3% · España 2.5%",
  videoRate: "$350.000 COP", collabRate: "$400.000 COP", storyRate: "$80.000 COP", storyPackRate: "$210.000 COP", usageRate: "$80.000 COP / mes",
  email: "hola@sofiaugc.com", whatsapp: "+57 314 722 5878", instagram: "@sofia.crea", tiktok: "@sofia.crea", availability: "Disponible para campañas y colaboraciones",
  notifyViews: false, metricSync: false, portfolioSlug: "sofia-mendoza",
};

function restorePortfolio(value: unknown): Portfolio {
  const stored = value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
  delete stored.password;
  delete stored.visibility;
  const caseStudies = stored.caseStudies && typeof stored.caseStudies === "object" && !Array.isArray(stored.caseStudies)
    ? stored.caseStudies as Record<string, CaseStudy>
    : initial.caseStudies;
  return { ...initial, ...stored, caseStudies } as Portfolio;
}

export default function CreatePortfolio() {
  return <PortfolioEditor />;
}

function PortfolioEditor() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Portfolio>(initial);
  const [media, setMedia] = useState<Media[]>([]);
  const [brands, setBrands] = useState<BrandAsset[]>([]);
  const [category, setCategory] = useState(categories[0]);
  const [saved, setSaved] = useState(true);
  const [finalView, setFinalView] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [publicationStatus, setPublicationStatus] = useState<"draft" | "published" | "unpublished">("draft");
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [slugState, setSlugState] = useState<SlugState>("idle");
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [views, setViews] = useState(0);
  const [notificationPreferenceExists, setNotificationPreferenceExists] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loginConsentChecked, setLoginConsentChecked] = useState(false);
  const [legalConsentRequired, setLegalConsentRequired] = useState(false);
  const [authenticatedConsentChecked, setAuthenticatedConsentChecked] = useState(false);
  const [legalReady, setLegalReady] = useState(false);
  const [legalBusy, setLegalBusy] = useState(false);
  const [legalError, setLegalError] = useState("");
  const [localDraftReady, setLocalDraftReady] = useState(false);
  const [localAssetsReady, setLocalAssetsReady] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudSaveState, setCloudSaveState] = useState<CloudSaveState>("local");
  const [cloudError, setCloudError] = useState("");
  const [assetUploads, setAssetUploads] = useState(0);
  const [assetProcessing, setAssetProcessing] = useState(0);
  const [assetError, setAssetError] = useState("");
  const dataRef = useRef(data);
  const localAssetsRef = useRef<StoredAsset[]>([]);
  const assetHydratedForRef = useRef("");
  const deletedAssetKeysRef = useRef(new Set<string>());
  const schema = templateSchemas[data.format === "website" ? data.webTemplate : data.template] ?? templateSchemas.pop;
  const portrait = media.find((item) => item.category === "__portrait") ?? null;
  const contactVisual = media.find((item) => item.category === "__contact") ?? null;
  const workMedia = media.filter((item) => !item.category.startsWith("__"));
  const published = publicationStatus === "published";

  useEffect(() => {
    const draft = window.localStorage.getItem(draftStorageKey);
    const timer = window.setTimeout(() => {
      if (draft) {
        try {
          const restored = restorePortfolio(JSON.parse(draft));
          dataRef.current = restored;
          setData(restored);
        } catch { /* keep defaults */ }
      }
      setLocalDraftReady(true);
      readAssets().then((assets) => {
        localAssetsRef.current = assets;
        setMedia(assets.filter((asset) => asset.kind === "media").map((asset) => ({ id: asset.id, name: asset.name, type: asset.type ?? "image", url: URL.createObjectURL(asset.blob), framed: asset.framed ?? false, category: asset.category ?? categories[0], instagram: asset.instagram ?? "", tiktok: asset.tiktok ?? "", storagePath: asset.storagePath, previewUrl: asset.previewBlob ? URL.createObjectURL(asset.previewBlob) : undefined, previewPath: asset.previewPath })));
        setBrands(assets.filter((asset) => asset.kind === "brand").map((asset) => ({ id: asset.id, name: asset.name, url: URL.createObjectURL(asset.blob), storagePath: asset.storagePath })));
      }).catch(() => { /* IndexedDB may be unavailable in private browsing */ }).finally(() => setLocalAssetsReady(true));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 680px)");
    if (!mobilePreviewOpen || !mobile.matches) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMobilePreviewOpen(false); };
    const closeOnDesktop = (event: MediaQueryListEvent) => { if (!event.matches) setMobilePreviewOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    mobile.addEventListener("change", closeOnDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      mobile.removeEventListener("change", closeOnDesktop);
    };
  }, [mobilePreviewOpen]);
  useEffect(() => { const timer = window.setTimeout(() => { window.localStorage.setItem(draftStorageKey, JSON.stringify(data)); setSaved(true); }, 450); return () => window.clearTimeout(timer); }, [data]);
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;
    const acceptUser = async (nextUser: User | null) => {
      if (!active) return;
      setUser(nextUser);
      if (!nextUser) {
        setCheckingAuth(false);
        setLegalReady(false);
        setLegalConsentRequired(false);
        setCloudReady(false);
        setCloudSaveState("local");
        assetHydratedForRef.current = "";
        return;
      }

      const consent = await resolveCurrentLegalConsent(supabase, nextUser.id);
      if (!active) return;
      setCheckingAuth(false);
      if (!consent.accepted) {
        setLegalReady(false);
        setLegalConsentRequired(true);
        setLegalError(consent.error ? "No pudimos comprobar tu autorización. Revisa tu conexión e inténtalo nuevamente." : "");
        setCloudReady(false);
        setAuthPromptOpen(false);
        return;
      }

      setLegalReady(true);
      setLegalConsentRequired(false);
      setLegalError("");
      const pendingStep = Number(window.localStorage.getItem(pendingStepStorageKey));
      if (Number.isInteger(pendingStep) && pendingStep >= 2 && pendingStep < steps.length) setStep(pendingStep);
      window.localStorage.removeItem(pendingStepStorageKey);
      setAuthPromptOpen(false);
    };
    void supabase.auth.getUser().then(({ data: authData }) => { void acceptUser(authData.user ?? null); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { void acceptUser(session?.user ?? null); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!user || !legalReady || !localDraftReady) return;
    let active = true;
    const hydratePortfolio = async () => {
      setCloudSaveState("loading");
      setCloudError("");
      const supabase = getSupabaseBrowserClient();
      const [portfolioResult, analyticsResult, preferencesResult] = await Promise.all([
        supabase
          .from("creator_portfolios")
          .select("content,status")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.rpc("get_my_portfolio_analytics"),
        supabase
          .from("creator_notification_preferences")
          .select("email_digest_enabled")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      const { data: stored, error } = portfolioResult;

      if (!active) return;
      if (error) {
        setCloudSaveState("error");
        setCloudError("No pudimos recuperar tu portafolio. El borrador sigue seguro en este dispositivo.");
        return;
      }

      const localMustWin = window.localStorage.getItem(draftUploadPendingKey) === "1";
      const remoteContent = stored?.content;
      const hasRemoteContent = Boolean(remoteContent) && typeof remoteContent === "object" && !Array.isArray(remoteContent) && Object.keys(remoteContent as object).length > 0;
      const notificationEnabled = preferencesResult.data?.email_digest_enabled === true;
      setNotificationPreferenceExists(Boolean(preferencesResult.data));
      if (!analyticsResult.error && analyticsResult.data && typeof analyticsResult.data === "object") {
        setViews(Number((analyticsResult.data as { total_views?: unknown }).total_views) || 0);
      }

      if (hasRemoteContent && !localMustWin) {
        const restored = { ...restorePortfolio(remoteContent), notifyViews: notificationEnabled };
        dataRef.current = restored;
        setData(restored);
        setPublicationStatus(stored?.status === "published" ? "published" : stored?.status === "unpublished" ? "unpublished" : "draft");
        window.localStorage.setItem(draftStorageKey, JSON.stringify(restored));
      } else {
        const localDraft = { ...dataRef.current, notifyViews: notificationEnabled };
        dataRef.current = localDraft;
        setData(localDraft);
        const draftPayload = {
          content: localDraft,
          status: stored?.status === "published" ? "published" : stored?.status === "unpublished" ? "unpublished" : "draft",
          slug: localDraft.portfolioSlug || null,
        };
        const { error: uploadError } = stored
          ? await supabase.from("creator_portfolios").update(draftPayload).eq("user_id", user.id)
          : await supabase.from("creator_portfolios").insert({ user_id: user.id, ...draftPayload });
        if (!active) return;
        if (uploadError) {
          setCloudSaveState("error");
          setCloudError("No pudimos subir el borrador. Sigue guardado en este dispositivo.");
          return;
        }
        window.localStorage.removeItem(draftUploadPendingKey);
      }

      setCloudReady(true);
      setCloudSaveState("saved");
    };

    void hydratePortfolio();
    return () => { active = false; };
  }, [user, legalReady, localDraftReady]);
  useEffect(() => {
    if (!user || !cloudReady) return;
    const timer = window.setTimeout(async () => {
      setCloudSaveState("loading");
      setCloudError("");
      const supabase = getSupabaseBrowserClient();
      const [{ error: portfolioError }, { error: profileError }] = await Promise.all([
        supabase.from("creator_portfolios").update({
          content: data,
          status: publicationStatus,
          slug: data.portfolioSlug || null,
        }).eq("user_id", user.id),
        data.name.trim()
          ? supabase.from("creator_profiles").update({ display_name: data.name.trim().slice(0, 100) }).eq("id", user.id)
          : Promise.resolve({ error: null }),
      ]);
      if (portfolioError || profileError) {
        setCloudSaveState("error");
        setCloudError("No pudimos sincronizar los últimos cambios. El borrador local sigue disponible.");
        return;
      }
      setCloudSaveState("saved");
    }, 850);
    return () => window.clearTimeout(timer);
  }, [data, publicationStatus, user, cloudReady]);

  useEffect(() => {
    const slug = data.portfolioSlug;
    const timer = window.setTimeout(async () => {
      if (!validPortfolioSlug(slug)) {
        setSlugState("invalid");
        return;
      }
      if (!user || !cloudReady) {
        setSlugState("idle");
        return;
      }
      setSlugState("checking");
      const { data: available, error } = await getSupabaseBrowserClient().rpc("is_portfolio_slug_available", { requested_slug: slug });
      if (error) {
        setSlugState("idle");
        return;
      }
      setSlugState(available ? "available" : "taken");
    }, 350);
    return () => window.clearTimeout(timer);
  }, [data.portfolioSlug, user, cloudReady]);

  useEffect(() => {
    if (!user || !cloudReady || !localAssetsReady || assetHydratedForRef.current === user.id) return;
    assetHydratedForRef.current = user.id;
    let active = true;

    const hydrateAssets = async () => {
      const supabase = getSupabaseBrowserClient();
      setAssetError("");
      const { error: readError } = await supabase
        .from("creator_media")
        .select("asset_id,kind,storage_path,preview_path,original_name,media_type,category,framed,instagram,tiktok,sort_order,size_bytes,mime_type")
        .order("sort_order", { ascending: true });

      if (!active) return;
      if (readError) {
        assetHydratedForRef.current = "";
        setAssetError("No pudimos recuperar tus archivos de Brilla. Los archivos de este dispositivo siguen disponibles.");
        return;
      }

      const pendingLocal = localAssetsRef.current.filter((asset) => !asset.storagePath);
      const validPending = pendingLocal.filter((asset) => {
        const problem = validateAssetFile({ name: asset.name, type: asset.blob.type, size: asset.blob.size }, asset.kind);
        if (problem) setAssetError(`No migramos ${asset.name}: ${problem}`);
        return !problem;
      });

      if (validPending.length) {
        setAssetUploads((count) => count + validPending.length);
        await Promise.all(validPending.map(async (asset, index) => {
          try {
            if (asset.kind === "media" && !asset.previewBlob) asset.previewBlob = await createAssetPreview(asset.blob, asset.type ?? "image");
            const { path, previewPath } = await uploadStoredAsset(user.id, asset, index, asset.storagePath, asset.previewPath);
            asset.storagePath = path;
            asset.previewPath = previewPath;
            await updateStoredAsset(asset.kind, asset.id, { storagePath: path, previewBlob: asset.previewBlob, previewPath });
          } catch {
            setAssetError(`No pudimos subir ${asset.name}. Permanece guardado en este dispositivo.`);
          } finally {
            setAssetUploads((count) => Math.max(0, count - 1));
          }
        }));
      }

      const { data: refreshedRows, error: refreshError } = await supabase
        .from("creator_media")
        .select("asset_id,kind,storage_path,preview_path,original_name,media_type,category,framed,instagram,tiktok,sort_order,size_bytes,mime_type")
        .order("sort_order", { ascending: true });
      if (!active) return;
      if (refreshError) {
        assetHydratedForRef.current = "";
        setAssetError("Los archivos se guardaron, pero no pudimos actualizar la vista previa.");
        return;
      }

      const refreshedAssets = (refreshedRows ?? []) as RemoteAsset[];
      const signedRows = (await Promise.all(refreshedAssets.map(async (row) => {
        try {
          const [url, previewUrl] = await Promise.all([
            signedAssetUrl(row.storage_path),
            row.preview_path ? signedAssetUrl(row.preview_path).catch(() => undefined) : Promise.resolve(undefined),
          ]);
          return { row, url, previewUrl };
        }
        catch { return null; }
      }))).filter((entry): entry is { row: RemoteAsset; url: string; previewUrl: string | undefined } => Boolean(entry));
      const signedKeys = new Set(signedRows.map(({ row }) => `${row.kind}:${row.asset_id}`));
      const remoteKeys = new Set(refreshedAssets.map((row) => `${row.kind}:${row.asset_id}`));
      const staleLocalAssets = localAssetsRef.current.filter((asset) => asset.storagePath && !remoteKeys.has(`${asset.kind}:${asset.id}`));
      if (staleLocalAssets.length) {
        localAssetsRef.current = localAssetsRef.current.filter((asset) => !staleLocalAssets.includes(asset));
        await Promise.all(staleLocalAssets.map((asset) => deleteAsset(asset.kind, asset.id).catch(() => {})));
      }

      setMedia((current) => {
        const remoteMedia: Media[] = signedRows.filter(({ row }) => row.kind === "media").map(({ row, url, previewUrl }) => ({
          id: row.asset_id,
          name: row.original_name,
          type: row.media_type,
          url,
          framed: row.framed,
          category: row.category || categories[0],
          instagram: row.instagram,
          tiktok: row.tiktok,
          storagePath: row.storage_path,
          previewUrl,
          previewPath: row.preview_path ?? undefined,
        }));
        return [...remoteMedia, ...current.filter((item) => {
          const key = `media:${item.id}`;
          return !signedKeys.has(key) && (!item.storagePath || (remoteKeys.has(key) && item.url.startsWith("blob:")));
        })];
      });
      setBrands((current) => {
        const remoteBrands: BrandAsset[] = signedRows.filter(({ row }) => row.kind === "brand").map(({ row, url }) => ({ id: row.asset_id, name: row.original_name, url, storagePath: row.storage_path }));
        return [...remoteBrands, ...current.filter((item) => {
          const key = `brand:${item.id}`;
          return !signedKeys.has(key) && (!item.storagePath || (remoteKeys.has(key) && item.url.startsWith("blob:")));
        })];
      });
    };

    void hydrateAssets();
    return () => {
      active = false;
      if (assetHydratedForRef.current === user.id) assetHydratedForRef.current = "";
    };
  }, [user, cloudReady, localAssetsReady]);

  const update = (field: keyof Portfolio, value: string | string[]) => { setSaved(false); setData((current) => ({ ...current, [field]: value })); };
  const updateCaseStudy = (field: keyof CaseStudy, value: string) => {
    const activeCategory = data.portfolioCategories.includes(category) ? category : data.portfolioCategories[0] ?? categories[0];
    setSaved(false);
    setData((current) => ({
      ...current,
      caseStudies: {
        ...current.caseStudies,
        [activeCategory]: {
          ...(current.caseStudies[activeCategory] ?? { client: "", brief: "", hook: "", result: "", testimonial: "" }),
          [field]: value,
        },
      },
    }));
  };
  const toggle = (field: "niches" | "services" | "contentTypes" | "clientTypes" | "includes" | "portfolioCategories", value: string) => update(field, data[field].includes(value) ? data[field].filter((item) => item !== value) : [...data[field], value]);
  const rememberLocalAsset = (asset: StoredAsset) => {
    localAssetsRef.current = [...localAssetsRef.current.filter((item) => item.kind !== asset.kind || item.id !== asset.id), asset];
    void storeAsset(asset).catch(() => setAssetError("Este navegador no pudo crear el respaldo local del archivo."));
  };
  const deleteRemoteAsset = async (kind: "media" | "brand", id: number, storagePath?: string, previewPath?: string) => {
    if (!user || !cloudReady) return;
    const supabase = getSupabaseBrowserClient();
    const paths = [storagePath, previewPath].filter((path): path is string => Boolean(path));
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from(creatorMediaBucket).remove(paths);
      if (storageError) throw storageError;
    }
    const { error: metadataError } = await supabase.from("creator_media").delete().eq("user_id", user.id).eq("asset_id", id).eq("kind", kind);
    if (metadataError) throw metadataError;
  };
  const syncLocalAsset = async (asset: StoredAsset, sortOrder: number, previousPath?: string, previousPreviewPath?: string) => {
    if (!user || !cloudReady) return;
    const key = `${asset.kind}:${asset.id}`;
    deletedAssetKeysRef.current.delete(key);
    setAssetUploads((count) => count + 1);
    try {
      const { path, previewPath } = await uploadStoredAsset(user.id, asset, sortOrder, previousPath, previousPreviewPath);
      if (deletedAssetKeysRef.current.has(key)) {
        await deleteRemoteAsset(asset.kind, asset.id, path, previewPath);
        return;
      }
      asset.storagePath = path;
      asset.previewPath = previewPath;
      localAssetsRef.current = localAssetsRef.current.map((item) => item.kind === asset.kind && item.id === asset.id ? { ...item, storagePath: path, previewPath } : item);
      await updateStoredAsset(asset.kind, asset.id, { storagePath: path, previewPath });
      if (asset.kind === "media") setMedia((current) => current.map((item) => item.id === asset.id ? { ...item, storagePath: path, previewPath } : item));
      else setBrands((current) => current.map((item) => item.id === asset.id ? { ...item, storagePath: path } : item));
    } catch {
      setAssetError(`No pudimos subir ${asset.name}. Permanece guardado en este dispositivo.`);
    } finally {
      setAssetUploads((count) => Math.max(0, count - 1));
    }
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    setAssetError("");
    const targetCategory = data.portfolioCategories.includes(category) ? category : data.portfolioCategories[0] ?? categories[0];
    const limit = targetCategory === "Fotografía" ? schema.photoLimit : schema.categoryLimit;
    const available = Math.max(0, limit - workMedia.filter((item) => item.category === targetCategory).length);
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    const validFiles = selectedFiles.filter((file) => {
      const problem = validateAssetFile(file, "media");
      if (problem) setAssetError(problem);
      return !problem;
    }).slice(0, available);
    if (selectedFiles.length > validFiles.length && validFiles.length === available) setAssetError(`Esta plantilla permite ${limit} piezas en “${targetCategory}”.`);
    setAssetProcessing((count) => count + validFiles.length);
    const prepared = await Promise.all(validFiles.map(async (file) => {
      const type = file.type.startsWith("video") ? "video" as const : "image" as const;
      const blob = type === "image" ? await optimizeUploadFile(file) : file;
      const previewBlob = await createAssetPreview(blob, type);
      return { file, blob, previewBlob, type };
    }));
    setAssetProcessing((count) => Math.max(0, count - validFiles.length));
    const additions = prepared.map(({ file, blob, previewBlob, type }, index): Media => ({ id: Date.now() * 100 + index, name: file.name, type, url: URL.createObjectURL(blob), previewUrl: previewBlob ? URL.createObjectURL(previewBlob) : undefined, framed: type === "video", category: targetCategory, instagram: "", tiktok: "" }));
    setMedia((current) => [...current, ...additions]);
    additions.forEach((item, index) => {
      const stored: StoredAsset = { id: item.id, kind: "media", name: item.name, blob: prepared[index].blob, previewBlob: prepared[index].previewBlob, type: item.type, framed: item.framed, category: item.category, instagram: item.instagram, tiktok: item.tiktok };
      rememberLocalAsset(stored);
      void syncLocalAsset(stored, workMedia.length + index);
    });
  };
  const uploadSpecial = async (slot: "__portrait" | "__contact", event: ChangeEvent<HTMLInputElement>) => {
    setAssetError("");
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const problem = validateAssetFile(file, "media");
    if (problem) { setAssetError(problem); return; }
    setAssetProcessing((count) => count + 1);
    const type = file.type.startsWith("video") ? "video" as const : "image" as const;
    const blob = type === "image" ? await optimizeUploadFile(file) : file;
    const previewBlob = await createAssetPreview(blob, type);
    setAssetProcessing((count) => Math.max(0, count - 1));
    const previous = media.find((asset) => asset.category === slot);
    if (previous?.url.startsWith("blob:")) URL.revokeObjectURL(previous.url);
    if (previous?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previous.previewUrl);
    const item: Media = { id: slot === "__portrait" ? -1 : -2, name: file.name, type, url: URL.createObjectURL(blob), previewUrl: previewBlob ? URL.createObjectURL(previewBlob) : undefined, framed: false, category: slot, instagram: "", tiktok: "" };
    const stored: StoredAsset = { id: item.id, kind: "media", name: item.name, blob, previewBlob, type: item.type, framed: false, category: slot, instagram: "", tiktok: "" };
    setMedia((current) => [...current.filter((asset) => asset.category !== slot), item]);
    rememberLocalAsset(stored);
    void syncLocalAsset(stored, slot === "__portrait" ? 0 : 1, previous?.storagePath, previous?.previewPath);
  };
  const updateMedia = (id: number, field: "instagram" | "tiktok" | "framed", value: string | boolean) => {
    setMedia((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
    localAssetsRef.current = localAssetsRef.current.map((item) => item.kind === "media" && item.id === id ? { ...item, [field]: value } : item);
    void updateStoredAsset("media", id, { [field]: value }).catch(() => {});
    if (user && cloudReady) {
      void getSupabaseBrowserClient().from("creator_media").update({ [field]: value }).eq("user_id", user.id).eq("asset_id", id).then(({ error }) => {
        if (error) setAssetError("No pudimos sincronizar la configuración de este video.");
      });
    }
  };
  const remove = (id: number) => {
    const item = media.find((asset) => asset.id === id);
    deletedAssetKeysRef.current.add(`media:${id}`);
    setMedia((current) => current.filter((asset) => { if (asset.id === id && asset.url.startsWith("blob:")) URL.revokeObjectURL(asset.url); return asset.id !== id; }));
    if (item?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
    localAssetsRef.current = localAssetsRef.current.filter((asset) => asset.kind !== "media" || asset.id !== id);
    void deleteAsset("media", id).catch(() => {});
    void deleteRemoteAsset("media", id, item?.storagePath, item?.previewPath).catch(() => setAssetError("Quitamos el archivo de la vista, pero no pudimos eliminar su copia en Brilla."));
  };
  const uploadBrands = async (event: ChangeEvent<HTMLInputElement>) => {
    setAssetError("");
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    const validFiles = selectedFiles.filter((file) => {
      const problem = validateAssetFile(file, "brand");
      if (problem) setAssetError(problem);
      return !problem;
    });
    setAssetProcessing((count) => count + validFiles.length);
    const optimizedFiles = await Promise.all(validFiles.map((file) => optimizeUploadFile(file)));
    setAssetProcessing((count) => Math.max(0, count - validFiles.length));
    const additions = validFiles.map((file, index): BrandAsset => ({ id: Date.now() * 100 + index, name: file.name.replace(/\.[^.]+$/, ""), url: URL.createObjectURL(optimizedFiles[index]) }));
    setBrands((current) => [...current, ...additions]);
    additions.forEach((item, index) => {
      const stored: StoredAsset = { id: item.id, kind: "brand", name: item.name, blob: optimizedFiles[index], type: "image" };
      rememberLocalAsset(stored);
      void syncLocalAsset(stored, brands.length + index);
    });
  };
  const removeBrand = (id: number) => {
    const item = brands.find((asset) => asset.id === id);
    deletedAssetKeysRef.current.add(`brand:${id}`);
    setBrands((current) => current.filter((asset) => { if (asset.id === id && asset.url.startsWith("blob:")) URL.revokeObjectURL(asset.url); return asset.id !== id; }));
    localAssetsRef.current = localAssetsRef.current.filter((asset) => asset.kind !== "brand" || asset.id !== id);
    void deleteAsset("brand", id).catch(() => {});
    void deleteRemoteAsset("brand", id, item?.storagePath).catch(() => setAssetError("Quitamos el logo de la vista, pero no pudimos eliminar su copia en Brilla."));
  };
  const openPortfolio = () => setFinalView(true);
  const downloadPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    setPublishError("");
    try {
      const { downloadPortfolioPdf } = await import("./portfolio-pdf");
      await downloadPortfolioPdf(data, media, brands);
    } catch {
      setPublishError("No pudimos crear el PDF. Revisa que tus imágenes sigan disponibles e inténtalo nuevamente.");
    } finally {
      setPdfBusy(false);
    }
  };
  const syncMetrics = () => { setSyncing(true); window.setTimeout(() => { setData((current) => ({ ...current, metricSync: true })); setSyncing(false); }, 900); };
  const saveViewNotifications = async (value: boolean) => {
    setData((current) => ({ ...current, notifyViews: value }));
    if (!user) return;
    setNotificationBusy(true);
    setPublishError("");
    const supabase = getSupabaseBrowserClient();
    const result = notificationPreferenceExists
      ? await supabase.from("creator_notification_preferences").update({ email_digest_enabled: value }).eq("user_id", user.id)
      : await supabase.from("creator_notification_preferences").insert({ user_id: user.id, email_digest_enabled: value, digest_frequency: "weekly" });
    if (result.error) {
      setData((current) => ({ ...current, notifyViews: !value }));
      setPublishError("No pudimos guardar tu preferencia de actividad. Inténtalo nuevamente.");
    } else setNotificationPreferenceExists(true);
    setNotificationBusy(false);
  };
  const copyLink = async () => { const link = `${window.location.origin}/${data.portfolioSlug}`; await navigator.clipboard?.writeText(link); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  const updateSlug = (value: string) => {
    setPublishError("");
    if (published) setPublicationStatus("draft");
    update("portfolioSlug", normalizePortfolioSlug(value));
  };
  const publish = async () => {
    setPublishError("");
    if (!user || !cloudReady) {
      setPublishError("Necesitamos terminar de conectar tu cuenta antes de publicar.");
      return;
    }
    if (!validPortfolioSlug(data.portfolioSlug)) {
      setSlugState("invalid");
      setPublishError("Elige un enlace de 3 a 80 caracteres, sin espacios ni palabras reservadas.");
      return;
    }
    if (assetProcessing || assetUploads) {
      setPublishError("Espera a que terminemos de preparar y subir tus archivos.");
      return;
    }
    setPublishBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { data: available, error: availabilityError } = await supabase.rpc("is_portfolio_slug_available", { requested_slug: data.portfolioSlug });
    if (availabilityError || !available) {
      setSlugState(availabilityError ? "idle" : "taken");
      setPublishError(availabilityError ? "No pudimos validar el enlace. Inténtalo nuevamente." : "Ese enlace ya pertenece a otra creadora. Prueba una variación.");
      setPublishBusy(false);
      return;
    }
    const previousStatus = publicationStatus;
    setPublicationStatus("published");
    const { error } = await supabase.from("creator_portfolios").update({ content: data, status: "published", slug: data.portfolioSlug }).eq("user_id", user.id);
    if (error) {
      setPublicationStatus(previousStatus);
      setPublishError(error.code === "23505" ? "Ese enlace acaba de ser elegido. Prueba una variación." : "No pudimos publicar todavía. Tu trabajo sigue guardado.");
      if (error.code === "23505") setSlugState("taken");
      setPublishBusy(false);
      return;
    }
    setCloudSaveState("saved");
    setSlugState("available");
    window.localStorage.setItem("brilla-published-v1", JSON.stringify({ slug: data.portfolioSlug, publishedAt: new Date().toISOString() }));
    setPublishBusy(false);
  };
  const unpublish = async () => {
    if (!user || !cloudReady) return;
    setPublishBusy(true);
    setPublishError("");
    setPublicationStatus("unpublished");
    const { error } = await getSupabaseBrowserClient().from("creator_portfolios").update({ status: "unpublished" }).eq("user_id", user.id);
    if (error) {
      setPublicationStatus("published");
      setPublishError("No pudimos despublicarlo. Inténtalo nuevamente.");
    }
    else {
      setCloudSaveState("saved");
      window.localStorage.removeItem("brilla-published-v1");
    }
    setPublishBusy(false);
  };
  const requestStep = (nextStep: number) => {
    if (nextStep <= 1 || (user && legalReady)) { setStep(nextStep); return; }
    if (user && !legalReady) { setLegalConsentRequired(true); return; }
    if (step < 1) { setStep(1); return; }
    window.localStorage.setItem(draftStorageKey, JSON.stringify(data));
    window.localStorage.setItem(pendingStepStorageKey, String(nextStep));
    setSaved(true);
    setAuthError("");
    setAuthPromptOpen(true);
  };
  const continueWithGoogle = async () => {
    if (!loginConsentChecked) {
      setAuthError("Debes autorizar el tratamiento de datos y aceptar los Términos antes de continuar.");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    markLegalConsentPending();
    rememberAuthRedirect("/crear");
    window.localStorage.setItem(draftStorageKey, JSON.stringify(data));
    window.localStorage.setItem(draftUploadPendingKey, "1");
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${authRedirectOrigin()}/crear` },
    });
    if (error) {
      clearPendingLegalConsent();
      setAuthError(error.message.toLowerCase().includes("provider") ? "El acceso con Google todavía no está habilitado. Inténtalo nuevamente en unos minutos." : "No pudimos abrir Google. Inténtalo nuevamente.");
      setAuthBusy(false);
    }
  };
  const acceptAuthenticatedConsent = async () => {
    if (!user || !authenticatedConsentChecked) return;
    setLegalBusy(true);
    setLegalError("");
    const result = await recordCurrentLegalConsent(getSupabaseBrowserClient(), user.id, "authenticated_prompt");
    if (!result.accepted) {
      setLegalError("No pudimos guardar tu autorización. Revisa tu conexión e inténtalo nuevamente.");
    } else {
      setLegalReady(true);
      setLegalConsentRequired(false);
      setAuthenticatedConsentChecked(false);
      const pendingStep = Number(window.localStorage.getItem(pendingStepStorageKey));
      if (Number.isInteger(pendingStep) && pendingStep >= 2 && pendingStep < steps.length) setStep(pendingStep);
      window.localStorage.removeItem(pendingStepStorageKey);
    }
    setLegalBusy(false);
  };
  const declineAuthenticatedConsent = async () => {
    setLegalBusy(true);
    await getSupabaseBrowserClient().auth.signOut({ scope: "local" });
    clearPendingLegalConsent();
    setUser(null);
    setLegalReady(false);
    setLegalConsentRequired(false);
    setAuthenticatedConsentChecked(false);
    setLegalError("");
    setCloudReady(false);
    setCloudSaveState("local");
    setLegalBusy(false);
  };
  if (user && legalConsentRequired) return <main className="builderApp"><LegalConsentGate checked={authenticatedConsentChecked} busy={legalBusy} error={legalError} onCheckedChange={setAuthenticatedConsentChecked} onAccept={() => void acceptAuthenticatedConsent()} onSignOut={() => void declineAuthenticatedConsent()} /></main>;
  if (finalView) return <main className="finalDeckMode"><div className="portfolioToolbar"><button onClick={() => setFinalView(false)}>← Editor</button><span>{published ? "↗ Publicado" : "◉ Vista previa"}</span><button onClick={published ? copyLink : () => { setFinalView(false); setStep(6); }}>{published ? copied ? "Copiado ✓" : "Copiar enlace" : "Ir a publicar"}</button><button onClick={() => void downloadPdf()} disabled={pdfBusy}>{pdfBusy ? "Creando PDF…" : "Descargar PDF"}</button></div>{publishError && <p className="publishError finalPdfError" role="alert">{publishError}</p>}{data.format === "website" ? <WebsitePortfolio data={data} media={media} brands={brands} schema={schema} expanded /> : <PortfolioDeck data={data} media={media} brands={brands} schema={schema} expanded />}</main>;

  const statusLabel = assetProcessing > 0
    ? assetProcessing === 1 ? "Preparando 1 archivo…" : `Preparando ${assetProcessing} archivos…`
    : assetUploads > 0
    ? assetUploads === 1 ? "Subiendo 1 archivo…" : `Subiendo ${assetUploads} archivos…`
    : checkingAuth
    ? "Comprobando cuenta…"
    : user
      ? cloudSaveState === "saved" ? "Guardado en Brilla" : cloudSaveState === "error" ? "Guardado en este dispositivo" : "Sincronizando…"
      : saved ? "Guardado en este dispositivo" : "Guardando en este dispositivo…";
  const statusTone = assetProcessing > 0 || assetUploads > 0 || checkingAuth || (user && cloudSaveState === "loading") || (!user && !saved)
    ? "saving"
    : user && cloudSaveState === "error" ? "error" : "saved";
  const statusHelp = assetError || cloudError || (!checkingAuth && !user ? "Inicia sesión para sincronizar tu progreso con Brilla." : "");

  return <main className="builderApp">
    <header className="builderTopbar"><a className="builderBrand" href="/">brilla<span>•</span></a><div className="builderStatus" title={statusHelp}><i className={statusTone} />{statusLabel}</div><div className="builderTopActions"><a href="/cuenta">{checkingAuth ? "Cuenta" : user ? "Cuenta conectada ✓" : "Iniciar sesión"}</a><button className="previewAction" onClick={() => openPortfolio()}>Ver portafolio ↗</button><button className="mobilePreviewLauncher" type="button" aria-expanded={mobilePreviewOpen} onClick={() => setMobilePreviewOpen(true)}><span aria-hidden="true">◉</span> Vista previa</button></div></header>
    <div className="builderGrid">
      <aside className="builderSidebar"><p>TU PORTAFOLIO</p><nav aria-label="Secciones del editor">{steps.map((item, index) => <button key={item[0]} className={index === step ? "current" : index < step ? "done" : ""} onClick={() => requestStep(index)}><span>{index < step ? "✓" : String(index + 1).padStart(2, "0")}</span><div><small>PASO {String(index + 1).padStart(2, "0")}</small><strong>{item[0]}</strong></div></button>)}</nav><div className="sidebarTip"><b>✦</b><p><strong>Todo incluido</strong>Web, video, métricas, alertas y PDF. Siempre gratis.</p></div></aside>
      <section className="builderFormArea">
        <div className="mobileProgress"><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
        <div className="formHeading"><span>{String(step + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</span><h1>{steps[step][1]}</h1><p>{steps[step][2]}</p></div>
        {assetError && <div className="assetSyncNotice" role="alert"><span>!</span><p>{assetError}</p><button type="button" onClick={() => setAssetError("")} aria-label="Cerrar aviso">×</button></div>}
        {step === 2 && data.format === "website" && data.webTemplate === "stories" && data.portfolioCategories.length > 0 && <div className="formPanel"><div className="schemaSummary"><span>✎</span><p><strong>Historia del caso · {data.portfolioCategories.includes(category) ? category : data.portfolioCategories[0]}</strong><small>Convierte esta categoría en un caso de campaña. Puedes dejar vacío lo que aún no tengas.</small></p></div><Field label="Marca o cliente" value={(data.caseStudies[data.portfolioCategories.includes(category) ? category : data.portfolioCategories[0]] ?? { client: "" }).client} set={(v) => updateCaseStudy("client", v)} placeholder="Nombre de la marca" /><TextArea label="Brief de la marca" value={(data.caseStudies[data.portfolioCategories.includes(category) ? category : data.portfolioCategories[0]] ?? { brief: "" }).brief} set={(v) => updateCaseStudy("brief", v)} /><Field label="Hook de apertura" value={(data.caseStudies[data.portfolioCategories.includes(category) ? category : data.portfolioCategories[0]] ?? { hook: "" }).hook} set={(v) => updateCaseStudy("hook", v)} placeholder="La primera frase del video" /><TextArea label="Resultado" value={(data.caseStudies[data.portfolioCategories.includes(category) ? category : data.portfolioCategories[0]] ?? { result: "" }).result} set={(v) => updateCaseStudy("result", v)} /><TextArea label="Testimonio" value={(data.caseStudies[data.portfolioCategories.includes(category) ? category : data.portfolioCategories[0]] ?? { testimonial: "" }).testimonial} set={(v) => updateCaseStudy("testimonial", v)} /></div>}
        {step === 1 && <div className="formPanel"><AssetSlot title="Retrato principal" text="Aparece en la portada de todas las plantillas." media={portrait} accept="image/*,video/*" onChange={(event) => uploadSpecial("__portrait", event)} onRemove={() => portrait && remove(portrait.id)} /><Field label="Nombre público" value={data.name} set={(v) => update("name", v)} placeholder="Tu nombre" /><Field label="Título profesional" value={data.title} set={(v) => update("title", v)} placeholder="Creadora UGC | Beauty & Lifestyle" /><TextArea label="Sobre ti" value={data.bio} set={(v) => update("bio", v)} />{data.format === "website" && ["personal", "postcard"].includes(data.webTemplate) && <TextArea label="Así creo contenido · entrada de diario" value={data.creativeDiary} set={(v) => update("creativeDiary", v)} />}{data.format === "website" && data.webTemplate === "talent" && <Field label="Idiomas" value={data.languages} set={(v) => update("languages", v)} placeholder="Español · Inglés" />}<Field label="Ubicación" value={data.location} set={(v) => update("location", v)} placeholder="Ciudad, País" /><Choice title="Nichos principales" options={nicheOptions} selected={data.niches} toggle={(v) => toggle("niches", v)} /></div>}
        {step === 0 && <div className="formPanel"><div className="choiceField templateFamily"><span>Plantillas de página web <small>{websiteOptions.length} estilos profesionales</small></span><p>Sitios verticales con navegación, secciones y transiciones suaves.</p><div className="themeCards webThemeCards">{websiteOptions.map((item) => <Theme key={item.mode} {...item} current={data.format === "website" ? data.webTemplate : ""} choose={(mode, fontStyle) => setData((current) => ({ ...current, format: "website", webTemplate: mode, fontStyle }))} />)}</div></div><div className="templateDivider"><span>O ELIGE UNA EXPERIENCIA PRESENTACIONAL</span></div><div className="choiceField templateFamily"><span>Plantillas presentacionales <small>7 estilos</small></span><p>Láminas horizontales con navegación por gestos y flechas.</p><div className="themeCards">{templateOptions.map((item) => <Theme key={item.mode} {...item} current={data.format === "presentation" ? data.template : ""} choose={(mode, fontStyle) => setData((current) => ({ ...current, format: "presentation", template: mode, fontStyle }))} />)}</div></div><div className="choiceField"><span>Tipo de letra</span><div className="fontCards">{fontOptions.map((font) => <button key={font.value} className={data.fontStyle === font.value ? "selected" : ""} onClick={() => update("fontStyle", font.value)}><b>{font.sample}</b><span>{font.name}</span><small>{font.note}</small></button>)}</div></div><div className="choiceField colorChoice"><span>Color de acento del portafolio</span><div>{colors.map((color) => <button key={color} aria-label={`Elegir ${color}`} className={data.accent === color ? "selected" : ""} style={{ background: color }} onClick={() => update("accent", color)} />)}<label><input aria-label="Color personalizado" type="color" value={data.accent} onChange={(e) => update("accent", e.target.value)} />＋</label></div></div></div>}
        {step === 2 && <div className="formPanel"><div className="schemaSummary"><span>✦</span><p><strong>{schema.id.replace("gallery", "Gallery").replace("studio", "Studio Luv").replace("scrapbook", "Scrapbook").replace("art", "Art Director").replace("blue", "Blue OS").replace("whimsy", "Whimsy").replace("sage", "Sage Journal").replace("muse", "Muse Editorial").replace("creator", "Creator Studio").replace("aura", "Aura Grid").replace("noir", "Noir Atelier").replace("sorbet", "Sorbet Studio").replace("lavender", "Lavender Cloud").replace("mint", "Mint Picnic").replace("electric", "Electric Pulse").replace("pop", "Sunny Pop").replace("retro", "Retro Zine").replace("chic", "Éditorial Chic").replace("bold", "Neo Brutal")}</strong><small>{schema.label}. El formulario respeta su composición.</small></p></div><Field label="Título de campañas" value={data.campaignTitle} set={(v) => update("campaignTitle", v)} placeholder="Piezas UGC para campañas" /><Choice title="Categorías visibles en el portafolio" options={categories} selected={data.portfolioCategories} toggle={(v) => toggle("portfolioCategories", v)} /><Choice title="Sectores con los que trabajas" options={clientOptions} selected={data.clientTypes} toggle={(v) => toggle("clientTypes", v)} /><div className="categoryTabs" role="tablist">{data.portfolioCategories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}<small>{workMedia.filter((m) => m.category === item).length}/{item === "Fotografía" ? schema.photoLimit : schema.categoryLimit}</small></button>)}</div>{data.portfolioCategories.length ? <label className="mediaDrop"><input type="file" accept="video/*,image/*" multiple onChange={upload} /><span>↑</span><strong>Agregar piezas a “{data.portfolioCategories.includes(category) ? category : data.portfolioCategories[0]}”</strong><small>Imágenes hasta 10 MB · videos hasta 50 MB · {schema.label}.</small><b>Seleccionar archivos</b></label> : <div className="emptyCategory">Selecciona al menos una categoría para agregar contenido.</div>}{workMedia.length > 0 && <div className="mediaList">{workMedia.map((item) => <article key={item.id} className="mediaRow"><div className="mediaThumb">{item.previewUrl ? <img src={item.previewUrl} alt="Vista previa del contenido" /> : item.type === "video" ? <video src={item.url} muted /> : <img src={item.url} alt="Contenido subido" />}</div><div className="mediaInfo"><strong>{item.name}</strong><small>{item.category} · {item.type === "video" ? "Video" : "Foto"}</small>{item.type === "video" && <><button className={`frameChoice ${item.framed ? "selected" : ""}`} onClick={() => updateMedia(item.id, "framed", !item.framed)}>{item.framed ? "✓ Con marco de teléfono" : "Sin marco de teléfono"}</button><div className="mediaLinks"><input value={item.instagram} onChange={(e) => updateMedia(item.id, "instagram", e.target.value)} placeholder="Link de Instagram" /><input value={item.tiktok} onChange={(e) => updateMedia(item.id, "tiktok", e.target.value)} placeholder="Link de TikTok" /></div></>}</div><button className="removeMedia" onClick={() => remove(item.id)} aria-label="Eliminar">×</button></article>)}</div>}<div className="brandUpload"><div><strong>Logos de marcas</strong><small>JPG, PNG, WebP o GIF · máximo 10 MB por logo.</small></div><label><input type="file" accept="image/*" multiple onChange={uploadBrands} />＋ Agregar logos</label></div>{brands.length > 0 && <div className="brandList">{brands.map((brand) => <article key={brand.id}><img src={brand.url} alt={brand.name} /><span>{brand.name}</span><button onClick={() => removeBrand(brand.id)} aria-label={`Eliminar ${brand.name}`}>×</button></article>)}</div>}</div>}
        {step === 3 && <div className="formPanel"><div className={`syncCard ${data.metricSync ? "connected" : ""}`}><div><span>{data.metricSync ? "✓" : "↻"}</span><div><strong>{data.metricSync ? "Métricas conectadas" : "Conecta tus métricas"}</strong><small>{data.metricSync ? "Instagram y TikTok · actualización automática activa" : "Mantén seguidores y alcance al día sin editar tu diseño."}</small></div></div><button onClick={syncMetrics} disabled={syncing || data.metricSync}>{syncing ? "Conectando…" : data.metricSync ? "Conectado" : "Conectar redes"}</button></div><div className="twoFields"><Field label="Seguidores" value={data.followers} set={(v) => update("followers", v)} placeholder="50.5 mil" /><Field label="Visualizaciones / mes" value={data.monthlyViews} set={(v) => update("monthlyViews", v)} placeholder="700 K" /></div><Field label="Porcentaje de audiencia femenina" value={data.womenAudience} set={(v) => update("womenAudience", v)} placeholder="82.9%" /><TextArea label="Países principales y porcentajes" value={data.topCountries} set={(v) => update("topCountries", v)} /><div className="metricPreview"><span><b>{data.womenAudience}</b><small>Mujeres</small></span><div><strong>{data.followers}</strong><small>seguidores</small></div><div><strong>{data.monthlyViews}</strong><small>vistas mensuales</small></div></div></div>}
        {step === 4 && <div className="formPanel"><Choice title="Cada video UGC incluye" options={includeOptions} selected={data.includes} toggle={(v) => toggle("includes", v)} services /><div className="twoFields"><Field label="Video UGC" value={data.videoRate} set={(v) => update("videoRate", v)} placeholder="$350.000 COP" /><Field label="Reel en colaboración" value={data.collabRate} set={(v) => update("collabRate", v)} placeholder="$400.000 COP" /><Field label="1 historia con CTA" value={data.storyRate} set={(v) => update("storyRate", v)} placeholder="$80.000 COP" /><Field label="Pack 3 historias" value={data.storyPackRate} set={(v) => update("storyPackRate", v)} placeholder="$210.000 COP" /></div><Field label="Derechos de pauta por mes" value={data.usageRate} set={(v) => update("usageRate", v)} placeholder="$80.000 COP / mes" /></div>}
        {step === 5 && <div className="formPanel">{schema.contactVisual && <AssetSlot title="Visual de cierre" text="Aparece en la última lámina de esta plantilla." media={contactVisual} accept="image/*,video/*" onChange={(event) => uploadSpecial("__contact", event)} onRemove={() => contactVisual && remove(contactVisual.id)} />}<Choice title="Tipos de contenido" options={contentOptions} selected={data.contentTypes} toggle={(v) => toggle("contentTypes", v)} services /><div className="twoFields"><Field label="Correo" type="email" value={data.email} set={(v) => update("email", v)} placeholder="hola@tucorreo.com" /><Field label="WhatsApp" value={data.whatsapp} set={(v) => update("whatsapp", v)} placeholder="+57 300 000 0000" /><Field label="Instagram" value={data.instagram} set={(v) => update("instagram", v)} placeholder="@tuusuario" /><Field label="TikTok" value={data.tiktok} set={(v) => update("tiktok", v)} placeholder="@tuusuario" /></div><Field label="Disponibilidad" value={data.availability} set={(v) => update("availability", v)} placeholder="Disponible para campañas" /><Choice title="Servicios ofrecidos" options={serviceOptions} selected={data.services} toggle={(v) => toggle("services", v)} services /><div className="readyCard"><span>✦</span><div><strong>Tu presentación está lista</strong><p>Usa la rueda del mouse, el trackpad, las flechas o desliza para recorrerla.</p></div></div></div>}
        {step === 6 && <div className="formPanel publishPanel"><div className="publishUrl"><span>Tu enlace Brilla</span><div><b>brillaugc.com/</b><input aria-label="Nombre del enlace" value={data.portfolioSlug} onChange={(e) => updateSlug(e.target.value)} /></div><small className={`slugFeedback ${slugState}`}>{slugState === "checking" ? "Comprobando disponibilidad…" : slugState === "available" ? "✓ Este enlace está disponible" : slugState === "taken" ? "Ese enlace ya está ocupado" : slugState === "invalid" ? "Usa entre 3 y 80 caracteres, sin espacios" : "Se validará antes de publicar"}</small></div>{publishError && <p className="publishError" role="alert">{publishError}</p>}<ToggleRow checked={data.notifyViews} set={(value) => void saveViewNotifications(value)} title="Resumen de actividad" text={notificationBusy ? "Guardando tu preferencia…" : "Recibe un resumen semanal cuando haya actividad nueva. Puedes cambiar la frecuencia en tu cuenta."} /><div className="viewPulse"><span>◉</span><p><strong>{views} {views === 1 ? "visualización real" : "visualizaciones reales"}</strong><small>El panel de tu cuenta muestra visitantes aproximados y clics por canal.</small></p></div><div className="publishTools"><button onClick={openPortfolio}><span>↗</span><strong>Vista previa pública</strong><small>Comprueba la experiencia de la marca</small></button><button onClick={() => void downloadPdf()} disabled={pdfBusy}><span>↓</span><strong>{pdfBusy ? "Creando PDF…" : "Media kit PDF"}</strong><small>Descarga un archivo listo para compartir</small></button></div><div className={`publishReady ${published ? "published" : ""}`}><div><span>{published ? "✓" : "✦"}</span><p><strong>{published ? "Portafolio publicado" : publicationStatus === "unpublished" ? "Portafolio despublicado" : "Todo listo para brillar"}</strong><small>{published ? `Disponible en brillaugc.com/${data.portfolioSlug}` : "Publícalo cuando quieras. Tu borrador permanece guardado."}</small></p></div>{published ? <div className="publishReadyActions"><a href={`/${data.portfolioSlug}`} target="_blank" rel="noreferrer">Ver publicado ↗</a><button onClick={copyLink}>{copied ? "Enlace copiado ✓" : "Copiar enlace"}</button><button className="unpublishButton" onClick={unpublish} disabled={publishBusy}>Despublicar</button></div> : <button onClick={publish} disabled={publishBusy || slugState === "checking"}>{publishBusy ? "Publicando…" : "Publicar gratis ↗"}</button>}</div></div>}
        <div className="builderActions"><button className="backButton" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>← Atrás</button>{step < steps.length - 1 ? <button className="nextButton" onClick={() => requestStep(step + 1)}>Continuar <span>→</span></button> : <button className="nextButton" onClick={() => openPortfolio()}>Ver portafolio <span>↗</span></button>}</div>
      </section>
      {mobilePreviewOpen && <button className="mobilePreviewBackdrop isOpen" type="button" aria-label="Cerrar vista previa" onClick={() => setMobilePreviewOpen(false)} />}
      <aside className={`livePreview ${mobilePreviewOpen ? "mobilePreviewOpen" : ""}`} aria-label="Vista previa del portafolio"><div className="previewHeader"><div><span>VISTA PREVIA</span><strong>{data.format === "website" ? "Página web · cambios en vivo" : "Presentación horizontal · cambios en vivo"}</strong></div><small>{data.format === "website" ? "Scroll ↓" : "Desliza →"}</small><div className="mobilePreviewControls"><button className="mobilePreviewFullscreen" type="button" onClick={() => openPortfolio()}>Pantalla completa ↗</button><button className="mobilePreviewToggle" type="button" aria-label="Cerrar vista previa" onClick={() => setMobilePreviewOpen(false)}>×</button></div></div>{data.format === "website" ? <WebsitePortfolio data={data} media={media} brands={brands} schema={schema} /> : <PortfolioDeck data={data} media={media} brands={brands} schema={schema} />}</aside>
    </div>
    {authPromptOpen && <div className="identityAuthOverlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthPromptOpen(false); }}><section className="identityAuthCard" role="dialog" aria-modal="true" aria-labelledby="identity-auth-title"><button className="identityAuthClose" type="button" onClick={() => setAuthPromptOpen(false)} aria-label="Volver a Identidad">×</button><span className="identityAuthMark">✦</span><small>IDENTIDAD COMPLETADA</small><h2 id="identity-auth-title">Para continuar, inicia sesión.</h2><p>Tu plantilla y la información que acabas de completar ya están guardadas en este dispositivo.</p><div className="identityAuthPromise"><span>✓</span><div><strong>No perderás tu progreso</strong><small>Al volver de Google continuarás exactamente desde aquí.</small></div></div>{authError && <p className="identityAuthError" role="alert">{authError}</p>}<LegalConsentCheckbox id="editor-login-legal-consent" checked={loginConsentChecked} onChange={setLoginConsentChecked} /><button className="googleContinue" type="button" onClick={continueWithGoogle} disabled={authBusy || checkingAuth || !loginConsentChecked}><b>G</b>{checkingAuth ? "Comprobando sesión…" : authBusy ? "Abriendo Google…" : "Continuar con Google"}<span>→</span></button><button className="identityAuthBack" type="button" onClick={() => setAuthPromptOpen(false)}>Seguir editando mi identidad</button></section></div>}
  </main>;
}

function Field({ label, value, set, placeholder, type = "text" }: { label: string; value: string; set: (v: string) => void; placeholder: string; type?: string }) { return <label className="builderField"><span>{label}</span><input type={type} value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} /></label>; }
function TextArea({ label, value, set }: { label: string; value: string; set: (v: string) => void }) { return <label className="builderField"><span>{label}</span><textarea value={value} onChange={(e) => set(e.target.value)} /></label>; }
function AssetSlot({ title, text, media, accept, onChange, onRemove }: { title: string; text: string; media: Media | null; accept: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; onRemove: () => void }) { return <div className={`assetSlot ${media ? "filled" : ""}`}>{media && <div className="assetSlotPreview">{media.type === "video" ? <video src={media.url} poster={media.previewUrl} muted playsInline /> : <img src={media.url} alt={title} />}</div>}<div><strong>{media ? media.name : title}</strong><small>{media ? `${title} · listo` : text}</small></div><label><input type="file" accept={accept} onChange={onChange} />{media ? "Cambiar" : "Subir archivo"}</label>{media && <button onClick={onRemove} aria-label={`Eliminar ${title}`}>×</button>}</div>; }
function ToggleRow({ checked, set, title, text }: { checked: boolean; set: (value: boolean) => void; title: string; text: string }) { return <label className="toggleRow"><div><strong>{title}</strong><small>{text}</small></div><input aria-label={title} type="checkbox" checked={checked} onChange={(event) => set(event.target.checked)} /><i aria-hidden="true" /></label>; }
function Choice({ title, options, selected, toggle, services = false }: { title: string; options: string[]; selected: string[]; toggle: (v: string) => void; services?: boolean }) { return <div className="choiceField"><span>{title}</span><div className={services ? "serviceGrid" : "chipList"}>{options.map((option) => <button key={option} className={selected.includes(option) ? "selected" : ""} onClick={() => toggle(option)}><i>{selected.includes(option) ? "✓" : "+"}</i>{option}</button>)}</div></div>; }
function Theme({ name, note, mode, font, defaultFont, current, choose }: { name: string; note: string; mode: string; font: string; defaultFont: string; current: string; choose: (mode: string, fontStyle: string) => void }) { return <button className={current === mode ? "selected" : ""} onClick={() => choose(mode, defaultFont)}><i className={`themePreview ${mode}`}><b>{name}</b><em>Aa</em><u /></i><strong>{name}</strong><small>{note}</small><span>{templateSchemas[mode].label} · {font}</span></button>; }

function emailLink(value: string) { return `mailto:${value.trim()}`; }
function whatsappLink(value: string) { return `https://wa.me/${value.replace(/\D/g, "")}`; }
function socialLink(network: "instagram" | "tiktok", value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${network}.com/${trimmed.replace(/^@/, "")}`;
}

export function WebsitePortfolio({ data, media, brands, schema, expanded = false }: { data: Portfolio; media: Media[]; brands: BrandAsset[]; schema: TemplateSchema; expanded?: boolean }) {
  const experienceProps = { data, media, brands, schema, expanded };
  if (data.webTemplate === "feed") return <CreatorFeedPortfolio {...experienceProps} />;
  if (data.webTemplate === "stories") return <CampaignStoriesPortfolio {...experienceProps} />;
  if (data.webTemplate === "personal") return <PersonalScrapbookPortfolio {...experienceProps} />;
  if (data.webTemplate === "showreel") return <ShowreelFirstPortfolio {...experienceProps} />;
  if (data.webTemplate === "talent") return <TalentProfilePortfolio {...experienceProps} />;
  if (data.webTemplate === "postcard") return <PostcardJournalPortfolio {...experienceProps} />;
  const work = media.filter((item) => data.portfolioCategories.includes(item.category));
  const groups = data.portfolioCategories.map((category) => ({ category, items: work.filter((item) => item.category === category).slice(0, category === "Fotografía" ? schema.photoLimit : schema.categoryLimit) })).filter((group) => group.items.length);
  const countries = data.topCountries.split("·").map((item) => item.trim()).filter(Boolean);
  const portrait = media.find((item) => item.category === "__portrait") ?? null;
  const webTemplate = websiteOptions.some((item) => item.mode === data.webTemplate) ? data.webTemplate : "pop";
  const firstName = data.name.split(" ")[0] || data.name;
  const ticker = [...data.niches, "Contenido UGC", data.location.split(",")[0]?.trim() || "Creators", ...data.contentTypes.slice(0, 3)].filter(Boolean);
  const icons = ["✦", "♡", "☆", "❀", "◎", "✧", "⌂"];
  return <div className={`websitePortfolio website-${webTemplate} font-${data.fontStyle} ${expanded ? "expanded" : "compact"}`} style={{ "--site-accent": data.accent } as CSSProperties}>
    <header className="siteNav"><strong>{firstName}<i>✦</i></strong><nav><a href="#web-work">Trabajo</a><a href="#web-services">Servicios</a><a href="#web-rates">Tarifas</a><a className="navContact" href={emailLink(data.email)} data-analytics-target="email">Hablemos ↗</a></nav></header>
    <section className="siteHero webSection"><div className="webHeroCopy"><small><i>✦</i> UGC CREATOR — {data.location}</small><h1>{data.name}</h1><p className="heroRole">{data.title}</p><p className="heroBio">{data.bio}</p><div className="webHeroActions"><a className="heroCta" href="#web-work">Ver mi trabajo ↓</a><a className="heroGhost" href={emailLink(data.email)} data-analytics-target="email">Escríbeme</a></div></div><div className="webHeroVisual"><MediaCard item={portrait} label="TU FOTO" index={0} /><span className="heroSticker st1">✦</span><span className="heroSticker st2">☆</span><em className="heroNote">{data.availability}</em></div></section>
    <div className="webMarquee" aria-hidden><div>{Array.from({ length: 2 }, (_, dup) => ticker.map((word, i) => <span key={`${dup}-${i}`}>{word}<i>✦</i></span>))}</div></div>
    <div className="webProof"><span><b>{data.followers}</b>seguidores</span><span><b>{data.monthlyViews}</b>vistas / mes</span><span><b>{data.womenAudience}</b>audiencia femenina</span><span><b>{String(data.niches.length).padStart(2, "0")}</b>nichos creativos</span></div>
    <section className="webAbout webSection" id="web-about"><div className="webSectionTitle"><small>01 — SOBRE MÍ</small><h2>Historias reales que <em>conectan</em> con tu audiencia.</h2></div><div className="aboutBody"><p>{data.bio}</p><div className="webTags">{Array.from(new Set([...data.niches, ...data.clientTypes])).map((item) => <span key={item}>{item}</span>)}</div><div className="aboutContent"><b>CONTENIDO QUE CREO</b><p>{data.contentTypes.join(" · ")}</p></div></div></section>
    {groups.length > 0 && <section className="siteWork webSection" id="web-work"><div className="webSectionTitle"><small>02 — PORTAFOLIO</small><h2>{data.campaignTitle}</h2></div>{groups.map((group, gi) => <article className="webProjectGroup" key={group.category}><header><h3><i>{icons[gi % icons.length]}</i>{group.category}</h3><span>{String(group.items.length).padStart(2, "0")} / {group.category === "Fotografía" ? schema.photoLimit : schema.categoryLimit} PIEZAS</span></header><div style={{ "--work-count": Math.min(group.items.length, 4) } as CSSProperties}>{group.items.map((item, index) => <MediaCard key={item.id} item={item} label={item.category} index={index} />)}</div></article>)}</section>}
    {brands.length > 0 && <section className="webBrands webSection"><div className="webSectionTitle center"><small>03 — EXPERIENCIA</small><h2>Marcas que ya <em>brillaron</em> conmigo.</h2></div><div className="brandGrid">{brands.map((brand) => <article key={brand.id}><img src={brand.url} alt={`Logo de ${brand.name}`} /><span>{brand.name}</span></article>)}</div></section>}
    <section className="webAudience webSection"><div className="audienceCopy"><small>04 — AUDIENCIA</small><h2>Una comunidad que <em>confía</em> en lo que recomiendo.</h2><div className="webNumbers"><span><b>{data.followers}</b>seguidores</span><span><b>{data.monthlyViews}</b>vistas / mes</span><span><b>{data.womenAudience}</b>mujeres</span></div><div className="audienceSocial"><a href={socialLink("instagram", data.instagram)} target="_blank" rel="noreferrer" data-analytics-target="instagram"><b>IG</b>{data.instagram}</a><a href={socialLink("tiktok", data.tiktok)} target="_blank" rel="noreferrer" data-analytics-target="tiktok"><b>TK</b>{data.tiktok}</a></div></div><div className="webAudienceCard"><div className="webAudienceRing"><b>{data.womenAudience}</b><span>audiencia femenina</span></div><div className="countryBars">{countries.map((country, index) => <p key={country}><span>{country}</span><i style={{ width: `${Math.max(18, 88 - index * 18)}%` }} /></p>)}</div></div></section>
    <section className="webServices webSection" id="web-services"><div className="webSectionTitle"><small>05 — SERVICIOS</small><h2>Todo lo que puedo <em>crear</em> para tu marca.</h2></div><div className="serviceCards">{data.services.map((service, index) => <article key={service}><span>{String(index + 1).padStart(2, "0")}</span><h3>{service}</h3><b>{icons[index % icons.length]}</b></article>)}</div></section>
    <section className="webRates webSection" id="web-rates"><div className="webSectionTitle"><small>06 — TARIFAS</small><h2>Inversión clara, <em>sin sorpresas</em>.</h2></div><div className="rateBoard"><article className="rateHero"><small>EL FAVORITO ✦</small><h3>Video UGC</h3><b>{data.videoRate}</b><ul>{data.includes.map((include) => <li key={include}><i>✓</i>{include}</li>)}</ul></article><div className="rateGrid"><article><span>Reel en colaboración</span><b>{data.collabRate}</b></article><article><span>1 historia con CTA</span><b>{data.storyRate}</b></article><article><span>Pack de 3 historias</span><b>{data.storyPackRate}</b></article><article><span>Derechos de pauta</span><b>{data.usageRate}</b></article></div></div></section>
    <section className="webContact webSection" id="web-contact"><small>¿CREAMOS ALGO JUNTOS?</small><h2>Tu marca tiene una historia. <em>Hagámosla brillar.</em></h2><a className="contactCta" href={emailLink(data.email)} data-analytics-target="email">Empecemos un proyecto <span>↗</span></a><div className="contactGrid"><p><b>EMAIL</b><a href={emailLink(data.email)} data-analytics-target="email">{data.email}</a></p><p><b>WHATSAPP</b><a href={whatsappLink(data.whatsapp)} target="_blank" rel="noreferrer" data-analytics-target="whatsapp">{data.whatsapp}</a></p><p><b>INSTAGRAM</b><a href={socialLink("instagram", data.instagram)} target="_blank" rel="noreferrer" data-analytics-target="instagram">{data.instagram}</a></p><p><b>TIKTOK</b><a href={socialLink("tiktok", data.tiktok)} target="_blank" rel="noreferrer" data-analytics-target="tiktok">{data.tiktok}</a></p></div><em className="contactNote">{data.availability}</em></section>
    <footer className="siteFooter"><strong>{data.name} ✦</strong><span>{data.location}</span><span>Hecho con brilla</span></footer>
  </div>;
}

export function PortfolioDeck({ data, media, brands, schema, expanded = false }: { data: Portfolio; media: Media[]; brands: BrandAsset[]; schema: TemplateSchema; expanded?: boolean }) {
  const deck = useRef<HTMLDivElement>(null); const [active, setActive] = useState(0); const dragging = useRef<{ x: number; left: number } | null>(null);
  const visibleCategories = data.portfolioCategories.filter((item) => media.some((asset) => asset.category === item));
  const slideCount = 1 + visibleCategories.length + (brands.length ? 1 : 0) + 4;
  const go = (index: number) => { const next = Math.max(0, Math.min(slideCount - 1, index)); deck.current?.scrollTo({ left: next * deck.current.clientWidth, behavior: "smooth" }); };
  useEffect(() => { if (active < slideCount) return; const last = slideCount - 1; const frame = window.requestAnimationFrame(() => { setActive(last); deck.current?.scrollTo({ left: last * deck.current.clientWidth }); }); return () => window.cancelAnimationFrame(frame); }, [active, slideCount]);
  const onScroll = (event: UIEvent<HTMLDivElement>) => { const node = event.currentTarget; setActive(Math.round(node.scrollLeft / Math.max(1, node.clientWidth))); };
  const onWheel = (event: WheelEvent<HTMLDivElement>) => { if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) { event.preventDefault(); event.currentTarget.scrollLeft += event.deltaY; } };
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => { dragging.current = { x: event.clientX, left: event.currentTarget.scrollLeft }; event.currentTarget.setPointerCapture(event.pointerId); };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => { if (dragging.current) event.currentTarget.scrollLeft = dragging.current.left - (event.clientX - dragging.current.x); };
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => { dragging.current = null; event.currentTarget.releasePointerCapture(event.pointerId); go(Math.round(event.currentTarget.scrollLeft / Math.max(1, event.currentTarget.clientWidth))); };
  const selected = (category: string, count: number, offset = 0): Array<Media | null> => media.filter((item) => item.category === category).slice(offset, offset + count);
  const template = templateOptions.some((item) => item.mode === data.template) ? data.template : "gallery"; const common = { data, active, mediaFor: selected, schema, portrait: media.find((item) => item.category === "__portrait") ?? null, contactVisual: media.find((item) => item.category === "__contact") ?? null };
  let position = 0;
  const slides = [<IntroSlide key="intro" {...common} index={position++} />,
    ...visibleCategories.map((category) => category === "Fotografía" ? <PhotoSlide key={category} {...common} index={position++} /> : <GallerySlide key={category} {...common} index={position++} category={category} title={category === "Campañas" ? data.campaignTitle : category === "Cabello" ? "Cuidado del cabello" : category === "Beauty" ? "Skincare, maquillaje y perfumería" : category === "Familia" ? "Family & home vibes" : category === "Empresas" ? "Empresas y otros productos" : "Hoteles, restaurantes y lugares"} icon={category === "Beauty" ? "✦" : category === "Familia" ? "⌂" : category === "Lugares" ? "⌖" : "♡"} />),
    ...(brands.length ? [<BrandsSlide key="brands" data={data} brands={brands} active={active} index={position++} />] : []),
    <AudienceSlide key="audience" {...common} index={position++} />,<RateSlide key="rate-main" {...common} index={position++} secondary={false} />,<RateSlide key="rate-secondary" {...common} index={position++} secondary />,<ContactSlide key="contact" {...common} index={position++} />];
  return <div className={`portfolioDeck deck-${template} font-${data.fontStyle} ${expanded ? "expanded" : "compact"}`} style={{ "--deck-accent": data.accent } as CSSProperties}>
    <div ref={deck} className="deckTrack" role="slider" tabIndex={0} aria-label="Lámina visible del portafolio UGC" aria-valuemin={1} aria-valuemax={slideCount} aria-valuenow={active + 1} onScroll={onScroll} onWheel={onWheel} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onKeyDown={(e) => { if (e.key === "ArrowRight") go(active + 1); if (e.key === "ArrowLeft") go(active - 1); }}>
      {slides}
    </div>
    <div className="deckControls" aria-label="Controles de presentación"><button onClick={() => go(active - 1)} disabled={active === 0}>←</button><div>{Array.from({ length: slideCount }, (_, i) => <button key={i} className={active === i ? "active" : ""} onClick={() => go(i)} aria-label={`Ir a lámina ${i + 1}`} />)}</div><span>{String(active + 1).padStart(2, "0")} / {slideCount}</span><button onClick={() => go(active + 1)} disabled={active === slideCount - 1}>→</button></div>
  </div>;
}

type SlideProps = { data: Portfolio; active: number; index: number; mediaFor: (category: string, count: number, offset?: number) => Array<Media | null>; schema: TemplateSchema; portrait: Media | null; contactVisual: Media | null };
function IntroSlide({ data, active, index, portrait }: SlideProps) { return <section className={`deckSlide intro ${active === index ? "isActive" : ""}`}><div className="introCopy"><span>CREADORA DE CONTENIDO UGC</span><h1>{data.title}</h1><p>{data.bio}</p><small>{data.location}</small></div><MediaCard item={portrait} label="TU RETRATO" index={0} /></section>; }
function GallerySlide({ active, index, mediaFor, schema, category, title, icon }: SlideProps & { category: string; title: string; icon?: string }) { const items = mediaFor(category, category === "Fotografía" ? schema.photoLimit : schema.categoryLimit); return <section className={`deckSlide gallery ${active === index ? "isActive" : ""}`}><div className="slideTitle">{icon && <i>{icon}</i>}<h2>{title}</h2></div><div className={`galleryRow count-${items.length}`} style={{ "--media-count": items.length } as CSSProperties}>{items.map((item, i) => <MediaCard key={item?.id ?? `${index}-${i}`} item={item} label={category} index={i} />)}</div></section>; }
function PhotoSlide({ data, active, index, mediaFor, schema }: SlideProps) { const items = mediaFor("Fotografía", schema.photoLimit); return <section className={`deckSlide photoMosaic count-${items.length} ${active === index ? "isActive" : ""}`}><h2>Fotografía UGC</h2><div>{items.map((item, i) => <MediaCard key={item?.id ?? i} item={item} label={data.niches[i % Math.max(1, data.niches.length)] || "UGC"} index={i} />)}</div></section>; }
function BrandsSlide({ brands, active, index }: { data: Portfolio; brands: BrandAsset[]; active: number; index: number }) { return <section className={`deckSlide brands ${active === index ? "isActive" : ""}`}><small>EXPERIENCIA</small><h2>Marcas con las que he trabajado</h2><div>{brands.map((brand) => <article key={brand.id}><img src={brand.url} alt={`Logo de ${brand.name}`} /><span>{brand.name}</span></article>)}</div></section>; }
function AudienceSlide({ data, active, index }: SlideProps) { const countries = data.topCountries.split("·").map((item) => item.trim()).filter(Boolean); return <section className={`deckSlide audience ${active === index ? "isActive" : ""}`}><div><small>MI AUDIENCIA</small><h2>Mi comunidad conecta principalmente con mujeres.</h2><div className="audienceRing"><strong>{data.womenAudience}</strong><span>mujeres</span></div><div className="audienceStats"><span><b>{data.followers}</b>seguidores</span><span><b>{data.monthlyViews}</b>vistas / mes</span></div></div><div className="countryPanel"><h3>Principales ubicaciones</h3>{countries.map((country, i) => <p key={country}><span>{country}</span><i style={{ width: `${Math.max(14, 86 - i * 17)}%` }} /></p>)}<div className="socialCard"><b>{data.instagram}</b><span>{data.name}</span><small>{data.niches.join(" · ")}</small></div></div></section>; }
function RateSlide({ data, active, index, secondary }: SlideProps & { secondary: boolean }) { return <section className={`deckSlide rates ${secondary ? "secondary" : ""} ${active === index ? "isActive" : ""}`}><div className="rateCopy"><small>TARIFAS</small>{secondary ? <><h2>Historias & pauta</h2><Rate name="Reel en colaboración" price={data.collabRate} /><Rate name="1 historia con CTA" price={data.storyRate} /><Rate name="Pack de 3 historias" price={data.storyPackRate} /><Rate name="Derechos de pauta / mes" price={data.usageRate} /></> : <><h2>Video UGC</h2><p>Incluye:</p><ul>{data.includes.map((item) => <li key={item}>✓ {item}</li>)}</ul><strong className="mainPrice">{data.videoRate}</strong></>}</div><div className="rateVisual"><span>UGC</span><i>✦</i><b>{secondary ? "SOCIAL" : "CREATE"}</b></div></section>; }
function Rate({ name, price }: { name: string; price: string }) { return <div className="rateLine"><span>{name}</span><strong>{price}</strong></div>; }
function ContactSlide({ data, active, index, contactVisual }: SlideProps) { return <section className={`deckSlide contact ${active === index ? "isActive" : ""}`}><div className="phoneFrame"><MediaCard item={contactVisual} label="LET'S CREATE" index={0} /></div><div className="contactCopy"><small>{data.services.join(" · ")}</small><h2>{data.contentTypes.join(" · ")}</h2><div className="deckClientTypes">{data.clientTypes.map((type) => <span key={type}>{type}</span>)}</div><em>¡Trabajemos juntos!</em><p><b>WhatsApp</b><a href={whatsappLink(data.whatsapp)} target="_blank" rel="noreferrer" data-analytics-target="whatsapp">{data.whatsapp}</a></p><p><b>Email</b><a href={emailLink(data.email)} data-analytics-target="email">{data.email}</a></p><p><b>Instagram</b><a href={socialLink("instagram", data.instagram)} target="_blank" rel="noreferrer" data-analytics-target="instagram">{data.instagram}</a></p><p><b>TikTok</b><a href={socialLink("tiktok", data.tiktok)} target="_blank" rel="noreferrer" data-analytics-target="tiktok">{data.tiktok}</a></p><span>{data.availability}</span></div></section>; }
function MediaCard({ item, label, index }: { item: Media | null; label: string; index: number }) { const framed = item?.type === "video" && item.framed; return <article className={`deckMedia media-${index} ${framed ? "videoCard" : item?.type === "video" ? "videoPlain" : ""}`}>{item ? item.type === "video" ? <>{framed && <i className="videoNotch" />}<video src={item.url} poster={item.previewUrl} muted playsInline controls preload="metadata" /><div className="videoSocials">{item.instagram && <a href={item.instagram} target="_blank" rel="noreferrer" aria-label="Ver en Instagram" data-analytics-target="instagram">IG</a>}{item.tiktok && <a href={item.tiktok} target="_blank" rel="noreferrer" aria-label="Ver en TikTok" data-analytics-target="tiktok">TK</a>}</div></> : <img src={item.url} alt={`Pieza UGC de ${label}`} loading="lazy" /> : <div className="mediaPlaceholder"><span>{label}</span><b>{String(index + 1).padStart(2, "0")}</b><i>▶</i></div>}</article>; }
