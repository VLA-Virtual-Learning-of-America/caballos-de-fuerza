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
import { CARRERAS, carreraPorId, NOTA_SALARIOS } from "./carreras.js";
import { stickerPorCodigo } from "./stickers.js";
import { EVENTO, premioPorPuesto, linkWhatsApp, mensajePremio, mensajeWebinar } from "./config.js";

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
    if (["entrar", "sala", "volver", "fin"].includes(estado.fase)) { avisar("Sin conexión. Puede volver a intentar entrar."); return; }
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
    else if (m.fase === "acta" || m.fase === "fin") { pintarPremio(); ir("fin"); }
    return;
  }

  if (m.t === "marcador") {
    if (m.final || !estado.marcador?.final) estado.marcador = { ...estado.marcador, ...m };
    pintarMarcador(m);
    if (estado.fase === "fin" || m.final) { pintarPremio(); if (m.final) ir("fin"); }
  }
}

/* ═════════ Entrar ═════════ */

const PERFIL = "sr-perfil-v1";
const params = new URLSearchParams(location.search);
const desdeURL = (params.get("s") || "").trim().toUpperCase();
let perfil = {};
try { perfil = JSON.parse(localStorage.getItem(PERFIL)) || {}; } catch { /* almacenamiento restringido */ }
if (typeof perfil !== "object" || Array.isArray(perfil)) perfil = {};
const guardarPerfil = () => { try { localStorage.setItem(PERFIL, JSON.stringify(perfil)); } catch { /* continuar en memoria */ } };
function atribuirURL() {
  if (!params.has("v")) return;
  const v = params.get("v").trim().toUpperCase();
  perfil.voluntario = /^[A-Z0-9_-]{2,20}$/.test(v) ? v : null;
  guardarPerfil();
}
atribuirURL();
const tienePerfil = () => typeof perfil.nombre === "string" && perfil.nombre.trim().length >= 2 &&
  String(perfil.telefono || "").replace(/\D/g, "").length >= 8 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(perfil.correo || "") && carreraPorId(perfil.carrera);
