import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const allowedEvents = new Set(["view", "click"]);
const allowedTargets = new Set(["portfolio", "email", "whatsapp", "instagram", "tiktok"]);

type AnalyticsPayload = {
  slug?: unknown;
  visitorToken?: unknown;
  event?: unknown;
  target?: unknown;
};

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 2048) return NextResponse.json({ recorded: false }, { status: 413 });

  let payload: AnalyticsPayload;
  try {
    payload = await request.json() as AnalyticsPayload;
  } catch {
    return NextResponse.json({ recorded: false }, { status: 400 });
  }

  const slug = typeof payload.slug === "string" ? payload.slug : "";
  const visitorToken = typeof payload.visitorToken === "string" ? payload.visitorToken : "";
  const event = typeof payload.event === "string" ? payload.event : "";
  const target = typeof payload.target === "string" ? payload.target : "";
  const validPair = (event === "view" && target === "portfolio") || (event === "click" && target !== "portfolio");

  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    || slug.length < 3
    || slug.length > 80
    || !/^[a-f0-9]{64}$/.test(visitorToken)
    || !allowedEvents.has(event)
    || !allowedTargets.has(target)
    || !validPair
  ) {
    return NextResponse.json({ recorded: false }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return NextResponse.json({ recorded: false }, { status: 503 });

  const supabase = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.rpc("record_portfolio_event", {
    requested_slug: slug,
    visitor_token: visitorToken,
    requested_event: event,
    requested_target: target,
  });

  if (error) return NextResponse.json({ recorded: false }, { status: 503 });
  return NextResponse.json({ recorded: data === true }, { status: 202 });
}
