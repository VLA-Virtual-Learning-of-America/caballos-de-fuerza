/* ═══════════════════════════════════════════════════
   VERIFICADOR — el candado del proyecto
   ═══════════════════════════════════════════════════
   Uso:  node verificar.js      (o  npm run verificar)

   Hace dos cosas:

   1. Compara el hash de los archivos CONGELADOS con blindaje.json.
      Si alguien tocó la física o la perspectiva, esto falla.

   2. Corre la carrera de verdad, sin interfaz, y comprueba que los
      tiempos medidos siguen siendo los de siempre. Esto es lo que de
      verdad protege la experiencia: aunque alguien reescriba el motor
      entero, si el juego deja de sentirse igual, falla aquí.

   Es un cable trampa, no una caja fuerte: quien quiera puede editar
   blindaje.json y los números de abajo. Sirve para que nadie rompa el
   juego SIN DARSE CUENTA, que es como se rompen estas cosas.
*/

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const RAIZ = import.meta.dirname;
const hash = f => crypto.createHash("sha256")
  .update(fs.readFileSync(path.join(RAIZ, f))).digest("hex").slice(0, 16);

const CONGELADOS = ["src/race.js", "src/cursos.js", "src/scene.js", "src/hero.js"];
const PROTEGIDOS = ["index.html", "style.css", "src/app.js", "src/draw.js",
                    "src/poster.js", "src/store.js", "PRODUCT.md", "DESIGN.md"];

let fallos = 0, avisos = 0;
const ok = t => console.log(`  \x1b[32m✓\x1b[0m ${t}`);
const mal = t => { fallos++; console.log(`  \x1b[31m✗\x1b[0m ${t}`); };
const ojo = t => { avisos++; console.log(`  \x1b[33m!\x1b[0m ${t}`); };

function cerca(valor, esperado, tolerancia, etiqueta) {
  const d = Math.abs(valor - esperado);
  if (d <= tolerancia) ok(`${etiqueta}: ${valor.toFixed(2)} (esperado ${esperado} ±${tolerancia})`);
  else mal(`${etiqueta}: ${valor.toFixed(2)}, se esperaba ${esperado} ±${tolerancia}`);
}

/* ═════════ 1. Integridad ═════════ */

console.log("\n\x1b[1mCaballos de Fuerza — verificación\x1b[0m\n");
console.log("\x1b[1mArchivos congelados\x1b[0m (física y perspectiva)");

let blindaje = {};
try { blindaje = JSON.parse(fs.readFileSync(path.join(RAIZ, "blindaje.json"), "utf8")); }
catch { mal("Falta blindaje.json. Sin él no se puede comprobar nada."); }

for (const f of CONGELADOS) {
  const actual = hash(f);
  if (!blindaje[f]) ojo(`${f} no está registrado en blindaje.json`);
  else if (blindaje[f] === actual) ok(`${f} intacto`);
  else mal(`${f} FUE MODIFICADO. Esta zona está congelada: ver HANDOFF.md`);
}

console.log("\n\x1b[1mArchivos protegidos\x1b[0m (diseño y recorrido)");
let tocados = 0;
for (const f of PROTEGIDOS) {
  if (blindaje[f] && blindaje[f] !== hash(f)) { tocados++; ojo(`${f} cambió: requiere aprobación de VLA`); }
}
if (!tocados) ok("sin cambios");

/* ═════════ 2. El juego sigue sintiéndose igual ═════════ */

const { CURSOS, cursoPorId } = await import("./src/cursos.js");
const R = await import("./src/race.js");

const DIBUJO = { aspecto: 1.7, trazos: [{ puntos: [{ x: -.4, y: .2 }, { x: .4, y: .9 }] }] };
const TECLAS = { correr: "a", saltar: "q", agachar: "z" };

/** Corre una carrera de un solo jinete con una cadencia fija. */
function correr(cursoId, cadencia, { obstaculos = "acierta", dt = 1 / 120 } = {}) {
  const curso = cursoPorId(cursoId);
  const c = R.crearCarrera([{ nombre: "P", color: "#0E6", dibujo: DIBUJO, teclas: TECLAS }], curso);
  c.corriendo = true;
  const r = c.corredores[0];
  let prox = 0.1;
  while (!c.terminada) {
    prox -= dt;
    if (prox <= 0) { R.gritar(c, 0); prox = cadencia; }
    if (curso.obstaculos && obstaculos !== "nada" && r.salto <= 0 && r.agache <= 0) {
      const o = curso.obstaculos.find(o => o.x > r.distancia);
      if (o) {
        const vel = 5.6 + r.impulso;
        const disparo = o.tipo === "salto" ? vel * R.SALTO_AIRE * 0.52 : vel * R.AGACHE_DURA * 0.42;
        if (o.x - r.distancia <= disparo) {
          const tipo = obstaculos === "alreves" ? (o.tipo === "salto" ? "agache" : "salto") : o.tipo;
          R.accionar(c, 0, tipo);
        }
      }
    }
    R.avanzar(c, dt);
  }
  return r;
}

