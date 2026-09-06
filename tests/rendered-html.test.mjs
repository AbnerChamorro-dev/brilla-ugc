import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the Brilla product and native Next.js routes", async () => {
  const [home, layout, manifest] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /Brilla — Portafolios para creadoras UGC/i);
  assert.match(home, /Tu portafolio listo/i);
  assert.match(home, /href="\/crear"/i);
  assert.doesNotMatch(home, /codex-preview|Building your site|react-loading-skeleton/i);
  assert.match(manifest, /"build":\s*"next build"/i);
  assert.match(manifest, /"next":\s*"16\.3\.4"/i);
  const packages = JSON.parse(manifest);
  const installedPackages = {
    ...packages.dependencies,
    ...packages.devDependencies,
  };
  for (const obsoletePackage of ["vinext", "wrangler", "nitro", "@cloudflare/vite-plugin"]) {
    assert.equal(installedPackages[obsoletePackage], undefined);
  }
});

test("keeps Google auth and durable portfolio storage wired safely", async () => {
  const [editor, account, migration] = await Promise.all([
    readFile(new URL("../app/crear/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/cuenta/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260905144657_create_creator_portfolios.sql", import.meta.url), "utf8"),
  ]);

  assert.match(editor, /signInWithOAuth/);
  assert.match(editor, /provider:\s*"google"/);
  assert.match(editor, /from\("creator_portfolios"\)/);
  assert.match(editor, /from\("creator_portfolios"\)\.insert\(/);
  assert.match(editor, /from\("creator_portfolios"\)\.update\(/);
  assert.doesNotMatch(editor, /from\("creator_portfolios"\)\.upsert\(/);
  assert.match(editor, /draftUploadPendingKey/);
  assert.match(editor, /Guardado en este dispositivo/);
  assert.match(editor, /Cuenta conectada/);
  assert.match(account, /Continuar con Google/);
  assert.doesNotMatch(account, /signInWithPassword|signUp\(|resetPasswordForEmail/);
  assert.match(account, /PANEL DE LA CREADORA/);
  assert.match(account, /from\("creator_portfolios"\)[\s\S]*select\("id,content,status,slug,created_at,updated_at"\)/);
  assert.match(account, /from\("creator_media"\)[\s\S]*count:\s*"exact"/);
  assert.match(account, /update\(\{ status: "unpublished" \}\)/);
  assert.match(account, /from\("creator_portfolios"\)\.delete\(\)\.eq\("user_id", user\.id\)/);
  assert.match(account, /storage\.from\("creator-media"\)\.remove\(paths\)/);
  assert.match(account, /deleteConfirmation !== "ELIMINAR"/);
  assert.match(account, /get_my_portfolio_analytics/);

  assert.match(migration, /alter table public\.creator_portfolios enable row level security/i);
  assert.match(migration, /for insert[\s\S]*with check \(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(migration, /for update[\s\S]*using \(\(select auth\.uid\(\)\) = user_id\)[\s\S]*with check \(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(migration, /revoke all on table public\.creator_portfolios from anon, authenticated/i);
  assert.match(migration, /for delete[\s\S]*using \(\(select auth\.uid\(\)\) = user_id\)/i);

  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});

test("records private analytics and shows creator-owned aggregates", async () => {
  const [editor, publicPage, publicClient, analyticsRoute, account, migration, lockdownMigration] = await Promise.all([
    readFile(new URL("../app/crear/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/[slug]/public-portfolio-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/analytics/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/cuenta/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260906001740_add_portfolio_analytics.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260906002742_lock_down_portfolio_events.sql", import.meta.url), "utf8"),
  ]);

  assert.match(publicPage, /slug=\{portfolio\.slug\}/);
  assert.match(publicClient, /recordAnalyticsEvent\(slug, "view", "portfolio"\)/);
  assert.match(publicClient, /navigator\.sendBeacon/);
  assert.match(editor, /data-analytics-target="email"/);
  assert.match(editor, /data-analytics-target="whatsapp"/);
  assert.match(editor, /data-analytics-target="instagram"/);
  assert.match(editor, /data-analytics-target="tiktok"/);
  assert.match(editor, /rpc\("get_my_portfolio_analytics"\)/);
  assert.doesNotMatch(editor, /localStorage\.getItem\("brilla-demo-views"\)/);
  assert.match(analyticsRoute, /rpc\("record_portfolio_event"/);
  assert.doesNotMatch(analyticsRoute, /service[_-]role/i);
  assert.doesNotMatch(analyticsRoute, /from\("portfolio_events"\)/);
  assert.match(account, /rpc\("get_my_portfolio_analytics"\)/);
  assert.match(account, /from\("creator_notification_preferences"\)/);
  assert.match(account, /VISITAS REALES/);
  assert.match(account, /visitantes aproximados/);

  assert.match(migration, /create table private\.portfolio_events/i);
  assert.match(migration, /alter table private\.portfolio_events enable row level security/i);
  assert.match(migration, /portfolio_events_deduplication_key unique/i);
  assert.match(migration, /revoke all on table private\.portfolio_events from public, anon, authenticated/i);
  assert.match(migration, /create table public\.creator_notification_preferences/i);
  assert.match(migration, /for update[\s\S]*using \(\(select auth\.uid\(\)\) = user_id\)[\s\S]*with check \(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(migration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(migration, /grant execute on function public\.record_portfolio_event[\s\S]*to anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.get_my_portfolio_analytics\(\)[\s\S]*to authenticated/i);
  assert.match(lockdownMigration, /for select[\s\S]*to anon, authenticated[\s\S]*using \(false\)/i);
  assert.match(lockdownMigration, /for insert[\s\S]*to anon, authenticated[\s\S]*with check \(false\)/i);
});

test("queues activity digests privately and sends them idempotently", async () => {
  const [migration, scheduleMigration, edgeFunction] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260906162319_create_activity_digest_queue.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260906172034_schedule_activity_digests.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/functions/send-activity-digests/index.ts", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /create table private\.activity_digest_deliveries/i);
  assert.match(migration, /activity_digest_deliveries_period_key unique/i);
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /status = 'processing'[\s\S]*15 minutes/i);
  assert.match(migration, /attempt_count between 0 and 3/i);
  assert.match(migration, /interval '5 minutes'/i);
  assert.match(migration, /interval '1 hour'/i);
  assert.match(migration, /revoke all on table private\.activity_digest_deliveries from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.claim_activity_digests\(integer\) to service_role/i);
  assert.doesNotMatch(migration, /grant execute on function public\.claim_activity_digests\(integer\) to (?:anon|authenticated)/i);

  assert.match(edgeFunction, /Deno\.env\.get\("RESEND_API_KEY"\)/);
  assert.match(edgeFunction, /Deno\.env\.get\("BRILLA_EMAIL_FROM"\)/);
  assert.match(edgeFunction, /BRILLA_EMAIL_FROM must use the real domain verified in Resend/);
  assert.match(edgeFunction, /https:\/\/api\.resend\.com\/emails/);
  assert.match(edgeFunction, /"Idempotency-Key": `brilla-activity\/\$\{digest\.delivery_id\}`/);
  assert.match(edgeFunction, /rpc\("claim_activity_digests"/);
  assert.match(edgeFunction, /rpc\("complete_activity_digest"/);
  assert.doesNotMatch(edgeFunction, /re_[A-Za-z0-9]{20,}/);
  assert.doesNotMatch(edgeFunction, /service_role\.[A-Za-z0-9_-]+/i);

  assert.match(scheduleMigration, /create extension if not exists pg_cron/i);
  assert.match(scheduleMigration, /create extension if not exists pg_net/i);
  assert.match(scheduleMigration, /'brilla-activity-digests'[\s\S]*'0 13 \* \* \*'/i);
  assert.match(scheduleMigration, /vault\.decrypted_secrets/i);
  assert.match(scheduleMigration, /brilla_function_anon_key/i);
  assert.doesNotMatch(scheduleMigration, /eyJ[A-Za-z0-9_-]{20,}/);
});

test("queues welcome and publication emails privately and sends them idempotently", async () => {
  const [migration, indexMigration, edgeFunction] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260906183038_create_transactional_email_queue.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260906183713_index_transactional_email_foreign_keys.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/functions/send-transactional-emails/index.ts", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /create table private\.transactional_email_deliveries/i);
  assert.match(migration, /event_type in \('welcome', 'published'\)/i);
  assert.match(migration, /deduplication_key text not null unique/i);
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /attempt_count between 0 and 3/i);
  assert.match(migration, /create trigger queue_brilla_welcome_email_after_signup[\s\S]*after insert on auth\.users/i);
  assert.match(migration, /create trigger queue_brilla_publication_email_after_update[\s\S]*after update of status on public\.creator_portfolios/i);
  assert.match(migration, /revoke all on table private\.transactional_email_deliveries from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.claim_transactional_emails\(integer\) to service_role/i);
  assert.doesNotMatch(migration, /grant execute on function public\.claim_transactional_emails\(integer\) to (?:anon|authenticated)/i);
  assert.match(migration, /'brilla-transactional-emails'[\s\S]*'\* \* \* \* \*'/i);
  assert.match(migration, /vault\.decrypted_secrets/i);
  assert.doesNotMatch(migration, /eyJ[A-Za-z0-9_-]{20,}/);
  assert.match(indexMigration, /on private\.transactional_email_deliveries \(user_id\)/i);
  assert.match(indexMigration, /on private\.transactional_email_deliveries \(portfolio_id\)/i);

  assert.match(edgeFunction, /Deno\.env\.get\("RESEND_API_KEY"\)/);
  assert.match(edgeFunction, /Deno\.env\.get\("BRILLA_EMAIL_FROM"\)/);
  assert.match(edgeFunction, /rpc\("claim_transactional_emails"/);
  assert.match(edgeFunction, /rpc\([\s\S]*"complete_transactional_email"/);
  assert.match(edgeFunction, /"Idempotency-Key": `brilla-transactional\/\$\{delivery\.delivery_id\}`/);
  assert.match(edgeFunction, /Bienvenida a Brilla/);
  assert.match(edgeFunction, /Tu portafolio Brilla ya está publicado/);
  assert.doesNotMatch(edgeFunction, /re_[A-Za-z0-9]{20,}/);
  assert.doesNotMatch(edgeFunction, /service_role\.[A-Za-z0-9_-]+/i);
});

test("downloads a real, branded media kit PDF without the print dialog", async () => {
  const [editor, generator, manifest, samplePdf] = await Promise.all([
    readFile(new URL("../app/crear/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/crear/portfolio-pdf.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../output/pdf/brilla-media-kit-muestra.pdf", import.meta.url)),
  ]);

  assert.match(editor, /import\("\.\/portfolio-pdf"\)/);
  assert.match(editor, /downloadPortfolioPdf\(data, media, brands\)/);
  assert.doesNotMatch(editor, /window\.print\(/);
  assert.match(generator, /PDFDocument\.create\(\)/);
  assert.match(generator, /document\.embedJpg/);
  assert.match(generator, /portfolio\.format === "website"/);
  assert.match(generator, /anchor\.download = `\$\{portfolio\.portfolioSlug \|\| "media-kit-ugc"\}\.pdf`/);
  assert.equal(JSON.parse(manifest).dependencies["pdf-lib"], "^1.17.1");
  assert.equal(samplePdf.subarray(0, 4).toString(), "%PDF");
});

test("keeps creator media private, validated, restorable, and removable", async () => {
  const [editor, migration, previewMigration] = await Promise.all([
    readFile(new URL("../app/crear/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260905175457_create_creator_media_storage.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260905180656_add_creator_media_previews.sql", import.meta.url), "utf8"),
  ]);

  assert.match(editor, /creatorMediaBucket\s*=\s*"creator-media"/);
  assert.match(editor, /maxImageBytes\s*=\s*10\s*\*\s*1024\s*\*\s*1024/);
  assert.match(editor, /maxVideoBytes\s*=\s*50\s*\*\s*1024\s*\*\s*1024/);
  assert.match(editor, /\.storage\.from\(creatorMediaBucket\)\.upload\(/);
  assert.match(editor, /createSignedUrl\(/);
  assert.match(editor, /\.storage\.from\(creatorMediaBucket\)\.remove\(/);
  assert.match(editor, /resizeImageBlob\(/);
  assert.match(editor, /videoPreviewBlob\(/);
  assert.match(editor, /poster=\{item\.previewUrl\}/);
  assert.match(editor, /preview_path:\s*previewPath/);
  assert.match(editor, /pendingLocal\s*=\s*localAssetsRef\.current\.filter/);
  assert.match(editor, /No pudimos subir.*Permanece guardado en este dispositivo/);

  assert.match(migration, /create table if not exists public\.creator_media/i);
  assert.match(migration, /alter table public\.creator_media enable row level security/i);
  assert.match(migration, /'creator-media',[\s\S]*false,[\s\S]*52428800/i);
  assert.match(migration, /allowed_mime_types/i);
  assert.match(migration, /storage\.foldername\(name\)\)\[1\]\s*=\s*\(select auth\.uid\(\)\)::text/i);
  assert.match(migration, /for update[\s\S]*using[\s\S]*with check/i);
  assert.match(migration, /constraint creator_media_path_owner_check/i);
  assert.match(previewMigration, /add column if not exists preview_path text/i);
  assert.match(previewMigration, /creator_media_preview_path_owner_check/i);
});

test("publishes real slug routes without exposing private portfolio data", async () => {
  const [editor, publicPage, publicClient, migration] = await Promise.all([
    readFile(new URL("../app/crear/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/[slug]/public-portfolio-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260905183113_publish_creator_portfolios.sql", import.meta.url), "utf8"),
  ]);

  assert.match(editor, /rpc\("is_portfolio_slug_available"/);
  assert.match(editor, /status:\s*"published"/);
  assert.match(editor, /status:\s*"unpublished"/);
  assert.match(editor, /window\.location\.origin\}\/\$\{data\.portfolioSlug\}/);
  assert.match(editor, /Ver publicado/);
  assert.match(editor, /Despublicar/);
  assert.doesNotMatch(editor, /PasswordGate|Con contraseña|data\.visibility|data\.password/);

  assert.match(publicPage, /rpc\("get_published_portfolio"/);
  assert.match(publicPage, /createSignedUrl\(/);
  assert.match(publicPage, /generateMetadata/);
  assert.match(publicPage, /notFound\(\)/);
  assert.match(publicPage, /openGraph:[\s\S]*images:/);
  assert.match(publicClient, /WebsitePortfolio/);
  assert.match(publicClient, /PortfolioDeck/);

  assert.match(migration, /status = 'published'/i);
  assert.match(migration, /content - array\['password', 'notifyViews'\]/i);
  assert.match(migration, /coalesce\(portfolio\.content ->> 'visibility', 'public'\) = 'public'/i);
  assert.match(migration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(migration, /revoke all on function private\.get_published_portfolio_data/i);
  assert.match(migration, /to anon, authenticated[\s\S]*private\.is_public_creator_asset\(name\)/i);
});

test("requires explicit, versioned legal consent before Google access", async () => {
  const [editor, account, checkbox, helper, privacy, terms, migration, home] = await Promise.all([
    readFile(new URL("../app/crear/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/cuenta/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/legal-consent-checkbox.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/legal-consent.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/privacidad/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/terminos/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260906185249_record_creator_legal_consents.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(editor, /<LegalConsentCheckbox id="editor-login-legal-consent"/);
  assert.match(editor, /disabled=\{authBusy \|\| checkingAuth \|\| !loginConsentChecked\}/);
  assert.match(account, /<LegalConsentCheckbox id="account-login-legal-consent"/);
  assert.match(account, /disabled=\{busy \|\| !loginConsentChecked\}/);
  assert.match(editor, /resolveCurrentLegalConsent/);
  assert.match(account, /resolveCurrentLegalConsent/);
  assert.match(editor, /LegalConsentGate/);
  assert.match(account, /LegalConsentGate/);
  assert.doesNotMatch(checkbox, /defaultChecked/);
  assert.match(checkbox, /type="checkbox" checked=\{checked\}/);
  assert.match(checkbox, /href="\/privacidad"/);
  assert.match(checkbox, /href="\/terminos"/);
  assert.match(helper, /DATA_POLICY_VERSION = "2026-09-06"/);
  assert.match(helper, /TERMS_VERSION = "2026-09-06"/);
  assert.match(helper, /previa, expresa e informada/);
  assert.match(helper, /accepted_via: acceptedVia/);
  assert.doesNotMatch(helper, /accepted_at:/);

  assert.match(privacy, /TECNOLOGYC S\.A\.S\./);
  assert.match(privacy, /NIT 901787723-2/);
  assert.match(privacy, /Calle 159 #56-75, Torre 1, apto\. 1101/);
  assert.match(privacy, /abner\.chamorro@brillaugc\.com/);
  assert.match(privacy, /320 318 5347/);
  assert.match(privacy, /diez \(10\) días hábiles/);
  assert.match(privacy, /quince \(15\) días hábiles/);
  assert.match(privacy, /Supabase/);
  assert.match(privacy, /Resend/);
  assert.match(terms, /mayores de 18 años/);
  assert.match(terms, /leyes de la República de Colombia/);
  assert.match(home, /href="\/privacidad"/);
  assert.match(home, /href="\/terminos"/);

  assert.match(migration, /create table public\.creator_legal_consents/i);
  assert.match(migration, /accepted_at timestamptz not null default now\(\)/i);
  assert.match(migration, /unique \([\s\S]*user_id,[\s\S]*data_policy_version,[\s\S]*terms_version/i);
  assert.match(migration, /alter table public\.creator_legal_consents enable row level security/i);
  assert.match(migration, /for select[\s\S]*using \(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(migration, /for insert[\s\S]*with check \(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(migration, /revoke all on table public\.creator_legal_consents[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant insert \(user_id, accepted_via\)/i);
  assert.doesNotMatch(migration, /grant (?:update|delete)/i);
});
