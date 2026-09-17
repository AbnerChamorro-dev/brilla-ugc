// Run against npm run start. Uses isolated mock accounts; never writes production data.
// BRILLA_PLAYWRIGHT_PATH may point at an existing Playwright installation.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium, webkit } = require(process.env.BRILLA_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.BRILLA_TEST_URL || 'http://localhost:3002';
const uid = '11111111-1111-4111-8111-111111111111';
const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', user_metadata: {}, app_metadata: {}, created_at: '2026-09-01T00:00:00Z' };
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: uid, exp: Math.floor(Date.now()/1000)+3600, role: 'authenticated' })).toString('base64url')}.test`;
const session = { access_token: token, refresh_token: 'test-refresh', expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, token_type: 'bearer', user };
const original = { name: 'Creadora de prueba', bio: 'Biografía guardada en la nube', title: 'UGC', language: 'es', format: 'website', webTemplate: 'creator', portfolioSlug: 'creadora-test', portfolioCategories: ['Beauty'], notifyViews: false, whatsapp: '573001234567' };
const waitFor = async (fn, message) => { for(let n=0;n<100;n++) { if(await fn()) return; await new Promise(r=>setTimeout(r,100)); } throw new Error(message); };
await mkdir('outputs/browser', { recursive: true });
for (const [engine, browserType, executablePath] of [
  ['chromium', chromium, process.env.BRILLA_CHROMIUM_EXECUTABLE],
  ['webkit', webkit, process.env.BRILLA_WEBKIT_EXECUTABLE],
].filter(([name]) => !process.env.BRILLA_TEST_ENGINE || name === process.env.BRILLA_TEST_ENGINE)) {
 console.log(`${engine}: launching`);
 const browser=await browserType.launch({ headless:true, timeout:20000, ...(executablePath ? {executablePath}: {}) });
 try {
  const context=await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
  let row={id:'portfolio-test',user_id:uid,content:{...original},slug:'creadora-test',status:'draft',created_at:'2026-09-01T00:00:00Z',updated_at:'2026-09-17T10:00:00.000Z'};
  let writes=0, reads=0, failRead=false, failMetrics=true, failWrites=false;
  let releaseRead; const readGate=new Promise(r=>{releaseRead=r;}); let gate=true;
  await context.addInitScript(({session})=>{
   if(!sessionStorage.getItem('initialized')) {
    localStorage.setItem('brilla-auth-v1',JSON.stringify(session));
    localStorage.setItem('brilla-portfolio-draft-v3',JSON.stringify({name:'',bio:''}));
    localStorage.setItem('brilla-pending-cloud-upload-v1','1');
    sessionStorage.setItem('initialized','1');
   }
  },{session});
  await context.route('https://*.supabase.co/**',async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname;
   const respond=(body,status=200,headers={})=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*',...headers},body:JSON.stringify(body)});
   if(req.method()==='OPTIONS') return respond({},200,{'access-control-allow-methods':'GET,POST,PATCH,DELETE,HEAD,OPTIONS','access-control-allow-headers':'*'});
   if(path.includes('/auth/v1/user'))return respond(user);
   if(path.includes('creator_legal_consents'))return respond({id:'consent'});
   if(path.includes('creator_portfolios')) {
    if(req.method()==='GET') { reads++; if(gate)await readGate; return failRead?respond({message:'offline'},503):respond(row); }
    if(req.method()==='PATCH') {
     writes++;
     if(failWrites)return respond({message:'offline'},503);
     if(url.searchParams.get('updated_at')!==`eq.${row.updated_at}`) return respond([]);
     row={...row,...req.postDataJSON(),updated_at:new Date(Date.parse(row.updated_at)+1000).toISOString()};
     return respond([ {updated_at:row.updated_at} ]);
    }
    if(req.method()==='POST')throw new Error('Returning account must not insert a portfolio');
   }
   if(path.includes('creator_notification_preferences'))return respond({email_digest_enabled:false});
   if(path.includes('get_my_portfolio_analytics'))return failMetrics?respond({message:'metrics unavailable'},503):respond({total_views:4});
   if(path.includes('is_portfolio_slug_available'))return respond(true);
   if(path.includes('creator_media')) { assert.equal(url.searchParams.get('user_id'),`eq.${uid}`); return respond([],200,{'content-range':'*/0'}); }
   return respond([]);
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  console.log(`${engine}: opening editor`);
  await page.goto(base+'/crear');
  await waitFor(()=>reads>0,'portfolio query not started');
  assert.equal(await page.locator('input').count(),0,'form must stay locked during recovery');
  assert.equal(writes,0);
  gate=false;releaseRead();
  await page.locator('.mobileStepNav button').filter({hasText:'Identidad'}).click();
  const name=page.getByLabel('Nombre público', {exact:true});
  await waitFor(()=>name.inputValue().then(v=>v===original.name).catch(()=>false),'saved name missing');
  assert.equal(await page.getByLabel('Sobre ti').inputValue(),original.bio);
  assert.equal(writes,0,'login must not write a blank draft');
  await name.fill('Nombre actualizado');
  await waitFor(()=>row.content.name==='Nombre actualizado','autosave did not reach server');
  await page.reload();
  await page.locator('.mobileStepNav button').filter({hasText:'Identidad'}).click();
  assert.equal(await name.inputValue(),'Nombre actualizado','reopen lost saved content');
  failWrites=true;
  await name.fill('Trabajo sin conexión');
  await page.getByText('No pudimos sincronizar.',{exact:false}).waitFor();
  assert.equal(row.content.name,'Nombre actualizado');
  failWrites=false;
  await page.reload();
  await page.locator('.mobileStepNav button').filter({hasText:'Identidad'}).click();
  assert.equal(await name.inputValue(),'Trabajo sin conexión');
  await waitFor(()=>row.content.name==='Trabajo sin conexión','pending offline edits did not resume');
  await name.fill('Nombre actualizado');
  await waitFor(()=>row.content.name==='Nombre actualizado','online edit failed');
  // Competing remote revision must reject this tab's next save.
  row={...row,content:{...row.content,bio:'Cambio desde otro teléfono'},updated_at:'2026-09-17T12:00:00.000Z'};
  await name.fill('Cambio local sin sincronizar');
  await page.getByText('El portafolio cambió en otra pestaña o dispositivo.',{exact:false}).waitFor();
  assert.equal(row.content.name,'Nombre actualizado');
  await page.getByRole('button',{name:'Reintentar',exact:true}).click();
  await page.getByText('Hay una copia local diferente').waitFor();
  assert.equal(await name.inputValue(),'Nombre actualizado');
  await page.getByRole('button',{name:'Usar esta copia local'}).click();
  await waitFor(()=>row.content.name==='Cambio local sin sincronizar','explicit conflict recovery failed');
  // Read errors cannot create an empty form or issue writes.
  failRead=true;const before=writes;
  await page.reload();await page.getByText('No pudimos recuperar tu portafolio.',{exact:false}).waitFor();
  assert.equal(await page.locator('input').count(),0);assert.equal(writes,before);
  failRead=false;await page.getByRole('button',{name:'Reintentar',exact:true}).click();
  await page.locator('.mobileStepNav').waitFor();
  // Optional dashboard failures must not hide a portfolio.
  await page.goto(base+'/cuenta');await page.locator('.portfolioOverview').waitFor();
  assert.equal(await page.locator('.dashboardEmpty').count(),0);
  await page.goto(base);await page.getByRole('link',{name:'Mi portafolio',exact:true}).waitFor();
  assert.ok(await page.locator('svg.brillaIcon').count()>10);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'home overflows mobile viewport');
  await page.screenshot({path:`outputs/browser/home-${engine}.png`});
  await page.getByRole('link',{name:'Mi portafolio',exact:true}).click();
  await page.locator('.mobileStepNav button').filter({hasText:'Identidad'}).click();
  await page.screenshot({path:`outputs/browser/editor-${engine}.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'editor overflows mobile viewport');
  assert.deepEqual(errors,[],'browser runtime errors');
  await page.goto(base+'/cuenta');
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await page.getByRole('button',{name:'Continuar con Google'}).waitFor();
  await page.goto(base+'/crear');
  await page.locator('.builderActions .nextButton').click();
  assert.equal(await name.inputValue(),'','signed-out visitor must not see the previous account');
  await context.close();
  const guest=await browser.newContext({viewport:{width:320,height:740},isMobile:true,hasTouch:true});const guestPage=await guest.newPage();
  await guestPage.goto(base);await guestPage.getByRole('link',{name:'Iniciar sesión',exact:true}).waitFor();
  assert.equal(await guestPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'320px home overflows');
  // First-time signup claims only the guest draft staged for this login.
  let created=null, inserts=0;
  await guest.route('https://*.supabase.co/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    const respond=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    if(path.includes('creator_legal_consents'))return respond({id:'consent'});
    if(path.includes('creator_portfolios')){
      if(req.method()==='POST'){inserts++;created={...req.postDataJSON(),updated_at:'2026-09-17T13:00:00.000Z'};return respond(created);}
      return respond(created);
    }
    if(path.includes('creator_notification_preferences'))return respond({email_digest_enabled:false});
    if(path.includes('get_my_portfolio_analytics'))return respond({total_views:0});
    return respond([]);
  });
  await guestPage.goto(base+'/crear');
  await guestPage.locator('.builderActions .nextButton').click();
  await guestPage.getByLabel('Nombre público',{exact:true}).fill('Primera creadora');
  await waitFor(()=>guestPage.evaluate(()=>JSON.parse(localStorage.getItem('brilla-portfolio-v4:guest')||'null')?.content.name==='Primera creadora'),'guest draft not saved');
  await guestPage.evaluate(session=>{localStorage.setItem('brilla-auth-v1',JSON.stringify(session));localStorage.setItem('brilla-pending-cloud-upload-v1','v4');},session);
  await guestPage.reload();
  await guestPage.locator('.builderActions .nextButton').click();
  assert.equal(await guestPage.getByLabel('Nombre público',{exact:true}).inputValue(),'Primera creadora');
  assert.equal(inserts,1);assert.equal(created.content.name,'Primera creadora');
  await guest.close();
  console.log(`${engine}: recovery, autosave, conflict, failed load, dashboard, mobile home and SVG icons passed`);
 }finally{await browser.close();}
}
