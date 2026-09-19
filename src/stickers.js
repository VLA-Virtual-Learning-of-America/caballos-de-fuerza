// Identidad visual exclusivamente. Nunca participa en la simulación.
export const STICKERS = Object.freeze([
  { codigo: "CCNA", nombre: "Cisco Certified Network Associate", logo: "CCNA.svg" },
  { codigo: "AWS", nombre: "Amazon Web Services", logo: "AWS.svg" },
  { codigo: "PMP", nombre: "Project Management Professional", logo: null },
  { codigo: "MKT", nombre: "Marketing Digital", logo: "MKT.svg" },
  { codigo: "AIB", nombre: "AI Builder Foundation", logo: "AIB.svg" },
  { codigo: "ACM", nombre: "AI Content Machine", logo: "ACM.svg" },
  { codigo: "CYB", nombre: "Cyber Seguridad", logo: "CYB.svg" },
  { codigo: "SIX", nombre: "Lean Six Sigma", logo: "SIX.svg" }
].map(Object.freeze));

export const stickerPorCodigo = codigo => STICKERS.find(s => s.codigo === codigo) || null;
const imagenes = new Map();
if (typeof Image !== "undefined") {
  for (const s of STICKERS) {
    if (!s.logo) continue;
    const img = new Image();
    img.src = new URL(`../stickers/${s.logo}`, import.meta.url).href;
    imagenes.set(s.codigo, img);
  }
}

export function etiquetaSticker(codigo) {
  const s = stickerPorCodigo(codigo);
  if (!s) return null;
  const etiqueta = document.createElement("span");
  etiqueta.className = "sticker-etiqueta";
  if (s.logo) {
    const img = document.createElement("img");
    img.src = imagenes.get(codigo).src;
    img.alt = "";
    img.addEventListener("error", () => img.remove(), { once: true });
    etiqueta.append(img);
  }
  etiqueta.append(document.createTextNode(`${s.codigo} · ${s.nombre}`));
  return etiqueta;
}

export function pintarSticker(ctx, codigo, x, y, ancho = 48, alto = 24) {
  const s = stickerPorCodigo(codigo);
  if (!s) return;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  // Fondo claro para los originales negros, sin recolorear los logos.
  ctx.fillStyle = "#F2F6F2";
  ctx.fillRect(x, y, ancho, alto);
  const img = imagenes.get(codigo);
  if (img?.complete && img.naturalWidth) {
    const escala = Math.min((ancho - 8) / img.naturalWidth, (alto - 6) / img.naturalHeight);
    const w = img.naturalWidth * escala, h = img.naturalHeight * escala;
    ctx.drawImage(img, x + (ancho - w) / 2, y + (alto - h) / 2, w, h);
  } else {
    ctx.fillStyle = "#0F1210";
    ctx.font = `600 ${Math.min(12, alto * .5)}px Archivo, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s.codigo, x + ancho / 2, y + alto / 2);
  }
  ctx.restore();
}

/** El renderer congelado solo expone render(). Observamos sus rótulos
 * durante esa llamada, sin cambiar texto, coordenadas ni proyección.
 * El orden de los nombres es el de los carriles, incluso con homónimos.
 * Restauramos fillText antes de pintar cualquier etiqueta. */
export function renderConStickers(renderer, canvas, carrera, curso, dt) {
  const ctx = canvas.getContext("2d");
  const original = ctx.fillText;
  const propia = Object.getOwnPropertyDescriptor(ctx, "fillText");
  const pendientes = carrera.corredores.filter(r => r.dibujo?.trazos?.length);
  const posiciones = [];
  let indice = 0;
  ctx.fillText = function(texto, x, y, maxAncho) {
    const r = pendientes[indice];
    if (r && maxAncho !== undefined && this.textAlign === "center" && texto === r.nombre.toUpperCase()) {
      const mitad = Math.min(this.measureText(texto).width, maxAncho) / 2;
      posiciones.push({ codigo: r.sticker, x: x + mitad + 8, y: y - 18 });
      indice++;
    }
    return original.apply(this, arguments);
  };
  try { renderer.render(carrera, curso, dt); }
  finally {
    if (propia) Object.defineProperty(ctx, "fillText", propia);
    else delete ctx.fillText;
  }
  for (const p of posiciones) pintarSticker(ctx, p.codigo, p.x, p.y);
}