console.log("\n\x1b[1mEl dibujo no puede dar ventaja\x1b[0m");
{
  const curso = cursoPorId("llano");
  const feo = { aspecto: 0.4, trazos: [{ puntos: [{ x: 0, y: 0 }, { x: .1, y: 1 }] }] };
  const bonito = { aspecto: 4.5, trazos: Array.from({ length: 30 }, (_, k) =>
    ({ puntos: Array.from({ length: 40 }, (_, i) => ({ x: (i / 40) - .5, y: ((i * k) % 40) / 40 })) })) };
  const c = R.crearCarrera([
    { nombre: "Feo", color: "#0E6", dibujo: feo, teclas: TECLAS },
    { nombre: "Bonito", color: "#F60", dibujo: bonito, teclas: TECLAS }
  ], curso);
  c.corriendo = true;
  let prox = 0.1;
  const dt = 1 / 120;
  while (!c.terminada) {
    prox -= dt;
    if (prox <= 0) { R.gritar(c, 0); R.gritar(c, 1); prox = 0.26; }
    R.avanzar(c, dt);
  }
  const d = Math.abs(c.corredores[0].meta - c.corredores[1].meta);
  if (d < 0.01) ok(`un garabato y un dibujo elaborado llegan igual (${d.toFixed(4)} s de diferencia)`);
  else mal(`el dibujo está afectando la velocidad: ${d.toFixed(3)} s de diferencia`);
}

console.log("\n\x1b[1mTiempos de las tres carreras\x1b[0m");
cerca(correr("llano", 0.20).meta, 10.8, 0.25, "100 llanos, metrónomo");
cerca(correr("llano", 0.26).meta, 11.6, 0.25, "100 llanos, cadencia buena");
cerca(correr("llano", 0.33).meta, 12.5, 0.30, "100 llanos, cadencia floja");
cerca(correr("llano", 99).meta, 17.6, 0.30, "100 llanos, sin tocar el botón");
cerca(correr("subida", 0.20).meta, 22.7, 0.40, "La subida, metrónomo");
cerca(correr("subida", 99).meta, 33.4, 0.50, "La subida, sin tocar el botón");
cerca(correr("obstaculos", 0.26).meta, 16.75, 0.40, "Obstáculos, pasándolos todos");
cerca(correr("obstaculos", 0.26, { obstaculos: "nada" }).meta, 22.4, 0.50, "Obstáculos, sin saltar ni agacharse");

console.log("\n\x1b[1mReglas de diseño del juego\x1b[0m");
{
  const bien = correr("obstaculos", 0.26).meta;
  const nada = correr("obstaculos", 0.26, { obstaculos: "nada" }).meta;
  const mal2 = correr("obstaculos", 0.26, { obstaculos: "alreves" }).meta;
  if (mal2 > nada) ok(`equivocarse de botón cuesta más que no hacer nada (${mal2.toFixed(2)} s contra ${nada.toFixed(2)} s)`);
  else mal("hacer la acción contraria tiene que costar MÁS que no hacer nada");
  if (nada - bien > 4) ok(`saltar y agacharse deciden la carrera (${(nada - bien).toFixed(2)} s de diferencia)`);
  else mal("las dos mecánicas nuevas casi no cambian el resultado");
  const limpio = correr("obstaculos", 0.26);
  if (limpio.fallos === 0 && limpio.limpios === 6) ok("los seis obstáculos se pueden pasar limpios");
  else mal(`jugando bien deberían salir 6 limpios y salen ${limpio.limpios}`);
}

