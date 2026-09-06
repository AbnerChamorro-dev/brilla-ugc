// @ts-expect-error Deno resolves pinned npm specifiers in the Edge Functions runtime.
import { createClient } from "npm:@supabase/supabase-js@2.115.0";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

type ActivityDigest = {
  delivery_id: string;
  recipient_email: string;
  creator_name: string;
  portfolio_slug: string;
  digest_frequency: "daily" | "weekly";
  period_start: string;
  period_end: string;
  total_views: number;
  unique_visitors: number;
  email_clicks: number;
  whatsapp_clicks: number;
  instagram_clicks: number;
  tiktok_clicks: number;
};

type ResendResponse = {
  id?: string;
  message?: string;
  name?: string;
};

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const NUMBER_FORMATTER = new Intl.NumberFormat("es-CO");
const DATE_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

function asCount(value: number) {
  return NUMBER_FORMATTER.format(Number(value) || 0);
}

function validEmailFrom(value: string) {
  const bracketedAddress = value.match(/<([^<>]+)>\s*$/)?.[1];
  const address = (bracketedAddress ?? value).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)
    && !address.endsWith("@tu-dominio-verificado.com")
    && !address.endsWith(".example");
}

function digestCopy(digest: ActivityDigest) {
  const periodEnd = new Date(digest.period_end);
  periodEnd.setUTCDate(periodEnd.getUTCDate() - 1);

  if (digest.digest_frequency === "daily") {
    return {
      eyebrow: "TU RESUMEN DE AYER",
      subject: `${asCount(digest.total_views)} visitas nuevas a tu portafolio`,
      period: DATE_FORMATTER.format(periodEnd),
    };
  }

  return {
    eyebrow: "TU SEMANA EN BRILLA",
    subject: `${asCount(digest.total_views)} visitas esta semana en tu portafolio`,
    period: `${DATE_FORMATTER.format(new Date(digest.period_start))}–${DATE_FORMATTER.format(periodEnd)}`,
  };
}

