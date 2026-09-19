/* ═══════════════════════════════════════════════════
   EL MANDO — lo que corre en el celular del participante
   ═══════════════════════════════════════════════════
   El celular no simula nada: dibuja, y manda pulsaciones. Toda la carrera
   vive en la mesa, en un solo sitio, que es lo que garantiza que los cuatro
   jinetes vean exactamente la misma carrera y que nadie pueda hacer trampa
   adelantando su propio reloj.
*/

import { crearTablero, caballoDeMuestra } from "./draw.js";
import { normalizar, miniatura } from "./scene.js";
import { crearHero } from "./hero.js";

const $ = s => document.querySelector(s);
const CARRILES = ["#00E676", "#FF6200", "#22D3EE", "#E879F9"];

const estado = { ws: null, carril: null, sala: null, ficha: null, fase: "entrar", reintentos: 0 };

// Animación de portada: un corredor de muestra trotando mientras se registra.
const heroEntrada = crearHero($("#m-hero"), normalizar(caballoDeMuestra()));
heroEntrada.arrancar();
window.addEventListener("resize", () => heroEntrada.remedir(), { passive: true });

const ir = p => {
  estado.fase = p;
  document.querySelectorAll(".m-pantalla").forEach(s => s.classList.toggle("es-activa", s.id === `m-${p}`));
};

const avisar = texto => {
  const caja = $("#m-estado");
  caja.hidden = !texto;
  caja.textContent = texto || "";
};

/* ═════════ Conexión ═════════ */

function conectar(alAbrir) {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${proto}//${location.host}/ws`);
  estado.ws = ws;

  ws.addEventListener("open", () => { avisar(""); estado.reintentos = 0; alAbrir?.(); });
  ws.addEventListener("message", e => { try { recibir(JSON.parse(e.data)); } catch { /* ruido */ } });
  ws.addEventListener("close", () => {
    if (estado.fase === "entrar") return;
    avisar("Se perdió la conexión. Reintentando…");
    // El WiFi de una feria se cae; el mando tiene que volver solo
    const espera = Math.min(4000, 400 * 2 ** estado.reintentos++);
    setTimeout(() => conectar(() => { if (estado.ficha) enviar({ t: "unirse", ...estado.ficha }); }), espera);
  });
  ws.addEventListener("error", () => ws.close());
}

function enviar(obj) {
  if (estado.ws?.readyState === WebSocket.OPEN) estado.ws.send(JSON.stringify(obj));
}

function recibir(m) {
  if (m.t === "error") {
    if (estado.fase === "entrar") { $("#m-error").textContent = m.msg; }
    else avisar(m.msg);
    return;
  }

  if (m.t === "bienvenida") {
    estado.carril = m.carril;
    const color = CARRILES[m.carril];
    document.documentElement.style.setProperty("--carril", color);
    $("#m-carril-1").textContent = m.carril + 1;
    $("#m-quien").textContent = estado.ficha?.nombre || "";
    avisar("");
    ir("dibujo");
    requestAnimationFrame(() => tablero.medir());
    return;
  }

  if (m.t === "fase") {
    if (m.fase === "dibujo") { ir("dibujo"); requestAnimationFrame(() => tablero.medir()); }
    else if (m.fase === "parrilla" || m.fase === "cuenta") {
      $("#m-espera-titulo").innerHTML = m.fase === "cuenta" ? "Ya casi<em>.</em>" : "Listo<em>.</em>";
      $("#m-espera-sub").textContent = m.fase === "cuenta" ? "Prepare el pulgar." : "Faltan los demás. Mire la pantalla grande.";
      ir("espera");
    }
    else if (m.fase === "carrera") { prepararJuego(m.curso); ir("juego"); }
    else if (m.fase === "acta" || m.fase === "fin") { ir("fin"); }
    return;
  }

  if (m.t === "marcador") pintarMarcador(m);
}

/* ═════════ Entrar ═════════ */

const TELEFONO_OK = t => (t.match(/\d/g) || []).length >= 8;
const CORREO_OK = c => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c);

// El código puede venir en el QR: ?s=ABCD — si vino solo, no hace falta mostrarlo
const desdeURL = new URLSearchParams(location.search).get("s");
if (desdeURL) {
  $("#m-sala").value = desdeURL.toUpperCase().slice(0, 4);
  $("#m-campo-sala").setAttribute("data-oculto", "");
}

