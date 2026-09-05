import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import type { BrandAsset, Media, Portfolio } from "../crear/page";
import PublicPortfolioClient from "./public-portfolio-client";

type PublicMediaRecord = {
  asset_id: number;
  kind: "media" | "brand";
  storage_path: string;
  preview_path: string | null;
  original_name: string;
  media_type: "video" | "image";
  category: string;
  framed: boolean;
  instagram: string;
  tiktok: string;
  sort_order: number;
};

type PublicPortfolioRecord = {
  slug: string;
  updated_at: string;
  content: Portfolio;
  media: PublicMediaRecord[];
};

function publicSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

const getPublishedPortfolio = cache(async (slug: string) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const supabase = publicSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_published_portfolio", { requested_slug: slug });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;
  return data as PublicPortfolioRecord;
});

async function signPath(path?: string | null) {
  if (!path) return undefined;
  const supabase = publicSupabaseClient();
  if (!supabase) return undefined;
  const { data, error } = await supabase.storage.from("creator-media").createSignedUrl(path, 60 * 60);
  return error ? undefined : data?.signedUrl;
}

async function resolvePublicMedia(records: PublicMediaRecord[]) {
  const resolved = await Promise.all(records.map(async (record) => {
    const [url, previewUrl] = await Promise.all([signPath(record.storage_path), signPath(record.preview_path)]);
    if (!url) return null;
    if (record.kind === "brand") {
      return { kind: "brand" as const, asset: { id: record.asset_id, name: record.original_name, url, storagePath: record.storage_path } satisfies BrandAsset };
    }
    return {
      kind: "media" as const,
      asset: {
        id: record.asset_id,
        name: record.original_name,
        type: record.media_type,
        url,
        previewUrl,
        storagePath: record.storage_path,
        previewPath: record.preview_path ?? undefined,
        framed: record.framed,
        category: record.category,
        instagram: record.instagram,
        tiktok: record.tiktok,
      } satisfies Media,
    };
  }));
  return resolved.filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const portfolio = await getPublishedPortfolio(slug);
  if (!portfolio) return { title: "Portafolio no disponible — Brilla", robots: { index: false, follow: false }, openGraph: { images: [] }, twitter: { images: [] } };

  const title = `${portfolio.content.name} — Portafolio UGC`;
  const description = portfolio.content.bio.slice(0, 160);
  const portrait = portfolio.media.find((item) => item.kind === "media" && item.category === "__portrait");
  const image = await signPath(portrait?.preview_path ?? portrait?.storage_path);

  return {
    title,
    description,
    alternates: { canonical: `/${portfolio.slug}` },
    robots: { index: true, follow: true },
    openGraph: { type: "profile", title, description, images: image ? [{ url: image, alt: `Portafolio UGC de ${portfolio.content.name}` }] : [] },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : [] },
  };
}

export default async function PublicPortfolioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const portfolio = await getPublishedPortfolio(slug);
  if (!portfolio) notFound();

  const resolved = await resolvePublicMedia(portfolio.media);
  const media = resolved.filter((item) => item.kind === "media").map((item) => item.asset as Media);
  const brands = resolved.filter((item) => item.kind === "brand").map((item) => item.asset as BrandAsset);
  return <PublicPortfolioClient data={portfolio.content} media={media} brands={brands} />;
}
