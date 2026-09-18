/* ═══════════════════════════════════════════════════
   ALMACÉN LOCAL — contactos, corridas y teclas
   ═══════════════════════════════════════════════════
   Todo vive en el localStorage del equipo del stand. No hay backend:
   un solo PC, cero dependencia del WiFi del recinto. Los contactos se
   sacan en CSV al final del día.

   Cada corrida terminada se guarda una sola vez y sirve para dos cosas:
   alimenta el ranking y queda como FANTASMA, es decir, como rival
   grabado para el que llegue después. Por eso se guardan también los
   tiempos exactos de cada grito: con ellos el motor vuelve a correr la
   misma carrera, tal como la corrió esa persona.
*/

const K_LEADS = "cdf-leads-v1";
const K_CORRIDAS = "cdf-corridas-v2";
const K_TECLAS = "cdf-teclas-v2";

/* Cuatro columnas verticales del teclado, una por jinete. Arriba se
   salta, en medio se corre, abajo se agacha: la posición de la tecla
   dice lo que hace, que es lo único que se puede aprender en los tres
   segundos que alguien mira la parrilla. */
const TECLAS_POR_DEFECTO = [
  { correr: "a", saltar: "q", agachar: "z" },
  { correr: "f", saltar: "r", agachar: "v" },
  { correr: "j", saltar: "u", agachar: "m" },
  { correr: "l", saltar: "o", agachar: "." }
];
const clonarTeclas = () => TECLAS_POR_DEFECTO.map(t => ({ ...t }));
const POR_CURSO = 36;      // cuántas corridas se guardan de cada carrera
const MAX_PUNTOS = 500;    // techo de puntos por dibujo guardado

function leer(clave, respaldo) {
  try {
    const v = localStorage.getItem(clave);
    return v ? JSON.parse(v) : respaldo;
  } catch { return respaldo; }
}

function escribir(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); return true; }
  catch { return false; }
}

/* ───────── Contactos ───────── */

export const leads = () => leer(K_LEADS, []);

export function guardarLead({ nombre, telefono, correo, consiente }) {
  if (!telefono || !correo || !consiente) return;
  const lista = leads();
  const clave = correo.toLowerCase();
  if (lista.some(l => (l.correo || "").toLowerCase() === clave)) return;
  lista.push({
    fecha: new Date().toISOString(),
    nombre: nombre || "",
    telefono,
    correo,
    consiente: true,
    origen: "Caballos de Fuerza, tech fest"
  });
  escribir(K_LEADS, lista);
}

export function leadsCSV() {
  const filas = leads();
  const cab = ["fecha", "nombre", "telefono", "correo", "consiente", "origen"];
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return "﻿" + [cab.join(","), ...filas.map(f => cab.map(k => esc(f[k])).join(","))].join("\r\n");
}

/* ───────── Corridas: ranking y fantasmas ───────── */

/** Un garabato muy largo no puede ocupar el almacén entero. */
function aligerar(dibujo) {
  if (!dibujo?.trazos) return dibujo;
  const total = dibujo.trazos.reduce((a, t) => a + t.puntos.length, 0);
  if (total <= MAX_PUNTOS) return dibujo;
  const salto = Math.ceil(total / MAX_PUNTOS);
  return {
    aspecto: dibujo.aspecto,
    trazos: dibujo.trazos.map(t => ({
      color: t.color,
      // Se conserva siempre el último punto para no cortar el trazo
      puntos: t.puntos.filter((_, i) => i % salto === 0 || i === t.puntos.length - 1)
    }))
  };
}

const corridas = () => leer(K_CORRIDAS, []);

export function guardarCorrida({ nombre, tiempo, dibujo, color, curso, gritos, acciones, sticker }) {
  if (!Number.isFinite(tiempo)) return;
  const lista = corridas();
  lista.push({
    fecha: Date.now(),
    curso: curso || "llano",
    nombre,
    tiempo,
    color,
    dibujo: aligerar(dibujo),
    sticker: typeof sticker === "string" ? sticker : null,
    gritos: Array.isArray(gritos) ? gritos.map(t => Math.round(t * 1000) / 1000) : [],
    // Saltos y agaches, para que el fantasma repita también los obstáculos
    acciones: Array.isArray(acciones) ? acciones : []
  });

  // Se recorta por carrera, no en total: que una carrera muy jugada no
  // se coma el registro de las otras.
  const porCurso = {};
  for (const r of lista) (porCurso[r.curso] ||= []).push(r);
  const recortado = Object.values(porCurso)
    .flatMap(rs => rs.sort((a, b) => a.tiempo - b.tiempo).slice(0, POR_CURSO));
  escribir(K_CORRIDAS, recortado);
}

/** Ranking de una carrera, del más rápido al más lento. */
export const ranking = cursoId =>
  corridas()
    .filter(r => !cursoId || r.curso === cursoId)
    .sort((a, b) => a.tiempo - b.tiempo);

/** Cuántas corridas hay guardadas, para saber si ya hay con quién correr. */
export const cuantosFantasmas = cursoId => ranking(cursoId).length;

/**
 * Elige rivales grabados para llenar carriles vacíos.
 *
 * No se toman los tres mejores a propósito: si al que llega le ponen
 * enfrente el podio del día, pierde siempre y se va. Se toma el récord
 * (que es el que da ganas), uno del montón y el más flojo, para que la
 * carrera esté peleada y haya a quién ganarle.
 */
export function fantasmas(cursoId, cuantos) {
  const pool = ranking(cursoId).filter(r => r.gritos?.length);
  if (!pool.length || cuantos <= 0) return [];
  if (pool.length <= cuantos) return pool.slice(0, cuantos);

  const elegidos = [];
  const indices = cuantos === 1
    ? [0]
    : cuantos === 2
      ? [0, pool.length - 1]
      : [0, Math.floor(pool.length / 2), pool.length - 1];

  for (const i of indices.slice(0, cuantos)) {
    if (!elegidos.includes(pool[i])) elegidos.push(pool[i]);
  }
  // Si algún índice se repitió, se completa con los que falten
  for (const r of pool) {
    if (elegidos.length >= cuantos) break;
    if (!elegidos.includes(r)) elegidos.push(r);
  }
  return elegidos.slice(0, cuantos);
}

/* ───────── Teclas de los carriles ───────── */

export function teclas() {
  const guardadas = leer(K_TECLAS, null);
  if (Array.isArray(guardadas) && guardadas.length === 4 && typeof guardadas[0] === "object") {
    return guardadas.map((t, i) => ({ ...TECLAS_POR_DEFECTO[i], ...t }));
  }
  // Migración de la primera versión, que solo guardaba la tecla de correr
  const v1 = leer("cdf-teclas-v1", null);
  const base = clonarTeclas();
  if (Array.isArray(v1) && v1.length === 4) v1.forEach((k, i) => { if (k) base[i].correr = k; });
  return base;
}

export const guardarTeclas = t => escribir(K_TECLAS, t);
export const teclasPorDefecto = clonarTeclas;

/* ───────── Reinicio del evento ───────── */

export function reiniciarEvento() {
  try {
    localStorage.removeItem(K_LEADS);
    localStorage.removeItem(K_CORRIDAS);
    localStorage.removeItem("cdf-ranking-v1");   // registro de la primera versión
  } catch { /* modo privado: no hay nada que borrar */ }
}

/* ───────── Descargas ───────── */

export function descargar(nombreArchivo, contenido, tipo = "text/csv;charset=utf-8") {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombreArchivo;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
