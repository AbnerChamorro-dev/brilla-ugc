import type { Metadata } from "next";
import Link from "next/link";
import "../legal/legal.css";

export const metadata: Metadata = {
  title: "Términos de Uso | Brilla",
  description: "Términos aplicables al uso de Brilla, operada por TECNOLOGYC S.A.S.",
};

const contactEmail = "abner.chamorro@brillaugc.com";

export default function TermsPage() {
  return <main className="legalPage">
    <nav className="legalNav"><Link className="legalBrand" href="/">brilla<span>•</span></Link><Link href="/cuenta">Volver a mi cuenta</Link></nav>
    <header className="legalHero"><span>VERSIÓN 6 DE SEPTIEMBRE DE 2026</span><h1>Términos de Uso</h1><p>Estas reglas describen el servicio Brilla, las responsabilidades de las creadoras y las condiciones para publicar y compartir un portafolio.</p></header>
    <div className="legalLayout">
      <aside className="legalSummary"><strong>Operador de Brilla</strong><span>TECNOLOGYC S.A.S.<br />NIT 901787723-2<br />Calle 159 #56-75, Torre 1, apto. 1101<br />Bogotá D.C., Colombia<br />Tel. 320 318 5347</span><a href={`mailto:${contactEmail}`}>{contactEmail}</a></aside>
      <article className="legalContent">
        <section><h2>1. Aceptación</h2><p>Al crear una cuenta o utilizar Brilla, la persona declara que leyó y acepta estos Términos y que autoriza por separado el tratamiento de sus datos en los términos de la Política de Tratamiento de Datos. Si no está de acuerdo, no debe iniciar sesión ni utilizar el servicio.</p></section>
        <section><h2>2. El servicio</h2><p>Brilla permite crear, guardar, publicar, compartir y descargar portafolios UGC, almacenar archivos, mostrar métricas aproximadas y recibir comunicaciones relacionadas con la cuenta. Algunas funciones pueden identificarse como futuras, experimentales u opcionales.</p></section>
        <section><h2>3. Capacidad y cuenta</h2><p>El servicio está dirigido a personas mayores de 18 años o con plena capacidad legal para contratar. La creadora debe utilizar su propia cuenta de Google, mantenerla segura y suministrar información veraz y actualizada. No debe compartir el acceso ni suplantar a otra persona.</p></section>
        <section><h2>4. Contenido y licencia técnica</h2><p>La creadora conserva la titularidad sobre su contenido. Al cargarlo concede a TECNOLOGYC S.A.S. una licencia no exclusiva, revocable y limitada para almacenar, convertir, reproducir, mostrar y distribuir técnicamente ese contenido únicamente para prestar las funciones elegidas en Brilla.</p><p>La creadora garantiza que tiene derechos y autorizaciones suficientes sobre fotografías, videos, música, marcas, testimonios y datos de terceros. Es responsable de retirar materiales cuando pierda esos derechos.</p></section>
        <section><h2>5. Publicación</h2><p>El contenido solo se vuelve accesible públicamente cuando la creadora publica el portafolio. Quien tenga el enlace podrá verlo y compartirlo. Despublicar evita nuevas consultas desde Brilla, pero no elimina copias que terceros hayan guardado legítimamente fuera de la plataforma.</p></section>
        <section><h2>6. Uso permitido</h2><p>No se permite usar Brilla para:</p><ul><li>Publicar material ilegal, engañoso, discriminatorio, sexualmente explotador, violento o que vulnere derechos de terceros.</li><li>Distribuir malware, eludir controles, automatizar abuso o interferir con la seguridad y disponibilidad.</li><li>Suplantar identidades, falsificar métricas o atribuirse trabajos ajenos.</li><li>Recopilar datos de otras personas sin base jurídica o autorización.</li></ul><p>TECNOLOGYC S.A.S. podrá limitar o retirar contenido y suspender accesos cuando sea necesario para proteger a usuarios, terceros, la plataforma o cumplir la ley, procurando informar cuando sea razonablemente posible.</p></section>
        <section><h2>7. Disponibilidad y resultados</h2><p>Brilla procura ofrecer un servicio seguro y continuo, pero puede presentar mantenimiento, errores, cambios o interrupciones de terceros. La plataforma no garantiza contrataciones, ingresos, visualizaciones ni resultados comerciales. Las métricas de visitantes son aproximadas y no identifican personas o empresas concretas.</p></section>
        <section><h2>8. Precio y cambios</h2><p>Las funciones identificadas como gratuitas no requieren tarjeta en la versión actual. Si se crean planes pagos o cambian condiciones materiales, se informará antes de cobrar y se solicitará la aceptación correspondiente. Brilla puede mejorar, reemplazar o retirar funciones, procurando no afectar injustificadamente el acceso a los datos de la creadora.</p></section>
        <section><h2>9. Terminación y datos</h2><p>La creadora puede despublicar o eliminar su portafolio desde la cuenta y solicitar el cierre integral por el canal de contacto. TECNOLOGYC S.A.S. podrá terminar el servicio por incumplimiento grave, uso abusivo, riesgo de seguridad u obligación legal. El tratamiento posterior y la conservación limitada se regirán por la Política de Tratamiento de Datos.</p></section>
        <section><h2>10. Responsabilidad</h2><p>Cada parte responderá por los daños que le sean legalmente imputables. Nada en estos Términos limita derechos irrenunciables ni excluye responsabilidades que la ley colombiana no permita excluir. La creadora responderá por el contenido que publica y por las infracciones derivadas de materiales que no esté autorizada a usar.</p></section>
        <section><h2>11. Ley aplicable y contacto</h2><p>Estos Términos se rigen por las leyes de la República de Colombia. Las partes procurarán resolver directamente cualquier diferencia antes de acudir a las autoridades o jueces competentes. Las comunicaciones pueden dirigirse a <a href={`mailto:${contactEmail}`}>{contactEmail}</a>, al teléfono 320 318 5347 o a la dirección informada por TECNOLOGYC S.A.S. en Bogotá D.C.</p></section>
        <section><h2>12. Vigencia</h2><p>Estos Términos rigen desde el 6 de septiembre de 2026. Los cambios materiales se comunicarán y, cuando afecten las condiciones aceptadas, se solicitará una nueva aceptación antes de continuar utilizando las funciones protegidas.</p></section>
      </article>
    </div>
    <footer className="legalFooter"><span>© 2026 TECNOLOGYC S.A.S. · Brilla UGC</span><div><Link href="/privacidad">Política de datos</Link><Link href="/terminos">Términos de uso</Link><a href={`mailto:${contactEmail}`}>Contacto</a></div></footer>
  </main>;
}