$("#m-ficha").addEventListener("submit", e => {
  e.preventDefault();
  const err = $("#m-error");
  const sala = $("#m-sala").value.trim().toUpperCase();
  const nombre = $("#m-nombre").value.trim();
  const telLocal = $("#m-tel").value.trim();
  const telefono = "+506 " + telLocal;
  const correo = $("#m-correo").value.trim();

  if (sala.length !== 4) { err.textContent = "El código de la sala son cuatro letras."; return; }
  if (nombre.length < 2) { err.textContent = "Escriba su nombre."; return; }
  if (!TELEFONO_OK(telLocal)) { err.textContent = "Escriba un WhatsApp válido: al menos ocho dígitos."; return; }
  if (!CORREO_OK(correo)) { err.textContent = "Escriba un correo válido, con arroba y dominio."; return; }
  if (!$("#m-consent").checked) { err.textContent = "Hay que marcar la autorización para poder correr."; return; }

  err.textContent = "";
  estado.ficha = { sala, nombre, telefono, correo };
  $("#m-entrar-btn").disabled = true;
  conectar(() => {
    enviar({ t: "unirse", ...estado.ficha });
    $("#m-entrar-btn").disabled = false;
  });
});

/* ═════════ Dibujo ═════════ */

const tablero = crearTablero($("#m-pad"), vacio => {
  $("#m-pad-vacio").toggleAttribute("data-oculto", !vacio);
  $("#m-listo").disabled = vacio;
});
$("#m-listo").disabled = true;

$("#m-deshacer").addEventListener("click", () => tablero.deshacer());
$("#m-limpiar").addEventListener("click", () => tablero.limpiar());
$("#m-prestar").addEventListener("click", () => {
  if (!tablero.vacio() && !confirm("Esto reemplaza lo que ya dibujó. ¿Sigo?")) return;
  tablero.prestar();
});

$("#m-listo").addEventListener("click", () => {
  if (tablero.vacio()) return;
  const trazos = tablero.trazos();
  enviar({ t: "dibujo", trazos });
  enviar({ t: "listo" });
  const cv = $("#m-mini");
  cv.width = 360; cv.height = 240;
  miniatura(cv.getContext("2d"), normalizar(trazos), 360, 240, CARRILES[estado.carril] || "#00E676", 5);
  $("#m-espera-titulo").innerHTML = "Listo<em>.</em>";
  $("#m-espera-sub").textContent = "Faltan los demás. Mire la pantalla grande.";
  ir("espera");
});

/* ═════════ Mando de carrera ═════════ */

const bSalto = $("#m-salto"), bCorrer = $("#m-correr"), bAgache = $("#m-agache");

function prepararJuego(curso) {
  const conObstaculos = !!curso?.obstaculos;
  bSalto.hidden = !conObstaculos;
  bAgache.hidden = !conObstaculos;
  bSalto.style.display = conObstaculos ? "" : "none";
  bAgache.style.display = conObstaculos ? "" : "none";
  $("#m-pista").textContent = conObstaculos
    ? "Cuando se encienda un botón, tóquelo"
    : "Ritmo constante gana";
  $("#m-puesto").textContent = "–";
  $("#m-metros").textContent = "";
}

function pintarMarcador(m) {
  if (m.puesto != null) $("#m-puesto").textContent = `${m.puesto}.º`;
  $("#m-metros").textContent = m.meta != null ? `${m.meta.toFixed(2)} s` : `${Math.round(m.distancia || 0)} m`;
  for (const [b, tipo] of [[bSalto, "salto"], [bAgache, "agache"]]) {
    const activo = m.aviso && m.aviso.tipo === tipo;
    b.toggleAttribute("data-pronto", !!activo);
    b.toggleAttribute("data-ya", !!(activo && m.aviso.listo));
  }
}

/* Vibración corta como acuse: en una feria con ruido, el pulgar no oye nada. */
const zumbar = ms => { try { navigator.vibrate?.(ms); } catch { /* sin motor */ } };

function acción(tipo, boton) {
  enviar({ t: "accion", a: tipo });
  zumbar(tipo === "correr" ? 8 : 18);
  boton.style.transform = "scale(.97)";
  setTimeout(() => { boton.style.transform = ""; }, 60);
}

/* pointerdown y no click: el click de un móvil llega tarde, y esto es ritmo */
for (const [b, tipo] of [[bCorrer, "correr"], [bSalto, "salto"], [bAgache, "agache"]]) {
  b.addEventListener("pointerdown", e => { e.preventDefault(); acción(tipo, b); });
  b.addEventListener("contextmenu", e => e.preventDefault());
}

$("#m-otra").addEventListener("click", () => location.reload());

/* La pantalla no se puede apagar a media carrera */
let candado = null;
async function mantenerDespierta() {
  try { candado = await navigator.wakeLock?.request("screen"); } catch { /* sin permiso */ }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !candado) mantenerDespierta();
});
mantenerDespierta();

window.addEventListener("resize", () => { if (estado.fase === "dibujo") tablero.medir(); });
