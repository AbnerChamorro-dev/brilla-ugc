# Plan para terminar el portal de creadoras UGC

## Objetivo

Lanzar Brilla como un producto funcional para creadoras UGC: cada creadora podrá registrarse, construir su portafolio, publicar un enlace permanente, actualizarlo desde cualquier dispositivo y consultar su actividad básica.

El portal para empresas queda fuera de esta etapa. La información se organizará desde el comienzo para que pueda alimentar ese producto en el futuro sin duplicar datos.

## Estado actual

### Ya está construido

- Página principal de Brilla.
- Editor guiado de siete pasos.
- Plantillas web y presentacionales diferenciadas.
- Personalización de colores y tipografías.
- Carga local de fotos, videos y logos.
- Vista previa del portafolio.
- Campos de identidad, audiencia, servicios, tarifas y contacto.
- Opciones visuales de privacidad y publicación.
- Impresión básica como PDF.
- Diseño adaptable a móvil y computador.

### Funciones que todavía son locales o demostrativas

- Los datos del portafolio se guardan en el navegador.
- Los archivos se guardan en el dispositivo mediante almacenamiento local.
- El botón de publicación no crea todavía una página pública real.
- El enlace copiado vuelve al editor y no a un portafolio independiente.
- La contraseña protege únicamente la demostración local.
- La sincronización de métricas es simulada.
- Las visualizaciones y notificaciones no provienen de visitas externas reales.
- El PDF depende de la función de impresión del navegador.

## Alcance del lanzamiento inicial

Una creadora deberá poder:

1. Crear y verificar una cuenta.
2. Iniciar y cerrar sesión.
3. Recuperar su contraseña.
4. Crear un portafolio y guardarlo automáticamente.
5. Subir fotos, videos, retratos y logos.
6. Previsualizar todas las plantillas.
7. Elegir un enlace público único.
8. Publicar, actualizar y despublicar el portafolio.
9. Protegerlo opcionalmente con contraseña.
10. Compartirlo y consultar visitas y clics básicos.
11. Descargar una versión PDF correctamente maquetada.
12. Editar o eliminar su cuenta y sus datos.

## Fases de implementación

### Fase 1 — Cuentas y sesión

- Acceso único con Google, sin crear otra contraseña.
- Solicitar el inicio de sesión después de completar Identidad y antes de Portafolio.
- Conservar el borrador local durante la redirección a Google y retomar el paso solicitado al volver.
- Inicio y cierre de sesión.
- Sesiones seguras y persistentes.
- Perfil perteneciente únicamente a la creadora autenticada.

**Criterio de finalización:** una creadora puede entrar desde otro dispositivo y acceder a su cuenta.

**Avance al 5 de septiembre de 2026:**

- Proyecto independiente `brilla-ugc` conectado mediante Supabase.
- El editor permite elegir Dirección y completar Identidad sin iniciar sesión.
- Google es el único acceso visible y se solicita antes de entrar a Portafolio.
- El borrador y los archivos permanecen en `localStorage` e `IndexedDB` durante OAuth.
- Al volver de Google, el editor retoma automáticamente el paso que la creadora intentó abrir.
- Inicio y cierre de sesión con Supabase implementados en la interfaz.
- Perfil privado creado automáticamente para cada cuenta.
- Políticas de seguridad activas: cada creadora solo puede leer y modificar su propio perfil.
- URL pública de Brilla registrada en el entorno de producción para el retorno de Google.
- Credenciales OAuth de Google conectadas y proveedor habilitado en Supabase.
- Flujo real de acceso con Google probado correctamente.
- URL de retorno de producción configurada.
- URLs de retorno locales (`localhost:3000`, `3001` y `3002`) y de producción registradas en Supabase.

El SMTP ya no es necesario para registro, verificación o recuperación de contraseña porque el acceso será exclusivamente con Google. Se conserva como trabajo posterior para correos transaccionales y alertas de la plataforma.

### Fase 2 — Base de datos

Guardar permanentemente:

- Identidad y biografía.
- Ubicación y nichos.
- Plantilla, tipografía y color.
- Categorías del portafolio.
- Audiencia y métricas declaradas.
- Servicios, entregables y tarifas.
- Datos de contacto y disponibilidad.
- Configuración de privacidad.
- Estado de borrador o publicado.
- Fecha de creación y última actualización.

**Criterio de finalización:** ningún dato importante depende del navegador o del dispositivo.

**Avance al 5 de septiembre de 2026:**