const marca = $("#m-entrar .m-cabecera");
for (const id of ["m-volver", "m-sala", "m-fin"]) $("#" + id).prepend(marca.cloneNode(true));
for (const id of ["m-entrar", "m-fin"]) {
  for (const [clase, d] of [["tl", "M0 5V0h5"], ["tr", "M13 5V0H8"], ["bl", "M0 8v5h5"], ["br", "M13 8v5H8"]]) {
    const tick = document.createElement("span"); tick.className = "tick " + clase;
    tick.setAttribute("aria-hidden", "true");
    tick.innerHTML = '<svg viewBox="0 0 13 13"><path d="' + d + '"/></svg>';
    $("#" + id).append(tick);
  }
}
function filaCarrera(c, seleccionable = false) {
  const fila = document.createElement(seleccionable ? "label" : "div"); fila.className = "route";
  const info = document.createElement("span"); info.className = "route-info";
  const nombre = document.createElement("span"); nombre.className = "route-name";
  if (seleccionable) nombre.innerHTML = '<svg class="check" viewBox="0 0 16 16" aria-hidden="true"><path d="m2 8 4 4 8-9"/></svg>';
  // AIB en stickers.js no es un logo oficial: aquí solo van los tres aprobados.
  const logo = ["CYB", "AWS", "CCNA"].includes(c.sticker) && stickerPorCodigo(c.sticker)?.logo;
  if (logo) { const img = document.createElement("img"); img.className = "cert-logo"; img.src = "./stickers/" + logo; img.alt = ""; nombre.append(img); }
  nombre.append(document.createTextNode(c.nombre));
  const cert = document.createElement("span"); cert.className = "route-sub"; cert.textContent = c.cert;
  info.append(nombre, cert);
  if (!seleccionable) { const uso = document.createElement("span"); uso.className = "route-sub"; uso.textContent = c.aplicacion; info.append(uso); }
  const salario = document.createElement("span"); salario.className = "amount" + (c.salario ? "" : " demand"); salario.textContent = c.salario || c.demanda;
  if (c.salario) { const unidad = document.createElement("span"); unidad.className = "unit"; unidad.textContent = "al mes"; salario.append(unidad); }
  fila.append(info, salario); return fila;
}
for (const c of CARRERAS) {
  const radio = document.createElement("input"); radio.type = "radio"; radio.name = "carrera"; radio.value = c.id;
  radio.id = "ruta-" + c.id; radio.className = "route-radio"; radio.required = true; radio.checked = perfil.carrera === c.id;
  const fila = filaCarrera(c, true); fila.htmlFor = radio.id; fila.classList.toggle("selected", radio.checked);
  radio.addEventListener("change", () => document.querySelectorAll(".route-radio").forEach(r => r.nextElementSibling.classList.toggle("selected", r.checked)));
  $("#m-rutas").append(radio, fila);
}
$("#m-nota").textContent = $("#m-fin-nota").textContent = NOTA_SALARIOS;
$("#m-nombre").value = perfil.nombre || "";
const tel = String(perfil.telefono || "").replace(/\D/g, "");
$("#m-tel").value = tel.length === 11 && tel.startsWith("506") ? tel.slice(3) : tel;
$("#m-correo").value = perfil.correo || "";
$("#m-consent").checked = !!tienePerfil();
$("#m-sala-valor").value = desdeURL;
$("#m-entrar-btn").textContent = desdeURL ? "Entrar a la sala" : "Elegir y continuar";
if (desdeURL && tienePerfil()) {
  $("#m-saludo").textContent = "Hola de nuevo, " + perfil.nombre;
  $("#m-carrera-guardada").textContent = carreraPorId(perfil.carrera).nombre;
  ir("volver");
}
function entrarSala(sala) {
  if (!/^[A-Z]{4}$/.test(sala)) { avisar("El código de la sala son cuatro letras."); return; }
  estado.ficha = { ...perfil, sala, sticker: carreraPorId(perfil.carrera)?.sticker || null };
  estado.sala = sala;
  const url = new URL(location.href); url.searchParams.set("s", sala); history.replaceState(null, "", url);
  avisar("Conectando a la sala…");
  if (estado.ws?.readyState === WebSocket.OPEN) enviar({ t: "unirse", ...estado.ficha });
  else if (estado.ws?.readyState !== WebSocket.CONNECTING) conectar(() => enviar({ t: "unirse", ...estado.ficha }));
}
$("#m-volver-entrar").addEventListener("click", () => entrarSala(desdeURL));
$("#m-no-soy").addEventListener("click", () => {
  perfil = {}; try { localStorage.removeItem(PERFIL); } catch { /* sin storage */ }
  atribuirURL();
  $("#m-ficha").reset(); document.querySelectorAll(".route.selected").forEach(r => r.classList.remove("selected")); avisar(""); ir("entrar");
});
$("#m-elegir-sala").addEventListener("submit", e => { e.preventDefault(); entrarSala($("#m-codigo").value.trim().toUpperCase()); });
$("#m-ficha").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("#m-error"), nombre = $("#m-nombre").value.trim(), correo = $("#m-correo").value.trim();
  let telefono = $("#m-tel").value.replace(/\D/g, "");
  const carrera = $("input[name=carrera]:checked")?.value;
  if (nombre.length < 2) { err.textContent = "Escriba su nombre."; return; }
  if (telefono.length < 8) { err.textContent = "Escriba un WhatsApp válido: al menos ocho dígitos."; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { err.textContent = "Escriba un correo válido, con arroba y dominio."; return; }
  if (!carrera) { err.textContent = "Elegí una carrera para su corredor."; return; }
  if (!$("#m-consent").checked) { err.textContent = "Hay que marcar la autorización para poder correr."; return; }
  if (telefono.length === 8) telefono = "506" + telefono;
  perfil = { nombre, telefono, correo, carrera, voluntario: perfil.voluntario || null }; guardarPerfil();
  err.textContent = ""; $("#m-entrar-btn").disabled = true;
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 4000);
  try { await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...perfil, consiente: true, origen: "mando" }), signal: controller.signal }); }
  catch { /* La mesa recibe la misma ficha en jinete como respaldo. */ }
  finally { clearTimeout(timeout); $("#m-entrar-btn").disabled = false; }
  if (desdeURL) entrarSala(desdeURL); else ir("sala");
});
function pintarPremio() {
  const m = estado.marcador || {}, puesto = Number.isInteger(m.puesto) && m.puesto >= 1 && m.puesto <= 4 ? m.puesto : 4;
  const tiempo = m.tiempo ?? m.meta, c = carreraPorId(perfil.carrera), premio = premioPorPuesto(puesto);
  $("#m-fin-puesto").textContent = puesto + ".º";
  $("#m-fin-tiempo").textContent = Number.isFinite(tiempo) ? tiempo.toFixed(2) + " s" : "";
  $("#m-fin-carrera").replaceChildren(...(c ? [filaCarrera(c)] : []));
  $("#m-premio-titulo").textContent = premio.titulo; $("#m-premio-detalle").textContent = premio.detalle;
  $("#m-reclamar").href = linkWhatsApp(mensajePremio({ nombre: perfil.nombre || "", puesto, carrera: c?.nombre }));
  $("#m-webinar").href = EVENTO.webinar.url || linkWhatsApp(mensajeWebinar({ nombre: perfil.nombre || "" }));
}

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
  estado.marcador = null;
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
