"use client";

/* The editor intentionally uses plain anchors for navigation outside the form. */
/* eslint-disable @next/next/no-html-link-for-pages */
/* User media uses local blob URLs and private signed URLs, so Next image optimization is not applicable here. */
/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, CSSProperties, PointerEvent, UIEvent, WheelEvent, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Upload } from "tus-js-client";
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
import { portfolioOption, portfolioOptions, portfolioText } from "./portfolio-i18n";
import "./crear.css";
import "./templates.css";
import "./website.css";
import "./template-refresh.css";
import "./creator-feed.css";
import "./portfolio-experiences.css";
import "./portfolio-additions.css";

export type CaseStudy = { client: string; brief: string; hook: string; result: string; testimonial: string };
export type Portfolio = {
  name: string; title: string; bio: string; location: string; niches: string[]; language: "" | "es" | "en"; format: "" | "website" | "presentation"; webTemplate: string; template: string; fontStyle: string; accent: string; portfolioCategories: string[];
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
type StoredAsset = { id: number; kind: "media" | "brand"; name: string; blob: Blob; revision?: string; type?: "video" | "image"; framed?: boolean; category?: string; instagram?: string; tiktok?: string; storagePath?: string; previewBlob?: Blob; previewPath?: string };
type RemoteAsset = { asset_id: number; kind: "media" | "brand"; storage_path: string; preview_path: string | null; original_name: string; media_type: "video" | "image"; category: string; framed: boolean; instagram: string; tiktok: string; sort_order: number; size_bytes: number; mime_type: string };

const assetDbName = "brilla-assets-v1";
const assetStoreName = "assets";
const draftStorageKey = "brilla-portfolio-draft-v3";
const pendingStepStorageKey = "brilla-post-auth-step-v1";
const draftUploadPendingKey = "brilla-pending-cloud-upload-v1";
const creatorMediaBucket = "creator-media";
const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);
const videoMimeTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const maxImageBytes = 10 * 1024 * 1024;
const maxVideoBytes = 50 * 1024 * 1024;
const signedAssetLifetimeSeconds = 24 * 60 * 60;
const resumableUploadThreshold = 6 * 1024 * 1024;
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
  if (kind === "brand" && !image) return "Los logos deben ser JPG, PNG, WebP, GIF, HEIC o HEIF.";
  if (kind === "media" && !image && !video) return "Usa imágenes JPG, PNG, WebP, GIF, HEIC o HEIF, o videos MP4, WebM o MOV.";
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

function resumableStorageEndpoint() {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configuredUrl) throw new Error("La conexión de archivos de Brilla no está configurada.");
  const url = new URL(configuredUrl);
  const projectMatch = url.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
  const origin = projectMatch ? `${url.protocol}//${projectMatch[1]}.storage.supabase.co` : url.origin;
  return `${origin}/storage/v1/upload/resumable`;
}

async function uploadAssetBlobStandard(path: string, blob: Blob, contentType: string, cacheControl: string) {
  const { error } = await getSupabaseBrowserClient().storage.from(creatorMediaBucket).upload(path, blob, { upsert: true, contentType, cacheControl });
  if (error) throw error;
}

function readableAssetError(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";
  const normalized = message.toLowerCase();
  if (normalized.includes("row-level security") || normalized.includes("unauthorized") || normalized.includes("jwt")) return "Tu sesión perdió el permiso para subir archivos. Cierra sesión, vuelve a entrar y reintenta.";
  if (normalized.includes("mime") || normalized.includes("content type")) return "Supabase rechazó el formato del archivo. Prueba convertirlo a JPG, PNG o MP4.";
  if (normalized.includes("too large") || normalized.includes("maximum") || normalized.includes("payload")) return "El archivo supera el tamaño permitido: 10 MB para imágenes y 50 MB para videos.";
  if (normalized.includes("network") || normalized.includes("fetch") || normalized.includes("load failed") || normalized.includes("timeout")) return "La conexión se interrumpió durante la subida. Mantén esta pantalla abierta y toca Reintentar.";
  return "La subida fue rechazada por el servidor. Toca Reintentar; si continúa, vuelve a iniciar sesión.";
}

