/* ═══════════════════════════════════════════════════
   INTEGRIDAD — marca de agua si se tocó la zona congelada
   ═══════════════════════════════════════════════════
   Al arrancar, calcula el hash de los archivos congelados y lo compara
   con blindaje.json. Si algo cambió, muestra una marca de agua permanente
   en pantalla: «VERSIÓN MODIFICADA · NO CERTIFICADA POR VLA».

   Es a la vista y a propósito. No rompe el juego ni lo sabotea en secreto:
   una pieza que se cae sola en mitad de una feria es peor que una modificada.
   Lo que hace es dejar CONSTANCIA de que esa copia ya no es la original, para
   que nadie la presente como la versión de VLA sin que se note.

   El mismo SHA-256 que usa verificar.js del lado de Node, aquí con WebCrypto.
*/

const CONGELADOS = ["src/race.js", "src/cursos.js", "src/scene.js", "src/hero.js"];

async function hash16(texto) {
  const datos = new TextEncoder().encode(texto);
  const buf = await crypto.subtle.digest("SHA-256", datos);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

async function comprobar() {
  // Sin subtle crypto (http sin localhost en algunos móviles) no se marca nada:
  // el candado de verdad es verificar.js y CI; esto es un aviso extra.
  if (!crypto?.subtle) return;

  let blindaje;
  try { blindaje = await (await fetch("./blindaje.json", { cache: "no-store" })).json(); }
  catch { return; }

  const cambiados = [];
  for (const f of CONGELADOS) {
    try {
      const txt = await (await fetch(`./${f}`, { cache: "no-store" })).text();
      if (blindaje[f] && await hash16(txt) !== blindaje[f]) cambiados.push(f);
    } catch { /* archivo movido: se ignora, no se rompe nada */ }
  }
  if (cambiados.length) marcar(cambiados);
}

function marcar(cambiados) {
  const cinta = document.createElement("div");
  cinta.setAttribute("role", "status");
  cinta.style.cssText = [
    "position:fixed", "left:0", "right:0", "bottom:0", "z-index:9999",
    "padding:10px 16px", "background:#7a1f14", "color:#ffe9e5",
    "font:600 12px/1.4 system-ui,sans-serif", "letter-spacing:.06em",
    "text-transform:uppercase", "text-align:center", "pointer-events:none"
  ].join(";");
  cinta.textContent =
    `Versión modificada · No certificada por VLA · Física o perspectiva alteradas (${cambiados.length})`;
  (document.body || document.documentElement).appendChild(cinta);
  try { console.warn("[VLA] Zona congelada modificada:", cambiados.join(", "), "— ver HANDOFF.md"); } catch { /* */ }
}

comprobar();
