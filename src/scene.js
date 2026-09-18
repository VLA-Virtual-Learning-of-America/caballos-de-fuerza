/* ═══════════════════════════════════════════════════
   ESCENA — pista en falso 3D sobre Canvas 2D
   ═══════════════════════════════════════════════════
   Mundo: x = metros recorridos · y = altura · z = carril.
   Todo se proyecta con una división por profundidad. Sin WebGL,
   sin dependencias: en una feria lo que no se instala no falla.

   El truco de la animación: el dibujo del participante nunca se
   “riggea”. Se toman sus trazos crudos y se mueve con un seno todo
   punto que caiga en el tercio inferior del dibujo. Eso es lo que el
   ojo lee como patas galopando.

   El suelo sigue el perfil de la carrera (ver cursos.js). En los 100
   llanos ese perfil es constante cero, así que la pista se dibuja
   exactamente igual que cuando no existían las cuestas.
*/

import { altura, pendiente, obstaculoProximo, ACCIONES } from "./cursos.js";
import { SALTO_AIRE, AGACHE_DURA, avisoObstaculo } from "./race.js";

const CARRILES = [0, 2, 4, 6];
const LINEA_PATAS = 0.62;   // por debajo de esto, un punto “es pata”
const GRUPOS = 4;           // columnas de patas con fase distinta
const PASO = 2.5;           // cada cuántos metros se muestrea el terreno

/* La cuesta se dibuja a media altura. Medido: con la altura real, a 90 m
   el suelo cae 298 px por encima del borde superior y la loma no se ve;
   comprimida entra en cuadro y se lee como loma. La física sigue usando
   la altura de verdad — esto es solo la escala vertical del dibujo. */
const ESCALA_ALTURA = 0.5;

const P = {
  profundidad: 0.022,  // cuánto encoge un carril lejano
  fuga: 0.0015,        // cuánto encoge la distancia
  avanceX: 0.96,
  sesgoZ: 0.72,
  subidaX: 0.16,
  bajadaZ: 0.56
};

const menosMovimiento = typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ───────── Normalización del dibujo ───────── */

/**
 * Lleva los trazos a una caja 0..1: x centrado en 0, y de 0 (arriba)
 * a 1 (abajo). Guarda el aspecto para no deformar al participante.
 */
export function normalizar(trazos) {
  const pts = trazos.flatMap(t => t.puntos);
  if (!pts.length) return { aspecto: 1.75, trazos: [] };

  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
  }
  const w = Math.max(10, x1 - x0), h = Math.max(10, y1 - y0);
  const cx = (x0 + x1) / 2;

  return {
    aspecto: w / h,
    trazos: trazos.map(t => ({
      color: t.color,
      puntos: t.puntos.map(p => ({ x: (p.x - cx) / w, y: (p.y - y0) / h }))
    }))
  };
}

/* ───────── Miniatura (parrilla, acta, ranking, lámina) ───────── */

export function miniatura(ctx, dibujo, w, h, color, grosor = 2.4) {
  if (!dibujo || !dibujo.trazos.length) return;
  const esc = Math.min(w / Math.max(dibujo.aspecto, 0.2), h) * 0.88;
  const ancho = esc * dibujo.aspecto;
  const ox = w / 2, oy = (h - esc) / 2;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = grosor;
  for (const t of dibujo.trazos) {
    if (t.puntos.length < 2) continue;
    ctx.strokeStyle = color || t.color;
    ctx.beginPath();
    t.puntos.forEach((p, i) => {
      const X = ox + p.x * ancho, Y = oy + p.y * esc;
      i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
    });
    ctx.stroke();
  }
}

/* ───────── Renderer de pista ───────── */