async function uploadAssetBlob(path: string, blob: Blob, contentType: string, cacheControl: string) {
  const supabase = getSupabaseBrowserClient();
  if (blob.size <= resumableUploadThreshold) {
    await uploadAssetBlobStandard(path, blob, contentType, cacheControl);
    return;
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) throw sessionError ?? new Error("La sesión expiró antes de subir el archivo.");

  try {
    await new Promise<void>((resolve, reject) => {
      const upload = new Upload(blob, {
        endpoint: resumableStorageEndpoint(),
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: { authorization: `Bearer ${accessToken}`, "x-upsert": "true" },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: resumableUploadThreshold,
        metadata: { bucketName: creatorMediaBucket, objectName: path, contentType, cacheControl },
        onError: reject,
        onSuccess: () => resolve(),
      });
      void upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length) upload.resumeFromPreviousUpload(previousUploads[0]);
        upload.start();
      }).catch(reject);
    });
  } catch {
    // Some mobile networks and embedded browsers block or interrupt TUS requests.
    // Supabase also supports standard uploads at this size, so use it as a safe fallback.
    await uploadAssetBlobStandard(path, blob, contentType, cacheControl);
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
  const revision = asset.revision ? `-${asset.revision}` : "";
  const path = `${userId}/${asset.kind}/${asset.id}${revision}-${safeStorageName(asset.name)}`;
  const previewPath = asset.previewBlob ? `${userId}/previews/${asset.kind}-${asset.id}${revision}.webp` : undefined;
  await uploadAssetBlob(path, asset.blob, asset.blob.type, "3600");
  if (previewPath && asset.previewBlob) {
    try {
      await uploadAssetBlob(previewPath, asset.previewBlob, "image/webp", "86400");
    } catch (previewError) {
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
  { name: "Gallery", note: "Revista crema · entrada suave", mode: "gallery", font: "Editorial", defaultFont: "editorial", defaultAccent: "#c15f7a" },
  { name: "Studio Luv", note: "Cine berry · efecto telón", mode: "studio", font: "Romántica", defaultFont: "romantic", defaultAccent: "#c15f7a" },
  { name: "Scrapbook", note: "Collage coral · ritmo artesanal", mode: "scrapbook", font: "Magazine", defaultFont: "magazine", defaultAccent: "#f4a6b8" },
  { name: "Art Director", note: "Brutalismo pop · cortes gráficos", mode: "art", font: "Magazine", defaultFont: "magazine", defaultAccent: "#d7ff2f" },
  { name: "Blue OS", note: "Tech azul · pulso digital", mode: "blue", font: "Moderna", defaultFont: "modern", defaultAccent: "#00d7ff" },
  { name: "Whimsy", note: "Pop rosado · rebote juguetón", mode: "whimsy", font: "Romántica", defaultFont: "romantic", defaultAccent: "#ff3dbb" },
  { name: "Sage Journal", note: "Botánico suave · calma editorial", mode: "sage", font: "Editorial", defaultFont: "editorial", defaultAccent: "#b6dfc4" },
];
const websiteOptions = [
  { name: "Sunny Pop", note: "Colorida y divertida · stickers y color", mode: "pop", font: "Moderna", defaultFont: "modern", defaultAccent: "#7c3cff" },
  { name: "Retro Zine", note: "Collage scrapbook · polaroids y cinta", mode: "retro", font: "Editorial", defaultFont: "editorial", defaultAccent: "#c15f7a" },
  { name: "Éditorial Chic", note: "Elegante y profesional · aire de revista", mode: "chic", font: "Editorial", defaultFont: "editorial", defaultAccent: "#c15f7a" },
  { name: "Neo Brutal", note: "Audaz y juvenil · bordes y sombras duras", mode: "bold", font: "Magazine", defaultFont: "magazine", defaultAccent: "#ff3dbb" },
  { name: "Creator Feed", note: "Perfil social · UGC nativo y piezas fijadas", mode: "feed", font: "Moderna", defaultFont: "modern", defaultAccent: "#7c3cff" },
  { name: "Campaign Stories", note: "Casos editoriales · estrategia y resultados", mode: "stories", font: "Editorial", defaultFont: "editorial", defaultAccent: "#c15f7a" },
  { name: "Personal Scrapbook", note: "Diario creativo · collage íntimo", mode: "personal", font: "Romántica", defaultFont: "romantic", defaultAccent: "#f4a6b8" },
  { name: "Showreel First", note: "Video protagonista · recorrido cinematográfico", mode: "showreel", font: "Moderna", defaultFont: "modern", defaultAccent: "#00d7ff" },
  { name: "Talent Profile", note: "Perfil de agencia · lectura comercial", mode: "talent", font: "Editorial", defaultFont: "editorial", defaultAccent: "#b6dfc4" },
  { name: "Postcard Journal", note: "Bitácora viajera · lugares y descubrimientos", mode: "postcard", font: "Magazine", defaultFont: "magazine", defaultAccent: "#ffd6a5" },
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
  name: "", title: "", bio: "", creativeDiary: "", languages: "", caseStudies: {},
  location: "", niches: [], language: "", format: "", webTemplate: "", template: "", fontStyle: "", accent: "", portfolioCategories: [],
  campaignTitle: "", contentTypes: [], clientTypes: [], services: [], includes: [],
  followers: "", monthlyViews: "", womenAudience: "", topCountries: "",
  videoRate: "", collabRate: "", storyRate: "", storyPackRate: "", usageRate: "",
  email: "", whatsapp: "", instagram: "", tiktok: "", availability: "",
  notifyViews: false, metricSync: false, portfolioSlug: "",
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
  const [maxVisitedStep, setMaxVisitedStep] = useState(0);
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
  const [assetRetryNonce, setAssetRetryNonce] = useState(0);
  const previewRef = useRef<HTMLElement>(null);
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
    const preview = previewRef.current;
    if (!preview) return;
    const frame = window.requestAnimationFrame(() => {
      const websiteTargets = [
        ".siteHero,.feedHero,.csHero,.psHero,.srHero,.tpHero,.pcHero",
        ".siteHero,.feedHero,.csHero,.psDiary,.srHero,.tpHero,.pcIntro",
        ".siteWork,.feedPinned,.csCases,.psWork,.srWork,.tpWork,.pcStops",
        ".webAudience,.feedCollab,.csServices,.psNotes,.srProof,.tpCommercial,.pcProof",
        ".webRates,.webServices,.feedCollab,.csServices,.psNotes,.srServices,.tpCommercial,.pcPassport",
        ".webContact,.feedContact,.csContact,.psContact,.srContact,.tpContact,.pcContact",
        ".siteFooter,.feedFooter,.csContact,.psContact,.srContact,.tpContact,.pcContact",
      ];
      if (data.format === "presentation") {
        const track = preview.querySelector<HTMLElement>(".deckTrack");
        if (!track) return;
        const slideTargets = [".intro", ".intro", ".gallery,.photoMosaic", ".audience", ".rates", ".contact", ".contact"];
        const target = track.querySelector<HTMLElement>(slideTargets[step]);
        if (target) track.scrollTo({ left: target.offsetLeft, behavior: "smooth" });
        return;
      }
      const target = preview.querySelector<HTMLElement>(websiteTargets[step]);
      const scrollSurface = preview.querySelector<HTMLElement>(".websitePortfolio,.creatorFeed,.portfolioExperiencePage");
      if (target && scrollSurface) scrollSurface.scrollTo({ top: Math.max(0, target.offsetTop - 12), behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [step, data.format, data.webTemplate, data.template]);

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
      if (Number.isInteger(pendingStep) && pendingStep >= 2 && pendingStep < steps.length) { setStep(pendingStep); setMaxVisitedStep((current) => Math.max(current, pendingStep)); }
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
            try {
              await updateStoredAsset(asset.kind, asset.id, { storagePath: path, previewBlob: asset.previewBlob, previewPath });
            } catch {
              setAssetError(`${asset.name} se subió a Brilla, pero el navegador no pudo actualizar su copia local.`);
            }
          } catch (error) {
            setAssetError(`No pudimos subir ${asset.name}. ${readableAssetError(error)}`);
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
  }, [user, cloudReady, localAssetsReady, assetRetryNonce]);

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
    void storeAsset(asset).catch(() => setAssetError("No pudimos crear una copia local del archivo. Si iniciaste sesión, intentaremos subirlo directamente a Brilla."));
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
      try {
        await updateStoredAsset(asset.kind, asset.id, { storagePath: path, previewPath });
      } catch {
        setAssetError(`${asset.name} se subió a Brilla, pero el navegador no pudo actualizar su copia local.`);
      }
      if (asset.kind === "media") setMedia((current) => current.map((item) => item.id === asset.id ? { ...item, storagePath: path, previewPath } : item));
      else setBrands((current) => current.map((item) => item.id === asset.id ? { ...item, storagePath: path } : item));
    } catch (error) {
      setAssetError(`No pudimos subir ${asset.name}. ${readableAssetError(error)}`);
    } finally {
      setAssetUploads((count) => Math.max(0, count - 1));
    }
  };
  const retryAssetUploads = () => {
    assetHydratedForRef.current = "";
    setAssetError("");
    setAssetRetryNonce((current) => current + 1);
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
    const item: Media = { id: slot === "__portrait" ? -1 : -2, name: file.name, type, url: URL.createObjectURL(blob), previewUrl: previewBlob ? URL.createObjectURL(previewBlob) : undefined, framed: false, category: slot, instagram: "", tiktok: "" };
    const stored: StoredAsset = { id: item.id, kind: "media", name: item.name, blob, revision: `${file.lastModified}-${file.size}`, previewBlob, type: item.type, framed: false, category: slot, instagram: "", tiktok: "" };
    setMedia((current) => {
      current.filter((asset) => asset.category === slot).forEach((asset) => {
        if (asset.url.startsWith("blob:")) URL.revokeObjectURL(asset.url);
        if (asset.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(asset.previewUrl);
      });
      return [...current.filter((asset) => asset.category !== slot), item];
    });
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
    if (nextStep <= 1 || (user && legalReady)) { setStep(nextStep); setMaxVisitedStep((current) => Math.max(current, nextStep)); return; }
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
      if (Number.isInteger(pendingStep) && pendingStep >= 2 && pendingStep < steps.length) { setStep(pendingStep); setMaxVisitedStep((current) => Math.max(current, pendingStep)); }
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
        <nav className="mobileStepNav" aria-label="Pasos visitados">{steps.map((item, index) => <button key={item[0]} type="button" className={index === step ? "current" : index < maxVisitedStep ? "visited" : ""} disabled={index > maxVisitedStep} onClick={() => requestStep(index)}><span>{index < maxVisitedStep ? "✓" : index + 1}</span>{item[0]}</button>)}</nav>
        <div className="formHeading"><span>{String(step + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</span><h1>{steps[step][1]}</h1><p>{steps[step][2]}</p></div>
        {assetError && <div className="assetSyncNotice" role="alert"><span>!</span><p>{assetError}</p>{user && <button className="assetRetryButton" type="button" onClick={retryAssetUploads} disabled={assetUploads > 0}>{assetUploads > 0 ? "Subiendo…" : "Reintentar"}</button>}<button className="assetNoticeClose" type="button" onClick={() => setAssetError("")} aria-label="Cerrar aviso">×</button></div>}
        {step === 2 && data.format === "website" && data.webTemplate === "stories" && data.portfolioCategories.length > 0 && <div className="formPanel"><div className="schemaSummary"><span>✎</span><p><strong>Historia del caso · {data.portfolioCategories.includes(category) ? category : data.portfolioCategories[0]}</strong><small>Convierte esta categoría en un caso de campaña. Puedes dejar vacío lo que aún no tengas.</small></p></div><Field label="Marca o cliente" value={(data.caseStudies[data.portfolioCategories.includes(category) ? category : data.portfolioCategories[0]] ?? { client: "" }).client} set={(v) => updateCaseStudy("client", v)} placeholder="Nombre de la marca" /><TextArea label="Brief de la marca" value={(data.caseStudies[data.portfolioCategories.includes(category) ? category : data.portfolioCategories[0]] ?? { brief: "" }).brief} set={(v) => updateCaseStudy("brief", v)} /><Field label="Hook de apertura" value={(data.caseStudies[data.portfolioCategories.includes(category) ? category : data.portfolioCategories[0]] ?? { hook: "" }).hook} set={(v) => updateCaseStudy("hook", v)} placeholder="La primera frase del video" /><TextArea label="Resultado" value={(data.caseStudies[data.portfolioCategories.includes(category) ? category : data.portfolioCategories[0]] ?? { result: "" }).result} set={(v) => updateCaseStudy("result", v)} /><TextArea label="Testimonio" value={(data.caseStudies[data.portfolioCategories.includes(category) ? category : data.portfolioCategories[0]] ?? { testimonial: "" }).testimonial} set={(v) => updateCaseStudy("testimonial", v)} /></div>}
        {step === 1 && <div className="formPanel"><AssetSlot title="Retrato principal" text="Aparece en la portada de todas las plantillas." media={portrait} accept="image/*,video/*" onChange={(event) => uploadSpecial("__portrait", event)} onRemove={() => portrait && remove(portrait.id)} /><Field label="Nombre público" value={data.name} set={(v) => update("name", v)} placeholder="Tu nombre" /><Field label="Título profesional" value={data.title} set={(v) => update("title", v)} placeholder="Creadora UGC | Beauty & Lifestyle" /><TextArea label="Sobre ti" value={data.bio} set={(v) => update("bio", v)} />{data.format === "website" && ["personal", "postcard"].includes(data.webTemplate) && <TextArea label="Así creo contenido · entrada de diario" value={data.creativeDiary} set={(v) => update("creativeDiary", v)} />}{data.format === "website" && data.webTemplate === "talent" && <Field label="Idiomas" value={data.languages} set={(v) => update("languages", v)} placeholder="Español · Inglés" />}<Field label="Ubicación" value={data.location} set={(v) => update("location", v)} placeholder="Ciudad, País" /><Choice title="Nichos principales" options={nicheOptions} selected={data.niches} toggle={(v) => toggle("niches", v)} language={data.language} /></div>}
        {step === 0 && <div className="formPanel"><div className="visualSettings languageSettings"><div className="languageChoice"><span>Idioma del portafolio</span><p>Los títulos y botones de la plantilla se mostrarán en este idioma.</p><div><button className={data.language === "es" ? "selected" : ""} onClick={() => update("language", "es")}>Español</button><button className={data.language === "en" ? "selected" : ""} onClick={() => update("language", "en")}>English</button></div></div></div><div className="choiceField templateFamily"><span>Plantillas de página web <small>{websiteOptions.length} estilos profesionales</small></span><p>Elige una y personalízala sin salir de su tarjeta.</p><div className="themeCards webThemeCards">{websiteOptions.map((item) => <Theme key={item.mode} {...item} accent={data.accent || "#6d4dff"} fontStyle={data.fontStyle} current={data.format === "website" ? data.webTemplate : ""} choose={(mode) => { setSaved(false); setData((current) => ({ ...current, format: "website", webTemplate: mode })); }} setAccent={(accent) => { setSaved(false); setData((current) => ({ ...current, accent })); }} setFont={(fontStyle) => { setSaved(false); setData((current) => ({ ...current, fontStyle })); }} resetStyle={(accent, fontStyle) => { setSaved(false); setData((current) => ({ ...current, accent, fontStyle })); }} />)}</div></div><div className="templateDivider"><span>O ELIGE UNA EXPERIENCIA PRESENTACIONAL</span></div><div className="choiceField templateFamily"><span>Plantillas presentacionales <small>7 estilos</small></span><p>Elige una y ajusta su color y tipografía en la misma tarjeta.</p><div className="themeCards">{templateOptions.map((item) => <Theme key={item.mode} {...item} accent={data.accent || "#6d4dff"} fontStyle={data.fontStyle} current={data.format === "presentation" ? data.template : ""} choose={(mode) => { setSaved(false); setData((current) => ({ ...current, format: "presentation", template: mode })); }} setAccent={(accent) => { setSaved(false); setData((current) => ({ ...current, accent })); }} setFont={(fontStyle) => { setSaved(false); setData((current) => ({ ...current, fontStyle })); }} resetStyle={(accent, fontStyle) => { setSaved(false); setData((current) => ({ ...current, accent, fontStyle })); }} />)}</div></div></div>}
        {step === 2 && <div className="formPanel"><div className="schemaSummary"><span>✦</span><p><strong>{schema.id.replace("gallery", "Gallery").replace("studio", "Studio Luv").replace("scrapbook", "Scrapbook").replace("art", "Art Director").replace("blue", "Blue OS").replace("whimsy", "Whimsy").replace("sage", "Sage Journal").replace("muse", "Muse Editorial").replace("creator", "Creator Studio").replace("aura", "Aura Grid").replace("noir", "Noir Atelier").replace("sorbet", "Sorbet Studio").replace("lavender", "Lavender Cloud").replace("mint", "Mint Picnic").replace("electric", "Electric Pulse").replace("pop", "Sunny Pop").replace("retro", "Retro Zine").replace("chic", "Éditorial Chic").replace("bold", "Neo Brutal")}</strong><small>{schema.label}. El formulario respeta su composición.</small></p></div><Field label="Título de la sección de trabajos" value={data.campaignTitle} set={(v) => update("campaignTitle", v)} placeholder="Ej. Contenido que convierte" help="Es el encabezado que verá la marca antes de tus videos y fotos. Si lo dejas vacío, no se muestra." /><Choice title="Sectores con los que trabajas" options={clientOptions} selected={data.clientTypes} toggle={(v) => toggle("clientTypes", v)} language={data.language} /><div className="portfolioCategoryPicker"><Choice title="Categorías para organizar tus trabajos" options={categories} selected={data.portfolioCategories} toggle={(v) => toggle("portfolioCategories", v)} language={data.language} /><p>Primero elige una categoría y luego sube sus videos o fotos. Nada está preseleccionado.</p></div>{data.portfolioCategories.length > 0 && <div className="activeCategoryGuide"><span>1</span><div><strong>¿A qué categoría pertenece el archivo?</strong><small>Selecciona una antes de subir. La categoría activa queda resaltada.</small></div></div>}<div className="categoryTabs" role="tablist">{data.portfolioCategories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{portfolioOption(data, item)}<small>{workMedia.filter((m) => m.category === item).length}/{item === "Fotografía" ? schema.photoLimit : schema.categoryLimit}</small></button>)}</div>{data.portfolioCategories.length ? <label className="mediaDrop"><input type="file" accept="video/*,image/*" multiple onChange={upload} /><span>↑</span><strong>Subiendo a: “{portfolioOption(data, data.portfolioCategories.includes(category) ? category : data.portfolioCategories[0])}”</strong><small>Imágenes hasta 10 MB · videos hasta 50 MB · {schema.label}.</small><b>Seleccionar archivos</b></label> : <div className="emptyCategory">Selecciona al menos una categoría para agregar contenido.</div>}{workMedia.length > 0 && <div className="mediaList">{workMedia.map((item) => <article key={item.id} className="mediaRow"><div className="mediaThumb">{item.previewUrl ? <img src={item.previewUrl} alt="Vista previa del contenido" /> : item.type === "video" ? <video src={item.url} muted /> : <img src={item.url} alt="Contenido subido" />}</div><div className="mediaInfo"><strong>{item.name}</strong><small><b className="mediaCategoryBadge">{portfolioOption(data, item.category)}</b>{item.type === "video" ? "Video" : "Foto"}</small>{item.type === "video" && <><button className={`frameChoice ${item.framed ? "selected" : ""}`} onClick={() => updateMedia(item.id, "framed", !item.framed)}>{item.framed ? "✓ Con marco de teléfono" : "Sin marco de teléfono"}</button><div className="mediaLinks"><input value={item.instagram} onChange={(e) => updateMedia(item.id, "instagram", e.target.value)} placeholder="Link de Instagram" /><input value={item.tiktok} onChange={(e) => updateMedia(item.id, "tiktok", e.target.value)} placeholder="Link de TikTok" /></div></>}</div><button className="removeMedia" onClick={() => remove(item.id)} aria-label="Eliminar">×</button></article>)}</div>}<div className="brandUpload"><div><strong>Logos de marcas</strong><small>JPG, PNG, WebP o GIF · máximo 10 MB por logo.</small></div><label><input type="file" accept="image/*" multiple onChange={uploadBrands} />＋ Agregar logos</label></div>{brands.length > 0 && <div className="brandList">{brands.map((brand) => <article key={brand.id}><img src={brand.url} alt={brand.name} /><span>{brand.name}</span><button onClick={() => removeBrand(brand.id)} aria-label={`Eliminar ${brand.name}`}>×</button></article>)}</div>}</div>}
        {step === 3 && <div className="formPanel"><div className="twoFields"><Field label="Seguidores" value={data.followers} set={(v) => update("followers", v)} placeholder="Ej. 50.5 mil" /><Field label="Visualizaciones / mes" value={data.monthlyViews} set={(v) => update("monthlyViews", v)} placeholder="Ej. 700 K" /></div><Field label="Porcentaje de audiencia femenina" value={data.womenAudience} set={(v) => update("womenAudience", v)} placeholder="Ej. 82.9%" /><TextArea label="Países principales y porcentajes" value={data.topCountries} set={(v) => update("topCountries", v)} placeholder="Ej. Colombia 79% · México 12% · España 9%" /><div className="metricPreview"><span><b>{data.womenAudience || "—"}</b><small>Mujeres</small></span><div><strong>{data.followers || "—"}</strong><small>seguidores</small></div><div><strong>{data.monthlyViews || "—"}</strong><small>vistas mensuales</small></div></div></div>}
        {step === 4 && <div className="formPanel"><Choice title="Cada video UGC incluye" options={includeOptions} selected={data.includes} toggle={(v) => toggle("includes", v)} language={data.language} services /><div className="twoFields"><Field label="Video UGC" value={data.videoRate} set={(v) => update("videoRate", v)} placeholder="$350.000 COP" /><Field label="Reel en colaboración" value={data.collabRate} set={(v) => update("collabRate", v)} placeholder="$400.000 COP" /><Field label="1 historia con CTA" value={data.storyRate} set={(v) => update("storyRate", v)} placeholder="$80.000 COP" /><Field label="Pack 3 historias" value={data.storyPackRate} set={(v) => update("storyPackRate", v)} placeholder="$210.000 COP" /></div><Field label="Derechos de pauta por mes" value={data.usageRate} set={(v) => update("usageRate", v)} placeholder="$80.000 COP / mes" /></div>}
        {step === 5 && <div className="formPanel">{schema.contactVisual && <AssetSlot title="Visual de cierre" text="Aparece en la última lámina de esta plantilla." media={contactVisual} accept="image/*,video/*" onChange={(event) => uploadSpecial("__contact", event)} onRemove={() => contactVisual && remove(contactVisual.id)} />}<Choice title="Tipos de contenido" options={contentOptions} selected={data.contentTypes} toggle={(v) => toggle("contentTypes", v)} language={data.language} services /><div className="twoFields"><Field label="Correo" type="email" value={data.email} set={(v) => update("email", v)} placeholder="hola@tucorreo.com" /><Field label="WhatsApp" value={data.whatsapp} set={(v) => update("whatsapp", v)} placeholder="+57 300 000 0000" /><Field label="Instagram" value={data.instagram} set={(v) => update("instagram", v)} placeholder="@tuusuario" /><Field label="TikTok" value={data.tiktok} set={(v) => update("tiktok", v)} placeholder="@tuusuario" /></div><Field label="Disponibilidad" value={data.availability} set={(v) => update("availability", v)} placeholder="Disponible para campañas" /><Choice title="Servicios ofrecidos" options={serviceOptions} selected={data.services} toggle={(v) => toggle("services", v)} language={data.language} services /><div className="readyCard"><span>✦</span><div><strong>Tu presentación está lista</strong><p>Usa la rueda del mouse, el trackpad, las flechas o desliza para recorrerla.</p></div></div></div>}
        {step === 6 && <div className="formPanel publishPanel"><div className="publishUrl"><span>Tu enlace Brilla</span><div><b>brillaugc.com/</b><input aria-label="Nombre del enlace" value={data.portfolioSlug} placeholder="tu-nombre" onChange={(e) => updateSlug(e.target.value)} /></div><small className={`slugFeedback ${slugState}`}>{slugState === "checking" ? "Comprobando disponibilidad…" : slugState === "available" ? "✓ Este enlace está disponible" : slugState === "taken" ? "Ese enlace ya está ocupado" : slugState === "invalid" ? "Usa entre 3 y 80 caracteres, sin espacios" : "Se validará antes de publicar"}</small></div>{publishError && <p className="publishError" role="alert">{publishError}</p>}<ToggleRow checked={data.notifyViews} set={(value) => void saveViewNotifications(value)} title="Resumen de actividad" text={notificationBusy ? "Guardando tu preferencia…" : "Recibe un resumen semanal cuando haya actividad nueva. Puedes cambiar la frecuencia en tu cuenta."} /><div className="viewPulse"><span>◉</span><p><strong>{views} {views === 1 ? "visualización real" : "visualizaciones reales"}</strong><small>El panel de tu cuenta muestra visitantes aproximados y clics por canal.</small></p></div><div className="publishTools"><button onClick={openPortfolio}><span>↗</span><strong>Vista previa pública</strong><small>Comprueba la experiencia de la marca</small></button><button onClick={() => void downloadPdf()} disabled={pdfBusy}><span>↓</span><strong>{pdfBusy ? "Creando PDF…" : "Media kit PDF"}</strong><small>Descarga un archivo listo para compartir</small></button></div><div className={`publishReady ${published ? "published" : ""}`}><div><span>{published ? "✓" : "✦"}</span><p><strong>{published ? "Portafolio publicado" : publicationStatus === "unpublished" ? "Portafolio despublicado" : "Todo listo para brillar"}</strong><small>{published ? `Disponible en brillaugc.com/${data.portfolioSlug}` : "Publícalo cuando quieras. Tu borrador permanece guardado."}</small></p></div>{published ? <div className="publishReadyActions"><a href={`/${data.portfolioSlug}`} target="_blank" rel="noreferrer">Ver publicado ↗</a><button onClick={copyLink}>{copied ? "Enlace copiado ✓" : "Copiar enlace"}</button><button className="unpublishButton" onClick={unpublish} disabled={publishBusy}>Despublicar</button></div> : <button onClick={publish} disabled={publishBusy || slugState === "checking"}>{publishBusy ? "Publicando…" : "Publicar gratis ↗"}</button>}</div></div>}
        <div className="builderActions"><button className="backButton" onClick={() => requestStep(Math.max(0, step - 1))} disabled={step === 0}>← Atrás</button>{step < steps.length - 1 ? <button className="nextButton" onClick={() => requestStep(step + 1)}>Continuar <span>→</span></button> : <button className="nextButton" onClick={() => openPortfolio()}>Ver portafolio <span>↗</span></button>}</div>
      </section>
      {mobilePreviewOpen && <button className="mobilePreviewBackdrop isOpen" type="button" aria-label="Cerrar vista previa" onClick={() => setMobilePreviewOpen(false)} />}
      <aside ref={previewRef} className={`livePreview ${mobilePreviewOpen ? "mobilePreviewOpen" : ""}`} aria-label="Vista previa del portafolio"><div className="previewHeader"><div><span>VISTA PREVIA</span><strong>{data.format === "website" ? "Página web · cambios en vivo" : "Presentación horizontal · cambios en vivo"}</strong></div><small>{data.format === "website" ? "Scroll ↓" : "Desliza →"}</small><div className="mobilePreviewControls"><button className="mobilePreviewFullscreen" type="button" onClick={() => openPortfolio()}><span aria-hidden="true">↗</span><b>Abrir vista</b></button><button className="mobilePreviewToggle" type="button" aria-label="Cerrar vista previa" onClick={() => setMobilePreviewOpen(false)}>×</button></div></div>{data.format === "website" ? <WebsitePortfolio data={data} media={media} brands={brands} schema={schema} /> : <PortfolioDeck data={data} media={media} brands={brands} schema={schema} />}</aside>
    </div>
    {authPromptOpen && <div className="identityAuthOverlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthPromptOpen(false); }}><section className="identityAuthCard" role="dialog" aria-modal="true" aria-labelledby="identity-auth-title"><button className="identityAuthClose" type="button" onClick={() => setAuthPromptOpen(false)} aria-label="Volver a Identidad">×</button><span className="identityAuthMark">✦</span><small>IDENTIDAD COMPLETADA</small><h2 id="identity-auth-title">Para continuar, inicia sesión.</h2><p>Tu plantilla y la información que acabas de completar ya están guardadas en este dispositivo.</p><div className="identityAuthPromise"><span>✓</span><div><strong>No perderás tu progreso</strong><small>Al volver de Google continuarás exactamente desde aquí.</small></div></div>{authError && <p className="identityAuthError" role="alert">{authError}</p>}<LegalConsentCheckbox id="editor-login-legal-consent" checked={loginConsentChecked} onChange={setLoginConsentChecked} /><button className="googleContinue" type="button" onClick={continueWithGoogle} disabled={authBusy || checkingAuth || !loginConsentChecked}><b>G</b>{checkingAuth ? "Comprobando sesión…" : authBusy ? "Abriendo Google…" : "Continuar con Google"}<span>→</span></button><button className="identityAuthBack" type="button" onClick={() => setAuthPromptOpen(false)}>Seguir editando mi identidad</button></section></div>}
  </main>;
}

function Field({ label, value, set, placeholder, type = "text", help }: { label: string; value: string; set: (v: string) => void; placeholder: string; type?: string; help?: string }) { return <label className="builderField"><span>{label}</span>{help && <small className="fieldHelp">{help}</small>}<input type={type} value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} /></label>; }
function TextArea({ label, value, set, placeholder = "Escribe aquí…" }: { label: string; value: string; set: (v: string) => void; placeholder?: string }) { return <label className="builderField"><span>{label}</span><textarea value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} /></label>; }
function AssetSlot({ title, text, media, accept, onChange, onRemove }: { title: string; text: string; media: Media | null; accept: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; onRemove: () => void }) { return <div className={`assetSlot ${media ? "filled" : ""}`}>{media && <div className="assetSlotPreview">{media.type === "video" ? <video src={media.url} poster={media.previewUrl} muted playsInline /> : <img src={media.url} alt={title} />}</div>}<div><strong>{media ? media.name : title}</strong><small>{media ? `${title} · listo` : text}</small></div><label><input type="file" accept={accept} onChange={onChange} />{media ? "Cambiar" : "Subir archivo"}</label>{media && <button onClick={onRemove} aria-label={`Eliminar ${title}`}>×</button>}</div>; }
function ToggleRow({ checked, set, title, text }: { checked: boolean; set: (value: boolean) => void; title: string; text: string }) { return <label className="toggleRow"><div><strong>{title}</strong><small>{text}</small></div><input aria-label={title} type="checkbox" checked={checked} onChange={(event) => set(event.target.checked)} /><i aria-hidden="true" /></label>; }
function Choice({ title, options, selected, toggle, language, services = false }: { title: string; options: string[]; selected: string[]; toggle: (v: string) => void; language: Portfolio["language"]; services?: boolean }) { return <div className="choiceField"><span>{title}</span><div className={services ? "serviceGrid" : "chipList"}>{options.map((option) => <button key={option} className={selected.includes(option) ? "selected" : ""} onClick={() => toggle(option)}><i>{selected.includes(option) ? "✓" : "+"}</i>{portfolioOption({ language }, option)}</button>)}</div></div>; }
function Theme({ name, note, mode, font, defaultFont, defaultAccent, current, choose, accent, fontStyle, setAccent, setFont, resetStyle }: { name: string; note: string; mode: string; font: string; defaultFont: string; defaultAccent: string; current: string; choose: (mode: string) => void; accent: string; fontStyle: string; setAccent: (value: string) => void; setFont: (value: string) => void; resetStyle: (accent: string, fontStyle: string) => void }) {
  const selected = current === mode;
  return <article className={`themeCard ${selected ? "selected" : ""}`} style={{ "--theme-accent": accent } as CSSProperties}>
    <button className="themeSelectButton" type="button" onClick={() => choose(mode)} aria-pressed={selected}><i className={`themePreview ${mode}`}><b>{name}</b><em>Aa</em><u /></i><strong>{name}</strong><small>{note}</small><span>{templateSchemas[mode].label} · {font}</span></button>
    {selected && <div className="templateQuickControls"><div><strong>Color</strong><div className="quickColors">{colors.map((color) => <button key={color} type="button" aria-label={`Usar color ${color} en ${name}`} className={accent === color ? "selected" : ""} style={{ background: color }} onClick={() => setAccent(color)} />)}<label aria-label={`Elegir color personalizado para ${name}`}><input type="color" value={accent} onChange={(event) => setAccent(event.target.value)} />＋</label></div></div><div><strong>Tipografía</strong><div className="quickFonts">{fontOptions.map((option) => <button key={option.value} type="button" className={fontStyle === option.value ? "selected" : ""} onClick={() => setFont(option.value)}><b>{option.sample}</b><span>{option.name}</span></button>)}</div></div><button className="resetTemplateStyle" type="button" onClick={() => resetStyle(defaultAccent, defaultFont)}>↺ Restablecer estilo</button></div>}
  </article>;
}

function emailLink(value: string) { return `mailto:${value.trim()}`; }
function whatsappLink(value: string) { return `https://wa.me/${value.replace(/\D/g, "")}`; }
function socialLink(network: "instagram" | "tiktok", value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${network}.com/${trimmed.replace(/^@/, "")}`;
}

function hasText(value: string) { return value.trim().length > 0; }
function hasAnyText(...values: string[]) { return values.some(hasText); }
function portfolioAccent(data: Portfolio) { return data.accent || "#6d4dff"; }

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
  const ticker = data.niches.filter(Boolean);
  const icons = ["✦", "♡", "☆", "❀", "◎", "✧", "⌂"];
  const aboutTags = Array.from(new Set([...data.niches, ...data.clientTypes]));
  const hasAbout = hasText(data.bio) || aboutTags.length > 0 || data.contentTypes.length > 0;
  const hasAudience = hasAnyText(data.followers, data.monthlyViews, data.womenAudience, data.topCountries, data.instagram, data.tiktok);
  const hasRates = hasAnyText(data.videoRate, data.collabRate, data.storyRate, data.storyPackRate, data.usageRate) || data.includes.length > 0;
  const hasContact = hasAnyText(data.email, data.whatsapp, data.instagram, data.tiktok, data.availability);
  return <div className={`websitePortfolio website-${webTemplate} font-${data.fontStyle} ${expanded ? "expanded" : "compact"}`} style={{ "--site-accent": portfolioAccent(data) } as CSSProperties}>
    <header className="siteNav">{hasText(firstName) && <strong>{firstName}<i>✦</i></strong>}<nav>{groups.length > 0 && <a href="#web-work">{portfolioText(data, "Trabajo", "Work")}</a>}{data.services.length > 0 && <a href="#web-services">{portfolioText(data, "Servicios", "Services")}</a>}{hasRates && <a href="#web-rates">{portfolioText(data, "Tarifas", "Rates")}</a>}{hasText(data.email) && <a className="navContact" href={emailLink(data.email)} data-analytics-target="email">{portfolioText(data, "Hablemos ↗", "Let's talk ↗")}</a>}</nav></header>
    <section className="siteHero webSection"><div className="webHeroCopy">{hasText(data.location) && <small><i>✦</i> UGC CREATOR — {data.location}</small>}{hasText(data.name) && <h1>{data.name}</h1>}{hasText(data.title) && <p className="heroRole">{data.title}</p>}{hasText(data.bio) && <p className="heroBio">{data.bio}</p>}{(groups.length > 0 || hasText(data.email)) && <div className="webHeroActions">{groups.length > 0 && <a className="heroCta" href="#web-work">{portfolioText(data, "Ver mi trabajo ↓", "View my work ↓")}</a>}{hasText(data.email) && <a className="heroGhost" href={emailLink(data.email)} data-analytics-target="email">{portfolioText(data, "Escríbeme", "Contact me")}</a>}</div>}</div>{(portrait || hasText(data.availability)) && <div className="webHeroVisual">{portrait && <MediaCard item={portrait} label={portfolioText(data, "TU FOTO", "YOUR PHOTO")} index={0} />}<span className="heroSticker st1">✦</span><span className="heroSticker st2">☆</span>{hasText(data.availability) && <em className="heroNote">{data.availability}</em>}</div>}</section>
    {ticker.length > 0 && <div className="webMarquee" aria-hidden><div>{Array.from({ length: 2 }, (_, dup) => ticker.map((word, i) => <span key={`${dup}-${i}`}>{portfolioOption(data, word)}<i>✦</i></span>))}</div></div>}
    {hasAnyText(data.followers, data.monthlyViews, data.womenAudience) || data.niches.length > 0 ? <div className="webProof">{hasText(data.followers) && <span><b>{data.followers}</b>{portfolioText(data, "seguidores", "followers")}</span>}{hasText(data.monthlyViews) && <span><b>{data.monthlyViews}</b>{portfolioText(data, "vistas / mes", "views / month")}</span>}{hasText(data.womenAudience) && <span><b>{data.womenAudience}</b>{portfolioText(data, "audiencia femenina", "female audience")}</span>}{data.niches.length > 0 && <span><b>{String(data.niches.length).padStart(2, "0")}</b>{portfolioText(data, "nichos creativos", "creative niches")}</span>}</div> : null}
    {hasAbout && <section className="webAbout webSection" id="web-about"><div className="webSectionTitle"><small>01 — {portfolioText(data, "SOBRE MÍ", "ABOUT ME")}</small><h2>{portfolioText(data, "Historias reales que conectan con tu audiencia.", "Real stories that connect with your audience.")}</h2></div><div className="aboutBody">{hasText(data.bio) && <p>{data.bio}</p>}{aboutTags.length > 0 && <div className="webTags">{aboutTags.map((item) => <span key={item}>{portfolioOption(data, item)}</span>)}</div>}{data.contentTypes.length > 0 && <div className="aboutContent"><b>{portfolioText(data, "CONTENIDO QUE CREO", "CONTENT I CREATE")}</b><p>{portfolioOptions(data, data.contentTypes).join(" · ")}</p></div>}</div></section>}
    {groups.length > 0 && <section className="siteWork webSection" id="web-work"><div className="webSectionTitle"><small>02 — {portfolioText(data, "PORTAFOLIO", "PORTFOLIO")}</small>{hasText(data.campaignTitle) && <h2>{data.campaignTitle}</h2>}</div>{groups.map((group, gi) => <article className="webProjectGroup" key={group.category}><header><h3><i>{icons[gi % icons.length]}</i>{portfolioOption(data, group.category)}</h3><span>{String(group.items.length).padStart(2, "0")} / {group.category === "Fotografía" ? schema.photoLimit : schema.categoryLimit} {portfolioText(data, "PIEZAS", "PIECES")}</span></header><div style={{ "--work-count": Math.min(group.items.length, 4) } as CSSProperties}>{group.items.map((item, index) => <MediaCard key={item.id} item={item} label={portfolioOption(data, item.category)} index={index} />)}</div></article>)}</section>}
    {brands.length > 0 && <section className="webBrands webSection"><div className="webSectionTitle center"><small>03 — {portfolioText(data, "EXPERIENCIA", "EXPERIENCE")}</small><h2>{portfolioText(data, "Marcas que ya brillaron conmigo.", "Brands that have already shined with me.")}</h2></div><div className="brandGrid">{brands.map((brand) => <article key={brand.id}><img src={brand.url} alt={`Logo de ${brand.name}`} /><span>{brand.name}</span></article>)}</div></section>}
    {hasAudience && <section className="webAudience webSection"><div className="audienceCopy"><small>04 — {portfolioText(data, "AUDIENCIA", "AUDIENCE")}</small><h2>{portfolioText(data, "Una comunidad que confía en lo que recomiendo.", "A community that trusts what I recommend.")}</h2>{hasAnyText(data.followers, data.monthlyViews, data.womenAudience) && <div className="webNumbers">{hasText(data.followers) && <span><b>{data.followers}</b>{portfolioText(data, "seguidores", "followers")}</span>}{hasText(data.monthlyViews) && <span><b>{data.monthlyViews}</b>{portfolioText(data, "vistas / mes", "views / month")}</span>}{hasText(data.womenAudience) && <span><b>{data.womenAudience}</b>{portfolioText(data, "mujeres", "women")}</span>}</div>}{hasAnyText(data.instagram, data.tiktok) && <div className="audienceSocial">{hasText(data.instagram) && <a href={socialLink("instagram", data.instagram)} target="_blank" rel="noreferrer" data-analytics-target="instagram"><b>IG</b>{data.instagram}</a>}{hasText(data.tiktok) && <a href={socialLink("tiktok", data.tiktok)} target="_blank" rel="noreferrer" data-analytics-target="tiktok"><b>TK</b>{data.tiktok}</a>}</div>}</div>{(hasText(data.womenAudience) || countries.length > 0) && <div className="webAudienceCard">{hasText(data.womenAudience) && <div className="webAudienceRing"><b>{data.womenAudience}</b><span>{portfolioText(data, "audiencia femenina", "female audience")}</span></div>}{countries.length > 0 && <div className="countryBars">{countries.map((country, index) => <p key={country}><span>{country}</span><i style={{ width: `${Math.max(18, 88 - index * 18)}%` }} /></p>)}</div>}</div>}</section>}
    {data.services.length > 0 && <section className="webServices webSection" id="web-services"><div className="webSectionTitle"><small>05 — {portfolioText(data, "SERVICIOS", "SERVICES")}</small><h2>{portfolioText(data, "Todo lo que puedo crear para tu marca.", "Everything I can create for your brand.")}</h2></div><div className="serviceCards">{data.services.map((service, index) => <article key={service}><span>{String(index + 1).padStart(2, "0")}</span><h3>{portfolioOption(data, service)}</h3><b>{icons[index % icons.length]}</b></article>)}</div></section>}
    {hasRates && <section className="webRates webSection" id="web-rates"><div className="webSectionTitle"><small>06 — {portfolioText(data, "TARIFAS", "RATES")}</small><h2>{portfolioText(data, "Inversión clara, sin sorpresas.", "Clear pricing, no surprises.")}</h2></div><div className="rateBoard">{(hasText(data.videoRate) || data.includes.length > 0) && <article className="rateHero"><small>{portfolioText(data, "EL FAVORITO ✦", "THE FAVORITE ✦")}</small><h3>Video UGC</h3>{hasText(data.videoRate) && <b>{data.videoRate}</b>}{data.includes.length > 0 && <ul>{data.includes.map((include) => <li key={include}><i>✓</i>{portfolioOption(data, include)}</li>)}</ul>}</article>}{hasAnyText(data.collabRate, data.storyRate, data.storyPackRate, data.usageRate) && <div className="rateGrid">{hasText(data.collabRate) && <article><span>{portfolioText(data, "Reel en colaboración", "Collaborative Reel")}</span><b>{data.collabRate}</b></article>}{hasText(data.storyRate) && <article><span>{portfolioText(data, "1 historia con CTA", "1 Story with CTA")}</span><b>{data.storyRate}</b></article>}{hasText(data.storyPackRate) && <article><span>{portfolioText(data, "Pack de 3 historias", "3-story Pack")}</span><b>{data.storyPackRate}</b></article>}{hasText(data.usageRate) && <article><span>{portfolioText(data, "Derechos de pauta", "Paid Usage Rights")}</span><b>{data.usageRate}</b></article>}</div>}</div></section>}
    {hasContact && <section className="webContact webSection" id="web-contact"><small>{portfolioText(data, "¿CREAMOS ALGO JUNTOS?", "SHALL WE CREATE SOMETHING TOGETHER?")}</small><h2>{portfolioText(data, "Tu marca tiene una historia. Hagámosla brillar.", "Your brand has a story. Let's make it shine.")}</h2>{hasText(data.email) && <a className="contactCta" href={emailLink(data.email)} data-analytics-target="email">{portfolioText(data, "Empecemos un proyecto", "Let's start a project")} <span>↗</span></a>}{hasAnyText(data.email, data.whatsapp, data.instagram, data.tiktok) && <div className="contactGrid">{hasText(data.email) && <p><b>EMAIL</b><a href={emailLink(data.email)} data-analytics-target="email">{data.email}</a></p>}{hasText(data.whatsapp) && <p><b>WHATSAPP</b><a href={whatsappLink(data.whatsapp)} target="_blank" rel="noreferrer" data-analytics-target="whatsapp">{data.whatsapp}</a></p>}{hasText(data.instagram) && <p><b>INSTAGRAM</b><a href={socialLink("instagram", data.instagram)} target="_blank" rel="noreferrer" data-analytics-target="instagram">{data.instagram}</a></p>}{hasText(data.tiktok) && <p><b>TIKTOK</b><a href={socialLink("tiktok", data.tiktok)} target="_blank" rel="noreferrer" data-analytics-target="tiktok">{data.tiktok}</a></p>}</div>}{hasText(data.availability) && <em className="contactNote">{data.availability}</em>}</section>}
    <footer className="siteFooter">{hasText(data.name) && <strong>{data.name} ✦</strong>}{hasText(data.location) && <span>{data.location}</span>}<span>{portfolioText(data, "Hecho con brilla", "Made with brilla")}</span></footer>
  </div>;
}

export function PortfolioDeck({ data, media, brands, schema, expanded = false }: { data: Portfolio; media: Media[]; brands: BrandAsset[]; schema: TemplateSchema; expanded?: boolean }) {
  const deck = useRef<HTMLDivElement>(null); const [active, setActive] = useState(0); const dragging = useRef<{ x: number; left: number } | null>(null);
  const visibleCategories = data.portfolioCategories.filter((item) => media.some((asset) => asset.category === item));
  const showAudience = hasAnyText(data.followers, data.monthlyViews, data.womenAudience, data.topCountries, data.instagram, data.tiktok);
  const showMainRate = hasText(data.videoRate) || data.includes.length > 0;
  const showSecondaryRates = hasAnyText(data.collabRate, data.storyRate, data.storyPackRate, data.usageRate);
  const showContact = hasAnyText(data.email, data.whatsapp, data.instagram, data.tiktok, data.availability) || data.services.length > 0 || data.contentTypes.length > 0 || data.clientTypes.length > 0 || media.some((item) => item.category === "__contact");
  const slideCount = 1 + visibleCategories.length + (brands.length ? 1 : 0) + Number(showAudience) + Number(showMainRate) + Number(showSecondaryRates) + Number(showContact);
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
    ...visibleCategories.map((category) => category === "Fotografía" ? <PhotoSlide key={category} {...common} index={position++} /> : <GallerySlide key={category} {...common} index={position++} category={category} title={category === "Campañas" ? data.campaignTitle : category === "Cabello" ? portfolioText(data, "Cuidado del cabello", "Haircare") : category === "Beauty" ? portfolioText(data, "Skincare, maquillaje y perfumería", "Skincare, makeup and fragrance") : category === "Familia" ? portfolioText(data, "Familia y hogar", "Family and home") : category === "Empresas" ? portfolioText(data, "Empresas y otros productos", "Brands and other products") : portfolioText(data, "Hoteles, restaurantes y lugares", "Hotels, restaurants and places")} icon={category === "Beauty" ? "✦" : category === "Familia" ? "⌂" : category === "Lugares" ? "⌖" : "♡"} />),
    ...(brands.length ? [<BrandsSlide key="brands" data={data} brands={brands} active={active} index={position++} />] : []),
    ...(showAudience ? [<AudienceSlide key="audience" {...common} index={position++} />] : []),
    ...(showMainRate ? [<RateSlide key="rate-main" {...common} index={position++} secondary={false} />] : []),
    ...(showSecondaryRates ? [<RateSlide key="rate-secondary" {...common} index={position++} secondary />] : []),
    ...(showContact ? [<ContactSlide key="contact" {...common} index={position++} />] : [])];
  return <div className={`portfolioDeck deck-${template} font-${data.fontStyle} ${expanded ? "expanded" : "compact"}`} style={{ "--deck-accent": portfolioAccent(data) } as CSSProperties}>
    <div ref={deck} className="deckTrack" role="slider" tabIndex={0} aria-label="Lámina visible del portafolio UGC" aria-valuemin={1} aria-valuemax={slideCount} aria-valuenow={active + 1} onScroll={onScroll} onWheel={onWheel} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onKeyDown={(e) => { if (e.key === "ArrowRight") go(active + 1); if (e.key === "ArrowLeft") go(active - 1); }}>
      {slides}
    </div>
    <div className="deckControls" aria-label="Controles de presentación"><button onClick={() => go(active - 1)} disabled={active === 0}>←</button><div>{Array.from({ length: slideCount }, (_, i) => <button key={i} className={active === i ? "active" : ""} onClick={() => go(i)} aria-label={`Ir a lámina ${i + 1}`} />)}</div><span>{String(active + 1).padStart(2, "0")} / {slideCount}</span><button onClick={() => go(active + 1)} disabled={active === slideCount - 1}>→</button></div>
  </div>;
}

type SlideProps = { data: Portfolio; active: number; index: number; mediaFor: (category: string, count: number, offset?: number) => Array<Media | null>; schema: TemplateSchema; portrait: Media | null; contactVisual: Media | null };
function IntroSlide({ data, active, index, portrait }: SlideProps) { return <section className={`deckSlide intro ${active === index ? "isActive" : ""}`}><div className="introCopy"><span>{portfolioText(data, "CREADORA DE CONTENIDO UGC", "UGC CONTENT CREATOR")}</span>{hasText(data.title) && <h1>{data.title}</h1>}{hasText(data.bio) && <p>{data.bio}</p>}{hasText(data.location) && <small>{data.location}</small>}</div>{portrait && <MediaCard item={portrait} label={portfolioText(data, "TU RETRATO", "YOUR PORTRAIT")} index={0} />}</section>; }
function GallerySlide({ active, index, mediaFor, schema, category, title, icon }: SlideProps & { category: string; title: string; icon?: string }) { const items = mediaFor(category, category === "Fotografía" ? schema.photoLimit : schema.categoryLimit); return <section className={`deckSlide gallery ${active === index ? "isActive" : ""}`}><div className="slideTitle">{icon && <i>{icon}</i>}<h2>{title}</h2></div><div className={`galleryRow count-${items.length}`} style={{ "--media-count": items.length } as CSSProperties}>{items.map((item, i) => <MediaCard key={item?.id ?? `${index}-${i}`} item={item} label={category} index={i} />)}</div></section>; }
function PhotoSlide({ data, active, index, mediaFor, schema }: SlideProps) { const items = mediaFor("Fotografía", schema.photoLimit); return <section className={`deckSlide photoMosaic count-${items.length} ${active === index ? "isActive" : ""}`}><h2>{portfolioText(data, "Fotografía UGC", "UGC Photography")}</h2><div>{items.map((item, i) => <MediaCard key={item?.id ?? i} item={item} label={portfolioOption(data, data.niches[i % Math.max(1, data.niches.length)] || "UGC")} index={i} />)}</div></section>; }
function BrandsSlide({ data, brands, active, index }: { data: Portfolio; brands: BrandAsset[]; active: number; index: number }) { return <section className={`deckSlide brands ${active === index ? "isActive" : ""}`}><small>{portfolioText(data, "EXPERIENCIA", "EXPERIENCE")}</small><h2>{portfolioText(data, "Marcas con las que he trabajado", "Brands I have worked with")}</h2><div>{brands.map((brand) => <article key={brand.id}><img src={brand.url} alt={`${portfolioText(data, "Logo de", "Logo for")} ${brand.name}`} /><span>{brand.name}</span></article>)}</div></section>; }
function AudienceSlide({ data, active, index }: SlideProps) { const countries = data.topCountries.split("·").map((item) => item.trim()).filter(Boolean); return <section className={`deckSlide audience ${active === index ? "isActive" : ""}`}><div><small>{portfolioText(data, "MI AUDIENCIA", "MY AUDIENCE")}</small><h2>{portfolioText(data, "Mi comunidad.", "My community.")}</h2>{hasText(data.womenAudience) && <div className="audienceRing"><strong>{data.womenAudience}</strong><span>{portfolioText(data, "mujeres", "women")}</span></div>}{hasAnyText(data.followers, data.monthlyViews) && <div className="audienceStats">{hasText(data.followers) && <span><b>{data.followers}</b>{portfolioText(data, "seguidores", "followers")}</span>}{hasText(data.monthlyViews) && <span><b>{data.monthlyViews}</b>{portfolioText(data, "vistas / mes", "views / month")}</span>}</div>}</div>{(countries.length > 0 || hasAnyText(data.instagram, data.name) || data.niches.length > 0) && <div className="countryPanel">{countries.length > 0 && <><h3>{portfolioText(data, "Principales ubicaciones", "Top locations")}</h3>{countries.map((country, i) => <p key={country}><span>{country}</span><i style={{ width: `${Math.max(14, 86 - i * 17)}%` }} /></p>)}</>}{hasAnyText(data.instagram, data.name) || data.niches.length > 0 ? <div className="socialCard">{hasText(data.instagram) && <b>{data.instagram}</b>}{hasText(data.name) && <span>{data.name}</span>}{data.niches.length > 0 && <small>{portfolioOptions(data, data.niches).join(" · ")}</small>}</div> : null}</div>}</section>; }
function RateSlide({ data, active, index, secondary }: SlideProps & { secondary: boolean }) { return <section className={`deckSlide rates ${secondary ? "secondary" : ""} ${active === index ? "isActive" : ""}`}><div className="rateCopy"><small>{portfolioText(data, "TARIFAS", "RATES")}</small>{secondary ? <><h2>{portfolioText(data, "Historias y pauta", "Stories and paid usage")}</h2>{hasText(data.collabRate) && <Rate name={portfolioText(data, "Reel en colaboración", "Collaborative Reel")} price={data.collabRate} />}{hasText(data.storyRate) && <Rate name={portfolioText(data, "1 historia con CTA", "1 Story with CTA")} price={data.storyRate} />}{hasText(data.storyPackRate) && <Rate name={portfolioText(data, "Pack de 3 historias", "3-story Pack")} price={data.storyPackRate} />}{hasText(data.usageRate) && <Rate name={portfolioText(data, "Derechos de pauta / mes", "Paid Usage Rights / month")} price={data.usageRate} />}</> : <><h2>Video UGC</h2>{data.includes.length > 0 && <><p>{portfolioText(data, "Incluye:", "Includes:")}</p><ul>{data.includes.map((item) => <li key={item}>✓ {portfolioOption(data, item)}</li>)}</ul></>}{hasText(data.videoRate) && <strong className="mainPrice">{data.videoRate}</strong>}</>}</div><div className="rateVisual"><span>UGC</span><i>✦</i><b>{secondary ? "SOCIAL" : "CREATE"}</b></div></section>; }
function Rate({ name, price }: { name: string; price: string }) { return <div className="rateLine"><span>{name}</span><strong>{price}</strong></div>; }
function ContactSlide({ data, active, index, contactVisual }: SlideProps) { return <section className={`deckSlide contact ${active === index ? "isActive" : ""}`}>{contactVisual && <div className="phoneFrame"><MediaCard item={contactVisual} label="LET'S CREATE" index={0} /></div>}<div className="contactCopy">{data.services.length > 0 && <small>{portfolioOptions(data, data.services).join(" · ")}</small>}{data.contentTypes.length > 0 && <h2>{portfolioOptions(data, data.contentTypes).join(" · ")}</h2>}{data.clientTypes.length > 0 && <div className="deckClientTypes">{data.clientTypes.map((type) => <span key={type}>{portfolioOption(data, type)}</span>)}</div>}<em>{portfolioText(data, "¡Trabajemos juntos!", "Let's work together!")}</em>{hasText(data.whatsapp) && <p><b>WhatsApp</b><a href={whatsappLink(data.whatsapp)} target="_blank" rel="noreferrer" data-analytics-target="whatsapp">{data.whatsapp}</a></p>}{hasText(data.email) && <p><b>Email</b><a href={emailLink(data.email)} data-analytics-target="email">{data.email}</a></p>}{hasText(data.instagram) && <p><b>Instagram</b><a href={socialLink("instagram", data.instagram)} target="_blank" rel="noreferrer" data-analytics-target="instagram">{data.instagram}</a></p>}{hasText(data.tiktok) && <p><b>TikTok</b><a href={socialLink("tiktok", data.tiktok)} target="_blank" rel="noreferrer" data-analytics-target="tiktok">{data.tiktok}</a></p>}{hasText(data.availability) && <span>{data.availability}</span>}</div></section>; }
function MediaCard({ item, label, index }: { item: Media | null; label: string; index: number }) { const framed = item?.type === "video" && item.framed; return <article className={`deckMedia media-${index} ${framed ? "videoCard" : item?.type === "video" ? "videoPlain" : ""}`}>{item ? item.type === "video" ? <>{framed && <i className="videoNotch" />}<video src={item.url} poster={item.previewUrl} muted playsInline controls preload="metadata" /><div className="videoSocials">{item.instagram && <a href={item.instagram} target="_blank" rel="noreferrer" aria-label="Ver en Instagram" data-analytics-target="instagram">IG</a>}{item.tiktok && <a href={item.tiktok} target="_blank" rel="noreferrer" aria-label="Ver en TikTok" data-analytics-target="tiktok">TK</a>}</div></> : <img src={item.url} alt={`Pieza UGC de ${label}`} loading="lazy" /> : <div className="mediaPlaceholder"><span>{label}</span><b>{String(index + 1).padStart(2, "0")}</b><i>▶</i></div>}</article>; }
