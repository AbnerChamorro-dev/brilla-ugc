# Brilla UGC

Plataforma para que creadoras UGC construyan, publiquen y compartan un portafolio profesional desde una plantilla web o presentacional.

## Tecnología

- Next.js 16 con App Router
- React 19
- Supabase Auth, Database y Storage
- TypeScript
- Despliegue en Vercel

## Configuración local

Copia `.env.example` como `.env.local` y completa:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
NEXT_PUBLIC_SITE_URL=http://localhost:3002
```

Instala las dependencias y abre el entorno local:

```bash
npm install
npm run dev
```

La aplicación estará disponible en `http://localhost:3002`.

## Comandos

- `npm run dev`: desarrollo local en el puerto 3002.
- `npm run build`: compilación de producción con Next.js.
- `npm run start`: servidor de producción local.
- `npm test`: compilación y pruebas estructurales.
- `npm run lint`: revisión de calidad del código.

## Despliegue en Vercel

El proyecto incluye `vercel.json` con el framework `nextjs`. En Vercel configura estas variables para Production, Preview y Development:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`

Para producción, `NEXT_PUBLIC_SITE_URL` debe coincidir con el dominio canónico: `https://www.brillaugc.com`.

En Supabase Auth → URL Configuration, configura `https://www.brillaugc.com` como Site URL y registra al menos `https://www.brillaugc.com/crear` y `https://www.brillaugc.com/cuenta` en Redirect URLs. Añade por separado el dominio sin `www` y los previews que se quieran probar si también iniciarán OAuth directamente desde ellos.

## Base de datos

Las migraciones versionadas se encuentran en `supabase/migrations`. No se deben incluir `.env.local`, claves secretas ni archivos internos de `supabase/.temp` en Git.

## Resúmenes por correo

La Edge Function `send-activity-digests` usa secretos administrados por Supabase, nunca variables públicas ni archivos versionados:

- `RESEND_API_KEY`: clave de Resend con permiso de envío.
- `BRILLA_EMAIL_FROM`: remitente perteneciente al dominio verificado en Resend.
- `BRILLA_SITE_URL`: URL pública utilizada en los enlaces del mensaje.

El cron `brilla-activity-digests` se ejecuta a las `13:00 UTC` (`08:00 America/Bogota`). Solo encola actividad de portafolios publicados cuyas creadoras hayan activado el resumen; los correos semanales se generan los lunes.

La función `send-transactional-emails` procesa una cola privada separada para los mensajes esenciales. Encola una bienvenida únicamente cuando se crea una cuenta nueva y una confirmación únicamente la primera vez que cada portafolio pasa a estado publicado. El cron `brilla-transactional-emails` revisa la cola cada minuto; cada entrega tiene una clave de idempotencia y hasta tres intentos. Resend recibe solo el correo, el nombre visible y, para la confirmación de publicación, el enlace público autorizados para componer el mensaje.

## Media kit PDF

El editor carga `app/crear/portfolio-pdf.ts` únicamente cuando la creadora solicita la descarga. El generador produce un PDF A4 con portada, perfil, audiencia, piezas disponibles, servicios, tarifas y contacto; adapta el color y la etiqueta de la plantilla web o presentacional elegida. Las fotos y las portadas de video se convierten localmente antes de incrustarse, por lo que no se envía contenido a otro servicio para crear el archivo.

## Privacidad, términos y consentimiento

Las páginas públicas `/privacidad` y `/terminos` contienen la versión vigente de los documentos legales. Los dos accesos con Google exigen una casilla sin premarcar que presenta la autorización expresa y enlaza ambos documentos antes de iniciar OAuth.

Después de autenticar la identidad, Brilla registra en `creator_legal_consents` el usuario, las versiones aceptadas, el texto exacto, el medio de aceptación y la hora del servidor. La tabla tiene RLS: cada creadora solo puede leer y crear sus propios registros, y el cliente no puede modificar ni eliminar la prueba ni escoger versiones, texto o fecha. Si cambia una versión, una sesión existente debe autorizarla antes de acceder al editor o al panel.
