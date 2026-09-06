// @ts-expect-error Deno resolves pinned npm specifiers in the Edge Functions runtime.
import { createClient } from "npm:@supabase/supabase-js@2.115.0";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

type TransactionalEmail = {
  delivery_id: string;
  event_type: "welcome" | "published";
  recipient_email: string;
  creator_name: string;
  portfolio_slug: string | null;
};

type ResendResponse = {
  id?: string;
  message?: string;
  name?: string;
};

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

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

function validEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validEmailFrom(value: string) {
  const bracketedAddress = value.match(/<([^<>]+)>\s*$/)?.[1];
  const address = (bracketedAddress ?? value).trim().toLowerCase();
  return validEmailAddress(address)
    && !address.endsWith("@tu-dominio-verificado.com")
    && !address.endsWith(".example");
}

function emailFrame(options: {
  preview: string;
  eyebrow: string;
  heading: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  footer: string;
}) {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f6f4ff;color:#17132f;font-family:Arial,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(options.preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f4ff;padding:28px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #ded8f5;border-radius:24px;overflow:hidden">
          <tr><td style="padding:28px 32px;background:#211a49;color:#fff;font-size:25px;font-weight:800;letter-spacing:-1px">brilla<span style="color:#70f0cf">•</span></td></tr>
          <tr><td style="padding:38px 32px 12px">
            <p style="margin:0 0 12px;color:#6d4dff;font-size:12px;font-weight:800;letter-spacing:1.5px">${escapeHtml(options.eyebrow)}</p>
            <h1 style="margin:0;font-size:30px;line-height:1.15;letter-spacing:-1px">${escapeHtml(options.heading)}</h1>
          </td></tr>
          <tr><td style="padding:14px 32px 12px;color:#625e78;font-size:15px;line-height:1.75">${options.body}</td></tr>
          <tr><td style="padding:10px 32px 38px">
            <a href="${escapeHtml(options.buttonUrl)}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#6d4dff;color:#fff;text-decoration:none;font-weight:800">${escapeHtml(options.buttonLabel)} →</a>
          </td></tr>
          <tr><td style="padding:22px 32px;background:#f6f4ff;color:#716b86;font-size:12px;line-height:1.6">${options.footer}</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function renderWelcomeEmail(delivery: TransactionalEmail, siteUrl: string) {
  const creatorName = delivery.creator_name || "creadora";
  const editorUrl = new URL("/crear", siteUrl).toString();
  const accountUrl = new URL("/cuenta", siteUrl).toString();
  const body = [
    `<p style="margin:0 0 14px">Hola, ${escapeHtml(creatorName)}.</p>`,
    "<p style=\"margin:0 0 14px\">Tu espacio en Brilla ya está listo. Puedes construir tu portafolio, organizar tus mejores piezas y preparar un media kit para compartir con marcas.</p>",
    "<p style=\"margin:0\">Tu borrador se guarda en tu cuenta para que puedas continuarlo desde cualquier dispositivo.</p>",
  ].join("");

  return {
    subject: "Bienvenida a Brilla: tu portafolio empieza aquí",
    text: [
      `Hola, ${creatorName}.`,
      "",
      "Tu espacio en Brilla ya está listo. Construye tu portafolio, organiza tus mejores piezas y prepara un media kit para compartir con marcas.",
      "Tu borrador se guarda en tu cuenta para que puedas continuarlo desde cualquier dispositivo.",
      "",
      `Crear mi portafolio: ${editorUrl}`,
      `Mi cuenta: ${accountUrl}`,
    ].join("\n"),
    html: emailFrame({
      preview: "Tu espacio para crear un portafolio UGC profesional ya está listo.",
      eyebrow: "BIENVENIDA A BRILLA",
      heading: `Hola, ${creatorName}. Hagamos brillar tu trabajo.`,
      body,
      buttonLabel: "Crear mi portafolio",
      buttonUrl: editorUrl,
      footer: `Este mensaje confirma la creación de tu cuenta en Brilla. Puedes administrar tu portafolio desde <a href="${escapeHtml(accountUrl)}" style="color:#5637c9">tu cuenta</a>.`,
    }),
  };
}

function renderPublishedEmail(delivery: TransactionalEmail, siteUrl: string) {
  if (!delivery.portfolio_slug) {
    throw new Error("Published email is missing its portfolio slug");
  }

  const creatorName = delivery.creator_name || "creadora";
  const portfolioUrl = new URL(`/${encodeURIComponent(delivery.portfolio_slug)}`, siteUrl).toString();
  const accountUrl = new URL("/cuenta", siteUrl).toString();
  const body = [
    `<p style="margin:0 0 14px">Hola, ${escapeHtml(creatorName)}.</p>`,
    "<p style=\"margin:0 0 14px\">Tu portafolio ya está publicado y listo para compartir con marcas. El enlace permanece activo mientras el estado del portafolio sea público.</p>",
    `<p style="margin:0;padding:14px 16px;background:#f1edff;border-radius:14px;color:#3f3472;word-break:break-all">${escapeHtml(portfolioUrl)}</p>`,
  ].join("");

  return {
    subject: "Tu portafolio Brilla ya está publicado",
    text: [
      `Hola, ${creatorName}.`,
      "",
      "Tu portafolio ya está publicado y listo para compartir con marcas.",
      `Abrir mi portafolio: ${portfolioUrl}`,
      `Administrar publicación: ${accountUrl}`,
    ].join("\n"),
    html: emailFrame({
      preview: "Tu portafolio Brilla ya está publicado y listo para compartir.",
      eyebrow: "PORTAFOLIO PUBLICADO",
      heading: "Tu enlace ya está listo para llegar a nuevas marcas.",
      body,
      buttonLabel: "Ver mi portafolio",
      buttonUrl: portfolioUrl,
      footer: `Puedes actualizar, copiar o despublicar el enlace cuando quieras desde <a href="${escapeHtml(accountUrl)}" style="color:#5637c9">tu cuenta</a>.`,
    }),
  };
}

function renderEmail(delivery: TransactionalEmail, siteUrl: string) {
  return delivery.event_type === "welcome"
    ? renderWelcomeEmail(delivery, siteUrl)
    : renderPublishedEmail(delivery, siteUrl);
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

  const { data, error: claimError } = await admin.rpc("claim_transactional_emails", {
    requested_batch_size: batchSize,
  });

  if (claimError) {
    console.error("Could not claim transactional emails", claimError);
    return jsonResponse({ error: "Could not claim transactional emails" }, 500);
  }

  const deliveries = (data ?? []) as TransactionalEmail[];
  let sent = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    try {
      if (!validEmailAddress(delivery.recipient_email)) {
        throw new Error("Delivery has an invalid recipient email");
      }

      const message = renderEmail(delivery, normalizedSiteUrl);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `brilla-transactional/${delivery.delivery_id}`,
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [delivery.recipient_email],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });
      const result = await response.json().catch(() => ({})) as ResendResponse;

      if (!response.ok || !result.id) {
        throw new Error(result.message || result.name || `Resend HTTP ${response.status}`);
      }

      const { data: completed, error: completionError } = await admin.rpc(
        "complete_transactional_email",
        {
          requested_delivery_id: delivery.delivery_id,
          delivered: true,
          requested_provider_message_id: result.id,
          requested_error: null,
        },
      );

      if (completionError || !completed) {
        throw new Error(completionError?.message || "Could not confirm the delivered email");
      }

      sent += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Unknown email delivery error";
      console.error(`Transactional email ${delivery.delivery_id} failed`, message);
      const { error: completionError } = await admin.rpc("complete_transactional_email", {
        requested_delivery_id: delivery.delivery_id,
        delivered: false,
        requested_provider_message_id: null,
        requested_error: message,
      });
      if (completionError) {
        console.error(`Could not record failure for ${delivery.delivery_id}`, completionError);
      }
    }
  }

  return jsonResponse({ claimed: deliveries.length, sent, failed });
});
