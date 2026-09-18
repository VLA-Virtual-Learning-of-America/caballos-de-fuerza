/* ═══════════════════════════════════════════════════
   TABLERO DE DIBUJO
   ═══════════════════════════════════════════════════
   Trazos crudos: [{color, puntos:[{x,y}]}]. Nada de bitmap —
   guardar vectores es lo que después permite animar las patas,
   hacer miniaturas y meter el dibujo en el póster sin pixelarse.
*/

export const TINTAS = ["#FFFFFF", "#00E676", "#FF6200", "#22D3EE", "#E879F9", "#FFD54F"];

/** Un caballo de repuesto para quien se bloquea. Coordenadas 0..1. */
const CABALLO_PRESTADO = [
  // Cuerpo (cerrado)
  [[.20,.42],[.26,.31],[.38,.27],[.52,.28],[.62,.33],[.66,.43],[.62,.54],[.50,.58],[.36,.58],[.24,.53],[.20,.42]],
  // Cuello y cabeza
  [[.60,.35],[.70,.26],[.76,.17],[.82,.13],[.90,.16],[.93,.22],[.86,.26],[.78,.27],[.72,.31]],
  // Oreja
  [[.79,.14],[.80,.07],[.84,.13]],
  // Pata delantera 1
  [[.60,.52],[.63,.68],[.61,.84],[.64,.94]],
  // Pata delantera 2
  [[.54,.55],[.55,.71],[.52,.86],[.55,.95]],
  // Pata trasera 1
  [[.28,.52],[.25,.67],[.29,.83],[.26,.94]],
  // Pata trasera 2
  [[.34,.55],[.33,.70],[.36,.85],[.33,.95]],
  // Cola
  [[.21,.35],[.13,.38],[.07,.48],[.09,.58]]
];

/** Los mismos trazos, en un lienzo virtual, para la portada. */
export const caballoDeMuestra = (color = "#00E676") =>
  CABALLO_PRESTADO.map(seg => ({
    color,
    puntos: seg.map(([x, y]) => ({ x: x * 1000, y: y * 800 }))
  }));

export function crearTablero(canvas, alVacioCambiar) {
  const c = canvas.getContext("2d");
  let trazos = [];
  let actual = null;
  let tinta = TINTAS[1];
  let W = 0, H = 0;
  let prestamoPendiente = false;

  /** Coloca el caballo de la casa, ya sabiendo cuánto mide el tablero. */
  function ponerPrestado() {
    const lado = Math.min(W, H) * 0.86;
    const ancho = lado * 1.05, alto = lado * 0.8;
    const ox = (W - ancho) / 2, oy = (H - alto) / 2;
    trazos = CABALLO_PRESTADO.map(seg => ({
      color: tinta,
      puntos: seg.map(([x, y]) => ({ x: ox + x * ancho, y: oy + y * alto }))
    }));
    pintar(); avisar();
  }

  function medir() {
    const caja = canvas.getBoundingClientRect();
    // Mientras la pantalla está oculta la caja mide 0; no se toca nada
    // o el lienzo quedaría en 0×0 y lo dibujado se colapsaría al origen.
    if (caja.width < 1 || caja.height < 1) return;
    // Si se pidió el caballo prestado cuando todavía no se podía medir,
    // se cumple ahora: una acción que no hace nada y no avisa es peor
    // que una que tarda un cuadro.
    if (prestamoPendiente) { prestamoPendiente = false; W = caja.width; H = caja.height; ponerPrestado(); }
    W = caja.width; H = caja.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    pintar();
  }

  function pintar() {
    c.clearRect(0, 0, W, H);
    c.lineCap = "round"; c.lineJoin = "round"; c.lineWidth = 4.5;
    for (const t of trazos) {
      if (t.puntos.length < 2) {
        // Un toque suelto también debe verse
        c.fillStyle = t.color;
        c.beginPath(); c.arc(t.puntos[0].x, t.puntos[0].y, 2.6, 0, 6.28); c.fill();
        continue;
      }
      c.strokeStyle = t.color;
      c.beginPath();
      t.puntos.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
      c.stroke();
    }
  }

  function avisar() { alVacioCambiar?.(trazos.length === 0); }

  const punto = e => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  canvas.addEventListener("pointerdown", e => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    actual = { color: tinta, puntos: [punto(e)] };
    trazos.push(actual);
    pintar(); avisar();
  });

  canvas.addEventListener("pointermove", e => {
    if (!actual) return;
    const p = punto(e);
    const u = actual.puntos[actual.puntos.length - 1];
    if (Math.hypot(p.x - u.x, p.y - u.y) < 2) return;  // adelgaza el trazo
    actual.puntos.push(p);
    pintar();
  });

  const soltar = () => { actual = null; };
  canvas.addEventListener("pointerup", soltar);
  canvas.addEventListener("pointercancel", soltar);
  canvas.addEventListener("pointerleave", soltar);

  // El lienzo vive dentro de pantallas que se ocultan y se muestran; un
  // observador es más fiable que acordarse de llamar a medir() en cada
  // cambio de pantalla.
  if (typeof ResizeObserver === "function") new ResizeObserver(medir).observe(canvas);
  window.addEventListener("resize", medir);
  medir();

  return {
    medir,
    set tinta(v) { tinta = v; },
    get tinta() { return tinta; },
    vacio: () => trazos.length === 0,
    trazos: () => trazos.map(t => ({ color: t.color, puntos: t.puntos.map(p => ({ ...p })) })),
    deshacer() { trazos.pop(); pintar(); avisar(); },
    limpiar() { trazos = []; pintar(); avisar(); },
    /** Recupera un dibujo anterior, para poder volver atrás un jinete. */
    cargar(previos) {
      trazos = (previos || []).map(t => ({ color: t.color, puntos: t.puntos.map(p => ({ ...p })) }));
      medir(); pintar(); avisar();
    },
    prestar() {
      medir();
      if (W < 1 || H < 1) { prestamoPendiente = true; return; }
      ponerPrestado();
    }
  };
}
