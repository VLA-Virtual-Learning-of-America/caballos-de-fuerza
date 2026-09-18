/* ═══════════════════════════════════════════════════
   CARRERAS — perfil del terreno
   ═══════════════════════════════════════════════════
   Los 100 llanos son la carrera original y se dejan intactos:
   sin cuesta, el terreno es plano y todo el cálculo de pendiente
   devuelve cero, así que el motor se comporta exactamente igual
   que antes de que existiera este archivo.

   La subida existe para cambiar la estrategia, no solo la duración.
   En llano gana el pulso más parejo. En la cuesta eso no alcanza:
   el impulso se escapa casi al doble de rápido subiendo, así que
   hay que llegar al pie con fuelle guardado y apretar arriba. Y la
   bajada regala velocidad al que supo conservarla.
*/

export const CURSOS = [
  {
    id: "llano",
    nombre: "Los 100 llanos",
    resumen: "Cien metros sin accidentes. Gana el pulso más parejo.",
    duracion: "Unos 11 segundos",
    largo: 100,
    limite: 45,
    cuesta: null
  },
  {
    id: "subida",
    nombre: "La subida",
    resumen: "Ciento ochenta metros con una cuesta al medio. Hay que guardar fuelle para arriba.",
    duracion: "Unos 24 segundos",
    largo: 180,
    limite: 80,
    cuesta: { alto: 7, subeIni: 58, subeFin: 100, bajaIni: 124, bajaFin: 162 },
    vallas: null
  },
  {
    id: "obstaculos",
    nombre: "La pista de obstáculos",
    resumen: "Ciento cuarenta metros con seis obstáculos. Unos se saltan y otros se pasan agachado.",
    duracion: "Unos 19 segundos",
    largo: 140,
    limite: 70,
    cuesta: null,
    /* En oddhoof estos dos obstáculos son pasivos: se resuelven con un
       deslizador de largo de pata antes de correr, y durante la carrera el
       jugador no hace nada. Aquí son ACTIVOS: cada jinete tiene, además de
       su botón de velocidad, uno de saltar y uno de agacharse, y tiene que
       acertar cuál y cuándo. Saltar una valla alta es peor que no hacer
       nada: se estrella de lleno. */
    obstaculos: [
      { x: 24, tipo: "salto" },
      { x: 46, tipo: "agache" },
      { x: 68, tipo: "salto" },
      { x: 88, tipo: "agache" },
      { x: 107, tipo: "agache" },
      { x: 126, tipo: "salto" }
    ],
    // Metros antes del obstáculo a los que se avisa al jinete
    aviso: 15
  }
];

export const cursoPorId = id => CURSOS.find(c => c.id === id) || CURSOS[0];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Interpolación suave: sin esquinas, para que la cuesta no tenga codos. */
const suave = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Altura del terreno, en metros, a los `x` metros de carrera. */
export function altura(curso, x) {
  const q = curso?.cuesta;
  if (!q) return 0;
  return q.alto * suave(q.subeIni, q.subeFin, x) * (1 - suave(q.bajaIni, q.bajaFin, x));
}

/** Pendiente: metros que sube el terreno por metro avanzado. */
export function pendiente(curso, x) {
  if (!curso?.cuesta) return 0;
  return altura(curso, x + 0.5) - altura(curso, x - 0.5);
}

/**
 * Velocidad corregida por la pendiente.
 *
 * La primera versión de esto multiplicaba y estaba mal: medida, la cuesta
 * ABRÍA la diferencia (el líder sacaba 16 m en la cima en vez de 7), porque
 * subir castiga proporcionalmente y bajar premia proporcionalmente. En una
 * feria eso deja al último fuera de pantalla y sin nada que mirar.
 *
 * Ahora la cuesta pone un TECHO de velocidad: arriba todos quedan reducidos
 * al mismo trote por más impulso que traigan, y el pelotón se junta. La
 * bajada regala la misma velocidad absoluta a todos, así que tampoco vuelve
 * a abrirse de golpe. Medido: la ventaja en la cima pasa de 16,2 m a 9,6 m.
 */
export function velocidadEnPendiente(v, s, base) {
  if (s > 0) return Math.min(v * (1 - 1.55 * s), Math.max(1.8, base * (1 - 1.15 * s) + 0.6));
  if (s < 0) return v + base * 1.25 * -s;
  return v;
}

/** Subiendo, el impulso se escapa más rápido. Ese es el castigo de la cuesta. */
export const fugaPorPendiente = s => 1 + 2.2 * Math.max(0, s);

/* ───────── Obstáculos ───────── */

/** El obstáculo que se cruzó en este paso de simulación, si se cruzó alguno. */
export function obstaculoCruzado(curso, antes, ahora) {
  if (!curso?.obstaculos) return null;
  return curso.obstaculos.find(o => antes < o.x && ahora >= o.x) || null;
}

/** El siguiente obstáculo por delante, para avisar a tiempo al jinete. */
export function obstaculoProximo(curso, x) {
  if (!curso?.obstaculos) return null;
  const o = curso.obstaculos.find(o => o.x > x);
  return o && o.x - x <= curso.aviso ? o : null;
}

export const ACCIONES = {
  salto: { nombre: "Saltar", flecha: "↑" },
  agache: { nombre: "Agacharse", flecha: "↓" }
};

/** Muestras normalizadas 0..1 para dibujar el perfil en la pantalla de elección. */
export function perfilNormalizado(curso, muestras = 48) {
  const alto = curso.cuesta?.alto || 1;
  return Array.from({ length: muestras + 1 }, (_, i) => {
    const x = (i / muestras) * curso.largo;
    return { x: i / muestras, y: altura(curso, x) / alto };
  });
}