export function crearRenderer(canvas) {
  const c = canvas.getContext("2d");
  let W = 0, H = 0, S = 1, ox = 0, oy = 0, cam = 0, ultimaCarrera = null;
  let curso = null;
  const polvo = [];

  const h = x => altura(curso, x) * ESCALA_ALTURA;

  function medir() {
    const caja = canvas.getBoundingClientRect();
    W = caja.width || window.innerWidth;
    H = caja.height || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = W < 820 ? Math.min(W / 13.5, H / 17) : Math.min(W / 24, H / 13);
    ox = W * 0.34;
  }

  const p = (x, y, z) => {
    const rx = x - cam;
    const d = Math.max(0.5, 1 + (3 - z) * P.profundidad + rx * P.fuga);
    return {
      x: ox + (rx * P.avanceX + (z - 3) * P.sesgoZ) * S / d,
      y: oy + (-rx * P.subidaX + (z - 3) * P.bajadaZ - y) * S / d
    };
  };

  function linea(vs, color, grosor = 1, alfa = 1) {
    c.globalAlpha = alfa;
    c.beginPath();
    vs.forEach((v, i) => { const q = p(...v); i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); });
    c.strokeStyle = color; c.lineWidth = grosor; c.lineCap = "round"; c.lineJoin = "round";
    c.stroke();
    c.globalAlpha = 1;
  }

  function poligono(vs, relleno, alfa = 1) {
    c.globalAlpha = alfa;
    c.beginPath();
    vs.forEach((v, i) => { const q = p(...v); i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); });
    c.closePath();
    c.fillStyle = relleno; c.fill();
    c.globalAlpha = 1;
  }

  /** Una línea que va pegada al suelo a lo largo del tramo visible. */
  function lineaSuelo(z, desde, hasta, color, grosor, alfa = 1) {
    const vs = [];
    for (let x = desde; x < hasta; x += PASO) vs.push([x, h(x), z]);
    vs.push([hasta, h(hasta), z]);
    linea(vs, color, grosor, alfa);
  }

  /* ── Fondo ── */
  function fondo() {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0F1210");
    g.addColorStop(0.55, "#0B100C");
    g.addColorStop(1, "#0F1210");
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    c.strokeStyle = "rgba(0,230,118,.035)"; c.lineWidth = 1;
    const paso = 66, desfase = (-cam * 6) % paso;
    c.beginPath();
    for (let x = desfase; x < W; x += paso) { c.moveTo(x, 0); c.lineTo(x, H); }
    for (let y = 0; y < H; y += paso) { c.moveTo(0, y); c.lineTo(W, y); }
    c.stroke();
  }

  /* ── Suelo, carriles y marcas de distancia ── */
  function pista(desde, hasta) {
    // La franja de suelo se traza siguiendo el perfil por los dos bordes
    c.beginPath();
    for (let x = desde; x < hasta; x += PASO) { const q = p(x, h(x), -1.3); x === desde ? c.moveTo(q.x, q.y) : c.lineTo(q.x, q.y); }
    { const q = p(hasta, h(hasta), -1.3); c.lineTo(q.x, q.y); }
    for (let x = hasta; x > desde; x -= PASO) { const q = p(x, h(x), 7.6); c.lineTo(q.x, q.y); }
    { const q = p(desde, h(desde), 7.6); c.lineTo(q.x, q.y); }
    c.closePath();
    c.fillStyle = "#131815"; c.fill();

    // El verde solo enmarca la pista; los carriles interiores son neutros.
    for (const z of [-1.3, 7.6]) lineaSuelo(z, desde, hasta, "#00E676", 2, 0.20);
    for (let z = 1; z < 7; z += 2) lineaSuelo(z, desde, hasta, "#2A332C", 1.4);

    // Marcas cada 10 m
    for (let m = Math.max(0, Math.floor((cam - 30) / 10) * 10); m <= Math.min(curso.largo, cam + 45); m += 10) {
      const esMeta = m === curso.largo, esSalida = m === 0;
      const y = h(m);
      linea([[m, y, -1.3], [m, y, 7.6]], esMeta || esSalida ? "#00E676" : "#232B25",
            esMeta || esSalida ? 2.2 : 1.2, esMeta || esSalida ? 0.75 : 1);
      if (m % 20 === 0 && !esMeta) {
        const q = p(m, y, -2.4);
        c.font = `550 ${Math.max(10, S * 0.32)}px Archivo, sans-serif`;
        c.fillStyle = "#6E756F"; c.textAlign = "center";
        c.fillText(`${m}m`, q.x, q.y);
      }
    }

    // Vallas laterales
    for (const z of [-1.45, 7.75]) {
      for (let x = Math.floor(desde / 6) * 6; x < hasta; x += 6) {
        const y = h(x);
        linea([[x, y, z], [x, y + 0.85, z]], "#1E2620", Math.max(1.5, S * 0.05));
      }
      const vs = [];
      for (let x = desde; x < hasta; x += PASO) vs.push([x, h(x) + 0.85, z]);
      linea(vs, "#00E676", Math.max(1.5, S * 0.05), 0.35);
    }
  }

  /* ── Meta: damero + pórtico ── */
  function meta(frente = false) {
    const largo = curso.largo, y = h(largo);
    if (frente) { linea([[largo, y, 7.6], [largo, y + 4.2, 7.6]], "#00E676", Math.max(3, S * 0.1), 0.85); return; }
    for (let z = -1.3, k = 0; z < 7.6; z += 0.45, k++) {
      poligono([[largo, y, z], [largo + 0.5, h(largo + 0.5), z], [largo + 0.5, h(largo + 0.5), z + 0.45], [largo, y, z + 0.45]],
        k % 2 ? "#00E676" : "#0F1210", k % 2 ? 0.5 : 1);
    }
    linea([[largo, y, -1.3], [largo, y + 4.2, -1.3]], "#00E676", Math.max(3, S * 0.1), 0.85);
    poligono([[largo, y + 4.2, -1.3], [largo, y + 3.5, -1.3], [largo, y + 3.5, 7.6], [largo, y + 4.2, 7.6]], "#00E676", 0.92);
    const q = p(largo, y + 3.78, 3);
    c.font = `650 ${Math.max(11, S * 0.34)}px Archivo, sans-serif`;
    c.fillStyle = "#00220F"; c.textAlign = "center";
    c.fillText("META", q.x, q.y + S * 0.18);
    c.textAlign = "left";
  }

  /* ── Obstáculos ── */
  /* La forma es la que informa: el de saltar es una valla baja y el de
     agacharse un travesaño por encima de la cabeza. Sin código de color,
     que los colores ya están ocupados por los carriles. */
  function obstaculo(o, z, tirado) {
    const y = h(o.x), za = z - 0.8, zb = z + 0.8;
    const alto = o.tipo === "salto" ? 0.95 : 2.5;
    const poste = Math.max(2, S * 0.05);
    linea([[o.x, y, za], [o.x, y + alto, za]], "#2A332C", poste);
    linea([[o.x, y, zb], [o.x, y + alto, zb]], "#2A332C", poste);
    if (tirado && o.tipo === "salto") {
      linea([[o.x + 0.9, y + 0.06, za], [o.x + 0.9, y + 0.06, zb]], "#3C4A40", Math.max(2.5, S * 0.06));
    } else {
      linea([[o.x, y + alto, za], [o.x, y + alto, zb]],
            tirado ? "#3C4A40" : "#8A938C", Math.max(2.5, S * 0.07), tirado ? 0.6 : 0.95);
    }
  }

  /* ── El caballo del participante ── */
  function caballo(corredor, z, t, carrera) {
    const d = corredor.dibujo;
    if (!d || !d.trazos.length) return;

    const x = corredor.distancia;
    // Tropezado: se va de morros y se hunde un poco. Sin esto el castigo
    // de la valla es un número en la tabla y no se entiende mirando.
    const trastabilla = corredor.tropiezo > 0 ? Math.min(1, corredor.tropiezo / 0.6) : 0;
    // Salto: arco de seno. Agache: se aplasta y baja un poco.
    const enAire = corredor.salto > 0 ? Math.sin((1 - corredor.salto / SALTO_AIRE) * Math.PI) : 0;
    const agachado = corredor.agache > 0 ? Math.sin((1 - corredor.agache / AGACHE_DURA) * Math.PI) : 0;
    const suelo = h(x) - trastabilla * 0.18 + enAire * 1.75 - agachado * 0.12;
    // En la cuesta el caballo se inclina con el terreno: sin esto parece
    // que flota sobre la loma en vez de subirla.
    // Con la pendiente real y no con la comprimida: la inclinación es la
    // señal de que se está subiendo, y a media escala casi no se nota.
    const th = Math.atan(pendiente(curso, x)) - trastabilla * 0.42;
    const cs = Math.cos(th), sn = Math.sin(th);

    const ancho = Math.min(4.2, 2.4 * d.aspecto);
    const alto = ancho / d.aspecto;
    const corriendo = corredor.meta === null && corredor.tropiezo <= 0 && !menosMovimiento;
    const zancada = corriendo ? t * 11 + z * 0.7 : 0;
    const vaiven = corriendo ? Math.sin(zancada * 2) * 0.045 : 0;
    const energia = Math.min(1, corredor.impulso / 2.2);

    /** Lleva un punto local del dibujo al mundo, ya inclinado por la cuesta. */
    const alMundo = (lx, ly) => p(x + lx * cs - ly * sn, suelo + lx * sn + ly * cs, z);

    // Sombra pegada al suelo
    const sombra = [];
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2;
      const sx = x + Math.cos(a) * ancho * 0.44;
      sombra.push([sx, h(sx), z + Math.sin(a) * 0.26]);
    }
    poligono(sombra, "#000000", 0.5);

    // Estela de velocidad
    if (energia > 0.25 && corriendo) {
      for (let k = 0; k < 4; k++) {
        const q0 = alMundo(-ancho * 0.6 - k * 0.5, 0.3 + k * 0.22);
        c.globalAlpha = energia * (0.5 - k * 0.1);
        c.strokeStyle = corredor.color; c.lineWidth = 2;
        c.beginPath(); c.moveTo(q0.x - 16 - k * 6, q0.y); c.lineTo(q0.x, q0.y); c.stroke();
        c.globalAlpha = 1;
      }
    }

    // Trazos con las patas en movimiento
    const grosor = Math.max(2, S * 0.055);
    c.globalAlpha = corredor.esFantasma ? 0.72 : corredor.esBot ? 0.5 : 1;
    c.lineCap = "round"; c.lineJoin = "round";
    c.shadowColor = corredor.color;
    c.shadowBlur = 10 + energia * 22;

    for (const trazo of d.trazos) {
      if (trazo.puntos.length < 2) continue;
      const puntos = trazo.puntos.map(v => {
        const pata = Math.max(0, (v.y - LINEA_PATAS) / (1 - LINEA_PATAS));
        const grupo = Math.min(GRUPOS - 1, Math.max(0, Math.floor((v.x + 0.5) * GRUPOS)));
        const fase = zancada + grupo * Math.PI * 0.85;
        const balanceo = corriendo ? Math.sin(fase) * pata * ancho * 0.058 : 0;
        const levante = corriendo ? Math.max(0, Math.cos(fase)) * pata * 0.10 : 0;
        const inclina = corriendo ? Math.sin(zancada) * 0.018 * (1 - v.y) : 0;
        const altoLocal = ((1 - v.y) * alto + vaiven + levante) * (1 - 0.42 * agachado);
        return alMundo(v.x * ancho + balanceo + inclina, altoLocal);
      });

      c.beginPath();
      puntos.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y));

      // Si el trazo cierra, se rellena: da cuerpo sin pedirle nada al dibujante
      const a = puntos[0], b = puntos[puntos.length - 1];
      if (puntos.length > 8 && Math.hypot(a.x - b.x, a.y - b.y) < 6) {
        c.fillStyle = "rgba(255,255,255,.05)"; c.fill();
      }
      // El color del carril manda: si mandara la tinta del dibujo, dos
      // jinetes podrian salir del mismo color y nadie se encontraria.
      c.strokeStyle = corredor.color;
      c.lineWidth = grosor;
      c.stroke();
    }
    c.shadowBlur = 0;
    c.globalAlpha = 1;

    // Polvo bajo los cascos
    if (corriendo && energia > 0.15 && Math.random() < energia * 0.6) {
      polvo.push({ x: x - ancho * 0.4, z: z + (Math.random() - 0.5) * 0.4, y: suelo + 0.05, vida: 1 });
    }

    // Nombre
    // Escalonadas por carril: en la salida los cuatro se superponen y,
    // sin esto, los nombres se imprimen unos sobre otros.
    const q = alMundo(0, alto + 0.55 + (z / 2) * 0.42);
    c.font = `600 ${Math.max(11, S * 0.34)}px Archivo, sans-serif`;
    c.textAlign = "center";
    c.fillStyle = corredor.color;
    c.fillText(corredor.nombre.toUpperCase(), q.x, q.y, Math.min(190, W * 0.3));
    c.textAlign = "left";

    // Qué botón toca. Es lo único que el jinete no puede adivinar mirando.
    const prox = corredor.teclas ? avisoObstaculo(carrera, corredor) : null;
    if (prox) {
      const tecla = prox.tipo === "salto" ? corredor.teclas.saltar : corredor.teclas.agachar;
      const a = alMundo(0, alto + 1.35 + (z / 2) * 0.42);
      // Mientras falta, el aviso es tenue; cuando toca, se enciende
      c.font = `700 ${Math.max(14, S * (prox.listo ? 0.72 : 0.5))}px Archivo, sans-serif`;
      c.textAlign = "center";
      c.fillStyle = corredor.color;
      c.globalAlpha = prox.listo ? 1 : 0.42;
      c.shadowColor = corredor.color; c.shadowBlur = prox.listo ? 24 : 0;
      c.fillText(`${ACCIONES[prox.tipo].flecha} ${(tecla || "").toUpperCase()}`, a.x, a.y);
      c.shadowBlur = 0; c.globalAlpha = 1;
      c.textAlign = "left";
    }

    // Bandera de llegada
    if (corredor.meta !== null) {
      const f = alMundo(0, alto + 1.25);
      c.font = `550 ${Math.max(10, S * 0.30)}px Archivo, sans-serif`;
      c.fillStyle = "#00E676"; c.textAlign = "center";
      c.fillText(`${corredor.meta.toFixed(2)}s`, f.x, f.y);
      c.textAlign = "left";
    }
  }

  /**
   * Quien se queda muy atrás se sale del cuadro. En vez de desaparecer,
   * deja una marca en el borde: el que va último tiene que poder
   * encontrarse en la pantalla, o deja de jugar.
   */
  function rezagados(carrera) {
    CARRILES.forEach((z, i) => {
      const r = carrera.corredores[i];
      if (!r) return;
      const q = p(r.distancia, h(r.distancia), z);
      if (q.x > 26) return;
      const y = Math.max(28, Math.min(H - 28, q.y));
      c.fillStyle = r.color;
      c.beginPath();
      c.moveTo(8, y); c.lineTo(20, y - 6); c.lineTo(20, y + 6);
      c.closePath(); c.fill();
      c.font = `600 ${Math.max(10, S * 0.30)}px Archivo, sans-serif`;
      c.textAlign = "left";
      c.fillText(`${r.nombre.toUpperCase()}  −${Math.round(cam - r.distancia)}m`, 26, y + 4);
    });
  }

  function dibujarPolvo(dt) {
    for (let i = polvo.length - 1; i >= 0; i--) {
      const g = polvo[i];
      g.vida -= dt * 1.6; g.y += dt * 0.5; g.x -= dt * 1.2;
      if (g.vida <= 0) { polvo.splice(i, 1); continue; }
      const q = p(g.x, g.y, g.z);
      c.globalAlpha = g.vida * 0.3;
      c.fillStyle = "#00E676";
      c.beginPath(); c.arc(q.x, q.y, Math.max(1, S * 0.05 * g.vida), 0, 6.28); c.fill();
      c.globalAlpha = 1;
    }
  }

  return {
    render(carrera, cursoActual, dt = 1 / 60) {
      curso = cursoActual;
      medir();
      if (ultimaCarrera !== carrera) {
        ultimaCarrera = carrera; cam = 0; polvo.length = 0;
      }

      // La cámara sigue al grupo, no a un jugador: son cuatro humanos.
      const ds = carrera.corredores.map(r => r.distancia);
      const lider = Math.max(...ds), farol = Math.min(...ds);
      // Se sigue al último humano, no al pelotón: si la máquina se escapa,
      // la pantalla tiene que seguir enseñando a quien vino a jugar.
      const humanos = carrera.corredores.filter(r => !r.esBot && !r.esFantasma);
      const ancla = humanos.length ? Math.min(...humanos.map(r => r.distancia)) : farol;
      const objetivo = lider * 0.42 + ancla * 0.58;
      const mezcla = menosMovimiento ? 1 : 1 - Math.exp(-dt * 6);
      cam += (objetivo - cam) * mezcla;

      // Si se abre el pelotón, se aleja el plano hasta donde sigue siendo legible
      const necesario = Math.max(20, lider - farol + 14);
      S *= Math.max(0.46, Math.min(1, 26 / necesario));

      // El encuadre sigue al terreno solo a medias, y eso es deliberado:
      // compensando del todo, el jinete se queda clavado a la misma altura
      // de pantalla y coronar la cuesta se ve exactamente igual que el
      // llano. Dejando pasar parte, el caballo SUBE dentro del cuadro y
      // ahí es donde se entiende que hay una cuesta.
      oy = H * (W < 820 ? 0.56 : 0.58) + h(cam) * S * 0.55;

      const desde = Math.max(-6, cam - 40), hasta = Math.min(curso.largo + 14, cam + 55);

      c.clearRect(0, 0, W, H);
      fondo();
      pista(desde, hasta);
      meta();
      CARRILES.forEach((z, i) => {
        const r = carrera.corredores[i];
        if (!r) return;
        // Las vallas de este carril van detrás de su jinete, no de todos
        if (curso.obstaculos) {
          for (const o of curso.obstaculos) {
            if (o.x < desde || o.x > hasta) continue;
            obstaculo(o, z, r.tiradas?.includes(o.x));
          }
        }
        caballo(r, z, carrera.t, carrera);
      });
      dibujarPolvo(dt);
      meta(true);
      rezagados(carrera);
    }
  };
}
