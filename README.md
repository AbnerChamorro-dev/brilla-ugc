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

Para producción, `NEXT_PUBLIC_SITE_URL` debe ser `https://brillaugc.com`.

También deben permanecer registradas en Supabase las URLs de retorno de Google OAuth correspondientes al dominio de producción y a los previews que se quieran probar.

## Base de datos

Las migraciones versionadas se encuentran en `supabase/migrations`. No se deben incluir `.env.local`, claves secretas ni archivos internos de `supabase/.temp` en Git.
