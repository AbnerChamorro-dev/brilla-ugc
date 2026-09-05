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
  assert.match(account, /La analítica llegará en la fase 6/);

  assert.match(migration, /alter table public\.creator_portfolios enable row level security/i);
  assert.match(migration, /for insert[\s\S]*with check \(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(migration, /for update[\s\S]*using \(\(select auth\.uid\(\)\) = user_id\)[\s\S]*with check \(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(migration, /revoke all on table public\.creator_portfolios from anon, authenticated/i);
  assert.match(migration, /for delete[\s\S]*using \(\(select auth\.uid\(\)\) = user_id\)/i);

  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
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