function renderEmail(digest: ActivityDigest, siteUrl: string) {
  const copy = digestCopy(digest);
  const creatorName = escapeHtml(digest.creator_name || "creadora");
  const portfolioUrl = new URL(`/${encodeURIComponent(digest.portfolio_slug)}`, siteUrl).toString();
  const accountUrl = new URL("/cuenta", siteUrl).toString();
  const totalClicks = Number(digest.email_clicks) + Number(digest.whatsapp_clicks)
    + Number(digest.instagram_clicks) + Number(digest.tiktok_clicks);

  const text = [
    `Hola, ${digest.creator_name || "creadora"}.`,
    "",
    `${copy.eyebrow} · ${copy.period}`,
    `Visitas: ${asCount(digest.total_views)}`,
    `Personas: ${asCount(digest.unique_visitors)}`,
    `Clics de contacto: ${asCount(totalClicks)}`,
    "",
    `Ver mi portafolio: ${portfolioUrl}`,
    `Administrar correos: ${accountUrl}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f6f4ff;color:#17132f;font-family:Arial,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden">Tu actividad de ${escapeHtml(copy.period)} ya está lista.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f4ff;padding:28px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #ded8f5;border-radius:24px;overflow:hidden">
          <tr><td style="padding:28px 32px;background:#211a49;color:#fff;font-size:25px;font-weight:800;letter-spacing:-1px">brilla<span style="color:#70f0cf">•</span></td></tr>
          <tr><td style="padding:38px 32px 12px">
            <p style="margin:0 0 12px;color:#6d4dff;font-size:12px;font-weight:800;letter-spacing:1.5px">${escapeHtml(copy.eyebrow)} · ${escapeHtml(copy.period)}</p>
            <h1 style="margin:0;font-size:30px;line-height:1.15;letter-spacing:-1px">Hola, ${creatorName}. Tu contenido está brillando.</h1>
          </td></tr>
          <tr><td style="padding:18px 32px 10px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td width="33.33%" style="padding:20px 8px;background:#f1edff;border-radius:16px;text-align:center"><strong style="display:block;font-size:28px">${asCount(digest.total_views)}</strong><span style="font-size:12px;color:#625e78">visitas</span></td>
                <td width="8"></td>
                <td width="33.33%" style="padding:20px 8px;background:#e7fff8;border-radius:16px;text-align:center"><strong style="display:block;font-size:28px">${asCount(digest.unique_visitors)}</strong><span style="font-size:12px;color:#625e78">personas</span></td>
                <td width="8"></td>
                <td width="33.33%" style="padding:20px 8px;background:#fff6d9;border-radius:16px;text-align:center"><strong style="display:block;font-size:28px">${asCount(totalClicks)}</strong><span style="font-size:12px;color:#625e78">clics</span></td>
              </tr>
            </table>
          </td></tr>
          <tr><td style="padding:22px 32px;color:#625e78;font-size:14px;line-height:1.7">
            Contactos: ${asCount(digest.email_clicks)} por email · ${asCount(digest.whatsapp_clicks)} por WhatsApp · ${asCount(digest.instagram_clicks)} por Instagram · ${asCount(digest.tiktok_clicks)} por TikTok
          </td></tr>
          <tr><td style="padding:2px 32px 36px">
            <a href="${escapeHtml(portfolioUrl)}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#6d4dff;color:#fff;text-decoration:none;font-weight:800">Ver mi portafolio →</a>
          </td></tr>
          <tr><td style="padding:22px 32px;background:#f6f4ff;color:#716b86;font-size:12px;line-height:1.6">
            Recibes este resumen porque lo activaste en Brilla. Puedes cambiar la frecuencia o desactivarlo desde <a href="${escapeHtml(accountUrl)}" style="color:#5637c9">tu cuenta</a>.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject: copy.subject, html, text };
}

async function parseBody(request: Request) {
  try {
    return await request.json() as { batch_size?: number };
  } catch {
    return {};
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const emailFrom = Deno.env.get("BRILLA_EMAIL_FROM");
  const siteUrl = Deno.env.get("BRILLA_SITE_URL") ?? "https://brillaugc.com";

  const missing = [
    ["SUPABASE_URL", supabaseUrl],
    ["SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey],
    ["RESEND_API_KEY", resendApiKey],
    ["BRILLA_EMAIL_FROM", emailFrom],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missing.length > 0) {
    return jsonResponse({ error: "Email delivery is not configured", missing }, 503);
  }

  if (!validEmailFrom(emailFrom!)) {
    return jsonResponse({
      error: "BRILLA_EMAIL_FROM must use the real domain verified in Resend",
    }, 503);
  }

  let normalizedSiteUrl: string;
  try {
    normalizedSiteUrl = new URL(siteUrl).toString();
  } catch {
    return jsonResponse({ error: "BRILLA_SITE_URL must be a valid absolute URL" }, 503);
  }

  const body = await parseBody(request);
  const requestedBatchSize = Number(body.batch_size);
  const batchSize = Number.isFinite(requestedBatchSize)
    ? Math.max(1, Math.min(Math.trunc(requestedBatchSize), 50))
    : 25;
  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error: claimError } = await admin.rpc("claim_activity_digests", {
    requested_batch_size: batchSize,
  });

  if (claimError) {
    console.error("Could not claim activity digests", claimError);
    return jsonResponse({ error: "Could not claim activity digests" }, 500);
  }

  const digests = (data ?? []) as ActivityDigest[];
  let sent = 0;
  let failed = 0;

  for (const digest of digests) {
    try {
      const message = renderEmail(digest, normalizedSiteUrl);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `brilla-activity/${digest.delivery_id}`,
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [digest.recipient_email],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });
      const result = await response.json().catch(() => ({})) as ResendResponse;

      if (!response.ok || !result.id) {
        throw new Error(result.message || result.name || `Resend HTTP ${response.status}`);
      }

      const { data: completed, error: completionError } = await admin.rpc("complete_activity_digest", {
        requested_delivery_id: digest.delivery_id,
        delivered: true,
        requested_provider_message_id: result.id,
        requested_error: null,
      });

      if (completionError || !completed) {
        throw new Error(completionError?.message || "Could not confirm the delivered digest");
      }

      sent += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Unknown email delivery error";
      console.error(`Activity digest ${digest.delivery_id} failed`, message);
      const { error: completionError } = await admin.rpc("complete_activity_digest", {
        requested_delivery_id: digest.delivery_id,
        delivered: false,
        requested_provider_message_id: null,
        requested_error: message,
      });
      if (completionError) {
        console.error(`Could not record failure for ${digest.delivery_id}`, completionError);
      }
    }
  }

  return jsonResponse({ claimed: digests.length, sent, failed });
});