- Tabla privada `creator_portfolios` creada en Supabase: un portafolio por creadora.
- Contenido del editor, estado de publicación y enlace guardados permanentemente.
- Políticas RLS verificadas: cada creadora solo puede crear, leer, actualizar y eliminar su propio portafolio.
- El primer acceso con Google migra el borrador del dispositivo a la cuenta.
- Autoguardado en Supabase activado después de cada cambio.
- Al entrar desde otro dispositivo, el editor recupera el portafolio almacenado en la cuenta.
- La copia local permanece como respaldo cuando la conexión falla.
- El nombre público de Identidad también sincroniza el perfil de la cuenta.
- Guardado corregido para usar inserción inicial y actualizaciones posteriores, manteniendo `user_id` inmutable y evitando el error de permisos del primer autoguardado.
- El editor diferencia visualmente entre “Guardado en Brilla” y “Guardado en este dispositivo”.

### Fase 3 — Archivos multimedia

- Almacenamiento seguro de imágenes, videos y logos.
- Validación de tipo y tamaño de archivo.
- Compresión y generación de miniaturas.
- Portada para videos.
- Eliminación de archivos reemplazados.
- Límites claros por portafolio.
- Entrega rápida de archivos en móvil.

**Criterio de finalización:** los archivos permanecen disponibles después de cerrar sesión y pueden verse desde el portafolio público.

**Avance al 5 de septiembre de 2026:**

- Bucket privado `creator-media` creado en Supabase Storage; ningún archivo tiene una URL pública permanente.
- Imágenes, videos, retratos, visuales de cierre y logos se sincronizan con la cuenta autenticada.
- Los archivos locales existentes se migran automáticamente a Brilla en el primer acceso, sin perder la copia de respaldo del dispositivo.
- Al entrar desde otro dispositivo, el editor recupera metadatos y genera enlaces privados temporales para la vista previa.
- Formatos aceptados limitados a JPG, PNG, WebP, GIF, MP4, WebM y MOV.
- Límite de 10 MB para imágenes y logos, y 50 MB para videos, validado tanto en la interfaz como en Storage.
- Las imágenes grandes se redimensionan hasta 2400 px y se convierten a WebP solo cuando el resultado pesa menos que el original.
- Cada foto y video obtiene una miniatura WebP; en videos también funciona como portada antes de reproducir.
- Políticas RLS verificadas para metadatos y objetos: cada creadora solo puede operar dentro de su carpeta.
- Reemplazar o eliminar un archivo también elimina la copia anterior de Storage; los borrados hechos en otro dispositivo no se restauran desde una caché antigua.
- La interfaz informa cargas en curso y conserva el archivo local si una sincronización falla.
- Los archivos ya se entregan mediante enlaces temporales dentro de la ruta pública independiente creada en la Fase 4.

### Fase 4 — Publicación real

- Ruta pública por creadora, por ejemplo `/sofia-mendoza`.
- Validación de nombres disponibles y bloqueo de duplicados.
- Acciones para publicar, actualizar y despublicar.
- Vista pública separada del editor.
- Título, descripción e imagen social propios por portafolio.
- Vista previa correcta al compartir por WhatsApp y otras redes.

**Criterio de finalización:** cualquier persona con el enlace puede abrir el portafolio publicado sin entrar al editor.

**Avance al 5 de septiembre de 2026:**

- Ruta pública dinámica creada en `/{nombre-elegido}` para plantillas web y presentacionales.
- El editor comprueba disponibilidad del enlace antes de publicar y reserva rutas del sistema como `crear`, `cuenta`, `api` y `admin`.
- La base de datos mantiene una restricción única para impedir que dos creadoras publiquen el mismo enlace, incluso si lo intentan al mismo tiempo.
- Publicar, seguir actualizando y despublicar ya modifican el estado real almacenado en Supabase.
- El botón para compartir copia la URL pública real y permite abrirla en otra pestaña.
- La página pública solo recibe portafolios con estado `published` y visibilidad `public`.
- La contraseña y preferencias internas se eliminan de la respuesta pública antes de salir de la base de datos.
- Fotos, videos, miniaturas y logos permanecen en el bucket privado y se entregan mediante enlaces firmados temporales.
- Cada portafolio genera título, descripción e imagen social propios a partir de sus datos y retrato.
- Los enlaces inexistentes, despublicados o no públicos muestran una página 404 de Brilla y no exponen datos.
- La publicación protegida con contraseña continúa reservada para la Fase 5.

### Fase 5 — Privacidad

- Portafolio público, protegido o despublicado.
- Contraseñas almacenadas de forma segura, nunca visibles en el código público.
- Límite de intentos fallidos.
- Posibilidad de cambiar o eliminar la contraseña.
- Enlaces privados revocables como mejora posterior.

**Criterio de finalización:** el contenido protegido no puede obtenerse sin superar la validación del servidor.

### Fase 6 — Panel de la creadora

- Resumen de su portafolio.
- Estado de publicación.
- Botones para editar, ver y copiar el enlace.
- Fecha de última actualización.
- Visitas totales y clics principales.
- Acciones para duplicar, despublicar o eliminar.

**Criterio de finalización:** la creadora puede administrar su portafolio sin recorrer nuevamente todo el editor.

