/* ═══════════════════════════════════════════════════
   LÁMINA DE RESULTADO — 1080×1350 (4:5, feed)
   ═══════════════════════════════════════════════════
   Lo que el participante se lleva al celular. Misma gramática que la
   pantalla: acta de federación sobre negro, una sola cosa en verde.
*/

import { miniatura } from "./scene.js";

const W = 1080, H = 1350;
const M = 88;                       // margen

const FONDO = "#0F1210";
const TEXTO = "#F2F6F2";
const TEXTO_2 = "#A8B0A9";
const TEXTO_3 = "#6E756F";
const FILETE = "#2C322D";
const VLA = "#00E676";

const T = (p, w) => `${w} ${p}px Archivo, "Helvetica Neue", sans-serif`;

export function pintarPoster(canvas, orden, curso) {
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext("2d");

  c.fillStyle = FONDO;
  c.fillRect(0, 0, W, H);
  c.textAlign = "left";
  c.textBaseline = "alphabetic";

  /* Cabecera */
  filete(c, M, 132, W - M);
  c.font = T(22, 600);
  c.fillStyle = TEXTO_3;
  letras(c, "CABALLOS DE FUERZA", M, 116, 3.4);
  c.font = T(22, 600);
  c.fillStyle = VLA;
  c.textAlign = "right";
  letras(c, "VLA", W - M, 116, 3.4, "right");
  c.textAlign = "left";

  /* El caballo campeón, grande, en el vacío */
  const campeon = orden[0];
  c.save();
  c.translate(M, 190);
  miniatura(c, campeon.dibujo, W - M * 2, 330, campeon.color, 7);
  c.restore();

  /* Quién gana */
  c.font = T(21, 600);
  c.fillStyle = TEXTO_3;
  letras(c, "GANA", M, 610, 3.4);

  c.font = T(112, 700);
  c.fillStyle = TEXTO;
  c.fillText(recorta(c, campeon.nombre, W - M * 2), M - 5, 712);

  c.font = T(40, 500);
  c.fillStyle = VLA;
  c.fillText(campeon.meta === null ? "sin terminar" : `${campeon.meta.toFixed(2)} s`, M - 2, 766);

  /* Acta */
  let y = 856;
  c.font = T(20, 600);
  c.fillStyle = TEXTO_3;
  letras(c, "ACTA", M, y, 3.4);
  if (curso?.nombre) {
    c.textAlign = "right";
    c.font = T(24, 500);
    c.fillStyle = TEXTO_2;
    c.fillText(`${curso.nombre} · ${curso.largo} m`, W - M, y);
    c.textAlign = "left";
  }
  y += 26;
  filete(c, M, y, W - M);

  orden.forEach((r, i) => {
    const alto = 84;
    const base = y + alto - 30;

    c.font = T(30, 600);
    c.fillStyle = i === 0 ? VLA : TEXTO_3;
    c.fillText(`${i + 1}`, M, base);

    c.save();
    c.translate(M + 54, y + 14);
    miniatura(c, r.dibujo, 96, 58, r.color, 2.8);
    c.restore();

    c.font = T(34, 600);
    c.fillStyle = TEXTO;
    c.fillText(recorta(c, r.nombre + (r.esBot ? " (CPU)" : ""), 480), M + 168, base);

    c.textAlign = "right";
    c.font = T(34, 600);
    c.fillStyle = r.meta === null ? TEXTO_3 : TEXTO;
    c.fillText(r.meta === null ? "DNF" : `${r.meta.toFixed(2)}s`, W - M, base);
    c.textAlign = "left";

    y += alto;
    filete(c, M, y, W - M, i === orden.length - 1 ? FILETE : "#20251F");
  });

  /* Pie */
  c.font = T(26, 550);
  c.fillStyle = TEXTO_2;
  c.fillText("@somosvla_", M, H - 76);

  c.textAlign = "right";
  c.font = T(26, 550);
  c.fillStyle = TEXTO_3;
  c.fillText("La IA es el nuevo inglés", W - M, H - 76);
  c.textAlign = "left";
}

function filete(c, x0, y, x1, color = FILETE) {
  c.fillStyle = color;
  c.fillRect(x0, y, x1 - x0, 1);
}

/** Texto con tracking manual: canvas no expone letter-spacing en todos lados. */
function letras(c, texto, x, y, sep, alineacion = "left") {
  const total = [...texto].reduce((a, ch) => a + c.measureText(ch).width + sep, -sep);
  let cx = alineacion === "right" ? x - total : x;
  const guardada = c.textAlign;
  c.textAlign = "left";
  for (const ch of texto) {
    c.fillText(ch, cx, y);
    cx += c.measureText(ch).width + sep;
  }
  c.textAlign = guardada;
}

function recorta(c, texto, maxAncho) {
  if (c.measureText(texto).width <= maxAncho) return texto;
  let t = texto;
  while (t.length > 1 && c.measureText(t + "…").width > maxAncho) t = t.slice(0, -1);
  return t + "…";
}
