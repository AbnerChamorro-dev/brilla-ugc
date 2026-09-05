"use client";

/* Vinext currently keeps plain anchors stable across the public/editor client boundary. */
/* eslint-disable @next/next/no-html-link-for-pages */

import {
  PortfolioDeck,
  WebsitePortfolio,
  templateSchemas,
  type BrandAsset,
  type Media,
  type Portfolio,
} from "../crear/page";
import "./public-portfolio.css";

export default function PublicPortfolioClient({ data, media, brands }: { data: Portfolio; media: Media[]; brands: BrandAsset[] }) {
  const selectedTemplate = data.format === "website" ? data.webTemplate : data.template;
  const schema = templateSchemas[selectedTemplate] ?? templateSchemas.muse;

  return <main className={`publicPortfolioPage public-${data.format}`}>
    <a className="publicBrillaBadge" href="/" aria-label="Crear mi portafolio con Brilla">Hecho con <strong>brilla<span>•</span></strong></a>
    {data.format === "presentation"
      ? <PortfolioDeck data={data} media={media} brands={brands} schema={schema} expanded />
      : <WebsitePortfolio data={data} media={media} brands={brands} schema={schema} expanded />}
  </main>;
}