{
  // La cuesta tiene que JUNTAR al pelotón, no reventarlo
  const curso = cursoPorId("subida");
  const c = R.crearCarrera([
    { nombre: "A", color: "#0E6", dibujo: DIBUJO, teclas: TECLAS },
    { nombre: "B", color: "#F60", dibujo: DIBUJO, teclas: TECLAS }
  ], curso);
  c.corriendo = true;
  const dt = 1 / 120, prox = [0.1, 0.1], cad = [0.21, 0.33];
  let alPie = null, enCima = null;
  while (!c.terminada) {
    for (let i = 0; i < 2; i++) { prox[i] -= dt; if (prox[i] <= 0) { R.gritar(c, i); prox[i] = cad[i]; } }
    R.avanzar(c, dt);
    const d = c.corredores[0].distancia - c.corredores[1].distancia;
    if (alPie === null && c.corredores[0].distancia >= 58) alPie = d;
    if (enCima === null && c.corredores[0].distancia >= 112) enCima = d;
  }
  if (enCima !== null && enCima < alPie * 1.6)
    ok(`la cuesta iguala: ${alPie.toFixed(1)} m al pie → ${enCima.toFixed(1)} m en la cima`);
  else mal(`la cuesta está abriendo la carrera (${alPie?.toFixed(1)} m → ${enCima?.toFixed(1)} m). Debe juntar al pelotón.`);
}

{
  // Ventanas de acierto: por debajo de medio segundo no es jugable de pie
  const curso = cursoPorId("obstaculos");
  const ventana = tipo => {
    const oks = [];
    for (let a = 0.02; a <= 1.4; a += 0.02) {
      const c = R.crearCarrera([{ nombre: "P", color: "#0E6", dibujo: DIBUJO, teclas: TECLAS }], curso);
      c.corriendo = true;
      const r = c.corredores[0], obj = curso.obstaculos.find(o => o.tipo === tipo);
      let prox = 0.1, hecho = false;
      const dt = 1 / 240;
      while (r.distancia < obj.x + 2 && !c.terminada) {
        prox -= dt; if (prox <= 0) { R.gritar(c, 0); prox = 0.26; }
        if (!hecho && (obj.x - r.distancia) / (5.6 + r.impulso) <= a) { R.accionar(c, 0, tipo); hecho = true; }
        R.avanzar(c, dt);
      }
      if (r.limpios > 0) oks.push(a);
    }
    return oks.length ? oks[oks.length - 1] - oks[0] : 0;
  };
  for (const [tipo, etiqueta] of [["salto", "saltar"], ["agache", "agacharse"]]) {
    const v = ventana(tipo);
    if (v >= 0.45) ok(`ventana para ${etiqueta}: ${v.toFixed(2)} s`);
    else mal(`ventana para ${etiqueta} de solo ${v.toFixed(2)} s: por debajo de 0,45 s no es jugable en una feria`);
  }
}

console.log("\n\x1b[1mLos fantasmas repiten la carrera de verdad\x1b[0m");
for (const cursoId of ["llano", "subida", "obstaculos"]) {
  const orig = correr(cursoId, 0.26);
  const c = R.crearCarrera([{
    nombre: "F", color: "#888", dibujo: DIBUJO,
    esFantasma: true, gritos: orig.registro, acciones: orig.registroAcciones
  }], cursoPorId(cursoId));
  c.corriendo = true;
  while (!c.terminada) R.avanzar(c, 1 / 60);     // a la mitad de cuadros, a propósito
  const f = c.corredores[0];
  const d = Math.abs(f.meta - orig.meta);
  const mismos = f.fallos === orig.fallos;
  if (d < 0.15 && mismos) ok(`${cursoId}: ${d.toFixed(3)} s de desvío, mismos tropiezos`);
  else mal(`${cursoId}: el fantasma no reproduce la carrera (${d.toFixed(3)} s, tropiezos ${f.fallos} contra ${orig.fallos})`);
}

console.log("\n\x1b[1mPerspectiva\x1b[0m");
{
  const escena = fs.readFileSync(path.join(RAIZ, "src/scene.js"), "utf8");
  const esperadas = ["profundidad: 0.022", "fuga: 0.0015", "avanceX: 0.96",
                     "sesgoZ: 0.72", "subidaX: 0.16", "bajadaZ: 0.56", "ESCALA_ALTURA = 0.5"];
  const faltan = esperadas.filter(e => !escena.includes(e));
  if (!faltan.length) ok("las constantes de proyección siguen siendo las originales");
  else mal(`cambiaron constantes de perspectiva: ${faltan.join(", ")}`);
}

/* ═════════ Resultado ═════════ */

console.log("");
if (fallos) {
  console.log(`[31m[1m  ${fallos} ${fallos === 1 ? "comprobación fallida" : "comprobaciones fallidas"}.[0m`);
  console.log("  Lea HANDOFF.md antes de seguir. La física y la perspectiva están congeladas.\n");
  process.exit(1);
}
console.log(`\x1b[32m\x1b[1m  Todo en orden.\x1b[0m${avisos ? `  (${avisos} aviso${avisos === 1 ? "" : "s"})` : ""}\n`);
