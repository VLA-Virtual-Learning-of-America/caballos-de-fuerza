/* ═══════════════════════════════════════════════════
   MOTOR DE CARRERA — hasta 4 corredores a la vez
   ═══════════════════════════════════════════════════
   Regla de diseño: el dibujo NO afecta la velocidad.
   Todos arrancan iguales y lo único que decide la carrera
   es el ritmo con que cada jinete aporrea su botón.
   Así nadie pierde por no saber dibujar, que es justo
   el público que llega a un stand de feria.

   Un corredor puede ser de tres clases:
     · humano   — aporrea su tecla
     · fantasma — reproduce los gritos grabados de alguien que ya corrió
     · máquina  — se los inventa con una cadencia objetivo

   Los tres pasan por la misma puerta de ritmo. El fantasma no es una
   grabación de vídeo: es la misma simulación alimentada con los tiempos
   exactos de los gritos de esa persona, así que vuelve a correr su
   carrera de verdad.
*/

import {
  CURSOS, pendiente, velocidadEnPendiente, fugaPorPendiente,
  obstaculoCruzado
} from "./cursos.js";

/* Calibración. El trote base es deliberadamente lento: casi toda la
   velocidad tiene que ganarse a golpe de botón, o la carrera termina
   en un empate técnico y nadie siente que compitió.
   En los 100 llanos: sin tocar nada ≈ 17,6 s · cadencia floja ≈ 12,5 s ·
   cadencia de metrónomo ≈ 10,8 s. */
const BASE = 5.6;                  // m/s de trote, igual para todos
const GANANCIA = 0.75;             // impulso por grito
const TOPE = 4.4;                  // techo del impulso acumulado
const FUGA = 1.2;                  // el impulso se escapa como e^(-FUGA·dt)
const ESPERA = 0.18;               // s mínimos entre gritos válidos
const PREMIO_RITMO = 0.40;         // hasta +40% de ganancia por cadencia pareja
const MEMORIA = 5;                 // cuántos intervalos miramos para juzgar el ritmo
const FUGA_TROPIEZO = 2.6;         // lo que se pierde de impulso mientras se tropieza

/* Saltar y agacharse. En oddhoof estos dos obstáculos los resuelve un
   deslizador antes de correr; aquí los resuelve el jinete en marcha, con
   un botón para cada cosa.
   El salto dura fijo, así que a más velocidad se cubre más terreno en el
   aire y la ventana de acierto se cierra: correr rápido vuelve la pista
   más difícil, y esa tensión es el juego.
   Agacharse frena, para que no se pueda ir agachado todo el rato. */
export const SALTO_AIRE = 0.62;           // s en el aire
export const AGACHE_DURA = 0.78;          // s agachado
const AGACHE_FRENO = 0.74;         // la velocidad mientras se va agachado
const ACCION_ENFRIA = 0.22;        // s entre acciones, para que no valga machacar
const CASTIGO_FALLO = 0.90;        // no hizo nada
const CASTIGO_ERROR = 1.25;        // hizo justo la contraria: se estrella

/** Cadencias objetivo de los rivales de la máquina, de mejor a peor.
    A propósito flojas. La máquina solo sale cuando todavía no hay
    corridas grabadas, o sea al abrir el stand: justo con los primeros
    del día, que son los que menos perdonan perder contra un programa.
    Con estas cadencias, cualquiera que agarre un ritmo decente gana. */
const CADENCIA_BOT = [0.33, 0.40, 0.50];

/** Compatibilidad con la primera versión, que solo tenía una pista. */
export const PISTA = 100;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function nuevoCorredor(i, cfg) {
  return {
    i,
    nombre: cfg.nombre,
    color: cfg.color,
    dibujo: cfg.dibujo,
    esBot: !!cfg.esBot,
    esFantasma: !!cfg.esFantasma,
    teclas: cfg.teclas || null,

    // estado vivo
    distancia: 0,
    impulso: 0,
    ultimoGrito: -10,
    gritos: 0,
    intervalos: [],
    ritmo: 0,            // 0..1 — qué tan pareja viene la cadencia
    meta: null,          // segundos al cruzar, o null
    tropiezo: 0,         // segundos que queda frenado por un obstáculo
    salto: 0,            // segundos que le quedan en el aire
    agache: 0,           // segundos que le quedan agachado
    enfriamiento: 0,
    limpios: 0,          // obstáculos pasados bien
    fallos: 0,
    tiradas: [],         // en qué metro quedó cada obstáculo que se llevó por delante
    ultimoTropiezo: -10,

    // la corrida se graba para poder volver como fantasma
    registro: [],        // tiempos de cada pulsación de velocidad
    registroAcciones: [], // {t, k} de cada salto o agache

    // fantasma: la corrida ya está escrita
    guion: cfg.gritos ? [...cfg.gritos] : null,
    proximoDelGuion: 0,
    guionAcciones: cfg.acciones ? [...cfg.acciones] : null,
    proximaAccion: 0,

    // máquina
    proximoGrito: 0.1 + Math.random() * 0.2,
    cadencia: CADENCIA_BOT[i % CADENCIA_BOT.length]
  };
}