### Fase 7 — Analítica y notificaciones

- Registro de visitas reales.
- Conteo de visitantes aproximados sin prometer identidad individual.
- Clics en correo, WhatsApp, Instagram y TikTok.
- Fecha de última visita.
- Preferencia para activar o desactivar alertas.
- Correos de notificación con límites para evitar spam.

**Criterio de finalización:** las cifras del panel provienen de actividad real y no de una simulación local.

### Fase 8 — Conexión opcional con Instagram

Esta integración se desarrollará después de que cuentas, base de datos, publicación y analítica propia estén funcionando. No será un requisito para crear o publicar un portafolio.

- Mantener campos manuales para todas las creadoras.
- Permitir conexión únicamente mediante la API oficial de Meta.
- Admitir cuentas profesionales de Instagram tipo Creator o Business.
- Solicitar solo permisos básicos y de lectura de métricas.
- No solicitar permisos para publicar contenido, leer mensajes o administrar comentarios.
- Importar usuario, foto de perfil, seguidores y métricas disponibles de cuenta y contenido.
- Sincronizar automáticamente cada 6–24 horas, no prometer datos en tiempo real.
- Mostrar claramente la fecha y hora de la última sincronización.
- Incluir acciones para actualizar, reconectar y desconectar Instagram.
- Cifrar los accesos de Meta y almacenarlos únicamente en el servidor.
- Eliminar accesos y datos asociados cuando la creadora desconecte su cuenta.
- Preparar la aplicación de Meta, la verificación del negocio y la revisión para acceso avanzado.
- Manejar cuentas con menos de 100 seguidores, métricas vacías, historial limitado y conexiones caducadas.
- Mostrar el distintivo “Métricas sincronizadas con Instagram” solo cuando exista una conexión válida y reciente.

**Criterio de finalización:** una creadora puede conectar y desconectar voluntariamente su cuenta profesional, Brilla actualiza únicamente los datos autorizados y el portafolio continúa funcionando si la integración falla.

### Fase 9 — PDF y comunicación

- PDF consistente para cada plantilla.
- Correos de bienvenida y verificación.
- Recuperación de contraseña.
- Confirmación de publicación.
- Avisos de seguridad y actividad cuando corresponda.

**Criterio de finalización:** las comunicaciones esenciales y la descarga funcionan sin depender de pasos manuales.

### Fase 10 — Seguridad, privacidad y control

- Política de privacidad y términos de uso.
- Consentimiento para datos personales y analítica no esencial.
- Validación de campos, enlaces y teléfonos.
- Protección frente a archivos maliciosos y abuso.
- Exportación y eliminación de datos de la cuenta.
- Registro de eventos administrativos importantes.
- Copias de seguridad y recuperación.

**Criterio de finalización:** una creadora puede entender, controlar y eliminar la información que Brilla conserva.

### Fase 11 — Calidad y lanzamiento

- Pruebas en móvil, tablet y computador.
- Pruebas de todas las plantillas.
- Navegación mediante teclado y revisión de accesibilidad.
- Comportamiento con videos grandes o conexiones lentas.
- Pruebas automáticas actualizadas para las rutas reales.
- Seguimiento de errores y rendimiento.
- Preparación del entorno de producción.

**Criterio de finalización:** los flujos críticos de registro, edición, publicación, privacidad y eliminación pasan las pruebas antes de publicar.

## Orden de trabajo recomendado

1. Cuentas y sesión.
2. Base de datos.
3. Almacenamiento multimedia.
4. Publicación mediante enlaces reales.
5. Privacidad con contraseña.
6. Panel de la creadora.
7. Analítica y notificaciones.
8. Conexión opcional con Instagram.
9. PDF y correos.
10. Seguridad, privacidad y pruebas.
11. Lanzamiento.

## Decisiones de producto para el MVP

- El portafolio básico seguirá siendo gratuito para las creadoras.
- El portal empresarial no se construirá en esta fase.
- Las métricas de redes sociales se ingresarán manualmente en el MVP.
- La conexión con Instagram será opcional y se implementará después de la base funcional.
- La comunicación comercial hablará de “sincronización automática” y mostrará la última actualización; no prometerá información “en vivo y en directo”.
- Las creadoras sin una cuenta profesional de Instagram podrán usar todas las funciones esenciales del portafolio.
- Brilla solicitará solo permisos de lectura necesarios y explicará que no publica contenido ni accede a mensajes.
- No se prometerá identificar empresas o personas a partir de visitas anónimas.
- Se priorizará publicar y compartir correctamente antes de añadir más plantillas.
- Las funciones demostrativas deberán implementarse de verdad o retirarse temporalmente de la comunicación comercial.

## Próximo hito

Implementar conjuntamente **cuentas, base de datos y almacenamiento**, porque son la base necesaria para guardar, publicar y administrar portafolios reales.