export function crearCarrera(configs, curso = CURSOS[0]) {
  return {
    t: 0,
    corriendo: false,
    curso,
    corredores: configs.map((c, i) => nuevoCorredor(i, c)),
    terminada: false
  };
}

/** Qué tan pareja viene la cadencia: 1 = metrónomo, 0 = caos. */
function calcularRitmo(intervalos) {
  if (intervalos.length < 2) return 0;
  const n = intervalos.length;
  const media = intervalos.reduce((a, b) => a + b, 0) / n;
  if (media <= 0) return 0;
  const varianza = intervalos.reduce((a, b) => a + (b - media) ** 2, 0) / n;
  return clamp(1 - Math.sqrt(varianza) / media, 0, 1);
}

/**
 * El grito, una sola vez y para los tres tipos de corredor.
 * Gritar antes de ESPERA no cuenta: es lo que castiga el machaque ciego.
 */
function aplicarGrito(c, cuando) {
  const hueco = cuando - c.ultimoGrito;
  if (hueco < ESPERA) return false;

  if (c.gritos > 0 && hueco < 2) {
    c.intervalos.push(hueco);
    if (c.intervalos.length > MEMORIA) c.intervalos.shift();
  } else {
    c.intervalos.length = 0;
  }
  c.ritmo = calcularRitmo(c.intervalos);
  c.ultimoGrito = cuando;
  c.gritos++;
  c.impulso = Math.min(TOPE, c.impulso + GANANCIA * (1 + PREMIO_RITMO * c.ritmo));
  return true;
}

/** Entrada de los humanos. Devuelve true si el grito contó. */
export function gritar(carrera, i) {
  const c = carrera.corredores[i];
  if (!c || !carrera.corriendo || c.meta !== null) return false;
  if (!aplicarGrito(c, carrera.t)) return false;
  c.registro.push(carrera.t);
  return true;
}

/** Saltar o agacharse, para los tres tipos de corredor. */
function aplicarAccion(c, tipo) {
  if (c.tropiezo > 0 || c.enfriamiento > 0 || c.salto > 0 || c.agache > 0) return false;
  if (tipo === "salto") c.salto = SALTO_AIRE; else c.agache = AGACHE_DURA;
  c.enfriamiento = ACCION_ENFRIA;
  return true;
}

/** Entrada de los humanos para las dos mecánicas de la pista de obstáculos. */
export function accionar(carrera, i, tipo) {
  const c = carrera.corredores[i];
  if (!c || !carrera.corriendo || c.meta !== null) return false;
  if (!carrera.curso.obstaculos) return false;
  if (!aplicarAccion(c, tipo)) return false;
  c.registroAcciones.push({ t: +carrera.t.toFixed(3), k: tipo === "salto" ? "s" : "g" });
  return true;
}

/** Cuándo tiene que lanzarse la máquina para llegar a tiempo al obstáculo. */
function distanciaDeDisparo(tipo, vel) {
  return tipo === "salto" ? vel * SALTO_AIRE * 0.52 : vel * AGACHE_DURA * 0.42;
}

export function avanzar(carrera, dt) {
  if (!carrera.corriendo) return;
  dt = clamp(dt, 0, 0.1);
  const curso = carrera.curso;
  const t0 = carrera.t;
  carrera.t += dt;

  for (const c of carrera.corredores) {
    if (c.meta !== null) continue;

    c.enfriamiento = Math.max(0, c.enfriamiento - dt);
    c.salto = Math.max(0, c.salto - dt);
    c.agache = Math.max(0, c.agache - dt);

    if (c.esFantasma) {
      while (c.guion && c.proximoDelGuion < c.guion.length && c.guion[c.proximoDelGuion] <= carrera.t) {
        aplicarGrito(c, c.guion[c.proximoDelGuion]);
        c.proximoDelGuion++;
      }
      while (c.guionAcciones && c.proximaAccion < c.guionAcciones.length &&
             c.guionAcciones[c.proximaAccion].t <= carrera.t) {
        aplicarAccion(c, c.guionAcciones[c.proximaAccion].k === "s" ? "salto" : "agache");
        c.proximaAccion++;
      }
    } else if (c.esBot) {
      c.proximoGrito -= dt;
      if (c.proximoGrito <= 0) {
        aplicarGrito(c, carrera.t);
        c.proximoGrito = c.cadencia * (0.86 + Math.random() * 0.28);
      }
      // La máquina también salta y se agacha, y también se equivoca: si
      // los pasara todos limpios sería un rival imposible de leer.
      if (curso.obstaculos && c.salto <= 0 && c.agache <= 0 && c.enfriamiento <= 0) {
        const prox = curso.obstaculos.find(o => o.x > c.distancia);
        if (prox && prox.x - c.distancia <= distanciaDeDisparo(prox.tipo, BASE + c.impulso)) {
          const suerte = Math.random();
          if (suerte < 0.80) aplicarAccion(c, prox.tipo);
          else if (suerte > 0.93) aplicarAccion(c, prox.tipo === "salto" ? "agache" : "salto");
        }
      }
    }

    // Tropezado con una valla: se queda clavado y además pierde fuelle
    if (c.tropiezo > 0) {
      c.tropiezo -= dt;
      c.impulso *= Math.exp(-FUGA_TROPIEZO * dt);
      continue;
    }

    const s = pendiente(curso, c.distancia);
    c.impulso *= Math.exp(-FUGA * fugaPorPendiente(s) * dt);
    const vel = velocidadEnPendiente(BASE + c.impulso, s, BASE);

    // Agachado se corre más despacio: si no, bastaría con ir agachado
    // toda la pista y las dos mecánicas se reducirían a una.
    const velReal = c.agache > 0 ? vel * AGACHE_FRENO : vel;

    const antes = c.distancia;
    c.distancia = Math.min(curso.largo, antes + velReal * dt);

    const obst = obstaculoCruzado(curso, antes, c.distancia);
    if (obst) {
      const acertado = obst.tipo === "salto" ? c.salto > 0 : c.agache > 0;
      const alReves = obst.tipo === "salto" ? c.agache > 0 : c.salto > 0;
      if (acertado) {
        c.limpios++;
      } else {
        c.tropiezo = alReves ? CASTIGO_ERROR : CASTIGO_FALLO;
        c.fallos++;
        c.tiradas.push(obst.x);
        c.ultimoTropiezo = carrera.t;
        c.salto = 0; c.agache = 0;
      }
    }

    if (c.distancia >= curso.largo) {
      c.meta = t0 + (curso.largo - antes) / velReal;
      c.impulso = 0;
    }
  }

  if (carrera.corredores.every(c => c.meta !== null) || carrera.t >= curso.limite) {
    carrera.terminada = true;
    carrera.corriendo = false;
  }
}

/** Orden actual: primero los que cruzaron (por tiempo), después por distancia. */
export function clasificacion(carrera) {
  return [...carrera.corredores].sort((a, b) => {
    if (a.meta !== null && b.meta !== null) return a.meta - b.meta;
    if (a.meta !== null) return -1;
    if (b.meta !== null) return 1;
    return b.distancia - a.distancia;
  });
}

/**
 * Qué obstáculo viene y si ya toca pulsar.
 *
 * Sin el «ya toca», esto es un juego de cronometrar: se ve el aviso a
 * quince metros y hay que esperar al último medio segundo. Con él, es un
 * juego de reaccionar, que es lo único que se puede aprender de pie y
 * en un pasillo de feria.
 */
export function avisoObstaculo(carrera, c) {
  const curso = carrera.curso;
  if (!curso.obstaculos || c.meta === undefined || c.meta !== null) return null;
  const o = curso.obstaculos.find(o => o.x > c.distancia);
  if (!o || o.x - c.distancia > curso.aviso) return null;
  const vel = Math.max(1, BASE + c.impulso);
  const falta = (o.x - c.distancia) / vel;
  const dura = o.tipo === "salto" ? SALTO_AIRE : AGACHE_DURA;
  return { tipo: o.tipo, listo: falta <= dura * 0.88 };
}

/** Cuánta energía muestra la barra de ritmo del HUD. */
export const nivelImpulso = c => clamp(c.impulso / TOPE, 0, 1);

/** ¿Acaba de tropezar? Para que la escena lo pueda enseñar. */
export const tropezandoAhora = (carrera, c) =>
  c.tropiezo > 0 || carrera.t - c.ultimoTropiezo < 0.35;
