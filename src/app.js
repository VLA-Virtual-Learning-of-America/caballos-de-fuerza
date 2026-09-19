/* ═══════════════════════════════════════════════════
   CABALLOS DE FUERZA · VLA — orquestador
   ═══════════════════════════════════════════════════
   Experiencia de stand para hasta cuatro participantes en un solo equipo.
   Inicio → qué carrera → cuántos jinetes → dibujo por turnos → parrilla
   → carrera → acta. Sin red, sin cuentas, sin instalar nada.

   Los carriles que sobran se llenan con FANTASMAS: corridas grabadas de
   gente que ya pasó por el stand. Solo si todavía no hay grabaciones de
   esa carrera entra la máquina.
*/

import { crearTablero, caballoDeMuestra } from "./draw.js";
import { normalizar, miniatura, crearRenderer } from "./scene.js";
import { crearHero } from "./hero.js";
import { CURSOS, cursoPorId, altura, ACCIONES } from "./cursos.js";
import { crearCarrera, avanzar, gritar, accionar, clasificacion, nivelImpulso, avisoObstaculo } from "./race.js";
import * as almacen from "./store.js";
import { pintarPoster } from "./poster.js";
import { crearSala } from "./sala.js";
import { pintarQR } from "./qr.js";
import { STICKERS, stickerPorCodigo, etiquetaSticker, renderConStickers } from "./stickers.js";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const CARRILES = ["#00E676", "#FF6200", "#22D3EE", "#E879F9"];
const NOMBRES_CPU = ["Relámpago", "Centella", "Tornado"];
const INACTIVIDAD = 100000;   // ms sin tocar nada antes de volver a la portada

const estado = {
  curso: CURSOS[0],
  total: 4,
  idx: 0,
  jinetes: [],
  carrera: null,
  teclas: almacen.teclas(),
  cuadro: 0,
  pantalla: "home",
  rankingCurso: CURSOS[0].id,
  reto: null,
  mandos: new Map()      // carril del celular → ficha, dibujo y si ya está listo
};

/* ═════════ Navegación ═════════ */

const PASOS = { carrera: "Paso 1 de 4", setup: "Paso 2 de 4", enroll: "Paso 3 de 4", lobby: "Paso 3 de 4", grid: "Paso 4 de 4" };

function ir(pantalla) {
  estado.pantalla = pantalla;
  $$(".pantalla").forEach(s => s.classList.toggle("es-activa", s.id === `p-${pantalla}`));
  $("#bar").toggleAttribute("data-oculta", pantalla === "race");
  pintarBarra();

  if (pantalla === "home") { refrescarHero(); hero.arrancar(); } else hero.parar();
  if (pantalla === "lobby") pintarLobby();
  const fasePorPantalla = { lobby: "dibujo", grid: "parrilla", race: "carrera", result: "acta", home: "fin" };
  if (fasePorPantalla[pantalla]) sala.fase(fasePorPantalla[pantalla], estado.curso);
  if (pantalla === "ranking") pintarRanking();
  if (pantalla === "enroll") requestAnimationFrame(() => tablero.medir());
  reiniciarInactividad();
}

function pintarBarra() {
  const nav = $("#bar-nav");
  nav.innerHTML = "";
  if (estado.pantalla === "home") {
    const b = document.createElement("button");
    b.className = "enlace enlace-mini";
    b.textContent = "Botones " + estado.teclas.map(t => nombreTecla(t.correr)).join(" ");
    b.addEventListener("click", abrirTeclas);
    nav.appendChild(b);
    return;
  }
  const paso = PASOS[estado.pantalla];
  const span = document.createElement("span");
  if (estado.pantalla === "enroll") {
    span.innerHTML = `${estado.curso.nombre} · ${paso} · <b>Jinete ${estado.idx + 1} de ${estado.total}</b>`;
  } else if (paso) {
    span.innerHTML = `<b>${estado.curso.nombre}</b> · ${paso}`;
  } else if (estado.pantalla === "result") {
    span.innerHTML = `<b>${estado.curso.nombre}</b> · Acta`;
  } else if (estado.pantalla === "ranking") {
    span.textContent = "Ranking";
  } else return;
  nav.appendChild(span);
}

$$("[data-ir]").forEach(b => b.addEventListener("click", () => { pararCarrera(); ir(b.dataset.ir); }));
$("#bar-marca").addEventListener("click", () => { pararCarrera(); ir("home"); });

/* ═════════ Inicio ═════════ */

const hero = crearHero($("#hero"), normalizar(caballoDeMuestra()));

/** La portada muestra el caballo de quien va ganando los 100 llanos. */
function refrescarHero() {
  const lider = almacen.ranking(CURSOS[0].id)[0] || almacen.ranking()[0];
  hero.cambiar(lider?.dibujo || normalizar(caballoDeMuestra()));
  hero.remedir();
  const n = almacen.ranking().length;
  $("#pie-stand").textContent = n
    ? `${n} ${n === 1 ? "carrera corrida" : "carreras corridas"}`
    : "Stand listo";
}

$("#btn-new").addEventListener("click", () => ir("carrera"));
$("#btn-ranking").addEventListener("click", () => ir("ranking"));

/* ═════════ Qué carrera ═════════ */

/** Perfil del terreno y vallas, para que la carrera se entienda de un vistazo. */
function dibujarPerfil(ctx, curso, w, h) {
  ctx.clearRect(0, 0, w, h);
  const base = h - 8, techo = 10;
  const alto = curso.cuesta?.alto || 1;

  ctx.strokeStyle = "#00E676";
  ctx.lineWidth = 1.6;
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const x = (i / 60) * w;
    const y = base - (altura(curso, (i / 60) * curso.largo) / alto) * (base - techo) * (curso.cuesta ? 1 : 0);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();

  // Los que se saltan se marcan hacia arriba y los de agacharse hacia
  // abajo: la forma dice la acción sin tener que leer nada.
  if (curso.obstaculos) {
    ctx.lineWidth = 1.6;
    for (const o of curso.obstaculos) {
      const x = (o.x / curso.largo) * w;
      ctx.strokeStyle = o.tipo === "salto" ? "#E879F9" : "#22D3EE";
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.lineTo(x, o.tipo === "salto" ? base - 14 : base - 26);
      ctx.stroke();
      if (o.tipo === "agache") { ctx.beginPath(); ctx.moveTo(x - 5, base - 26); ctx.lineTo(x + 5, base - 26); ctx.stroke(); }
    }
  }
}

function pintarCarreras() {
  const ol = $("#lista-carreras");
  ol.innerHTML = "";
  CURSOS.forEach(curso => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.className = "carrera";
    b.type = "button";

    const txt = document.createElement("span");
    txt.innerHTML = `<span class="carrera-nombre"></span><span class="carrera-sub"></span>`;
    txt.querySelector(".carrera-nombre").textContent = curso.nombre;
    txt.querySelector(".carrera-sub").textContent = curso.resumen;

    const cv = document.createElement("canvas");
    cv.width = 300; cv.height = 92;
    dibujarPerfil(cv.getContext("2d"), curso, 300, 92);

    const dato = document.createElement("span");
    dato.className = "carrera-dato";
    const grabadas = almacen.cuantosFantasmas(curso.id);
    dato.innerHTML = `${curso.largo} m<br>${curso.duracion}` +
      (grabadas ? `<br>${grabadas} ${grabadas === 1 ? "corrida grabada" : "corridas grabadas"}` : "");

    b.append(txt, cv, dato);
    b.addEventListener("click", () => {
      estado.curso = curso;
      estado.rankingCurso = curso.id;
      ir("setup");
      $("#setup-sub").textContent = almacen.cuantosFantasmas(curso.id)
        ? "Los puestos que sobren los corren personas que ya pasaron por aquí."
        : "Los puestos que sobren los corre la máquina, hasta que haya corridas grabadas.";
    });
    li.appendChild(b);
    ol.appendChild(li);
  });
}
pintarCarreras();

/* ═════════ Cuántos jinetes ═════════ */

const cifras = $("#cifras");
[1, 2, 3, 4].forEach(n => {
  const b = document.createElement("button");
  b.className = "cifra";
  b.innerHTML = `<b>${n}</b><span>${n === 1 ? "jinete" : "jinetes"}</span>`;
  b.addEventListener("click", () => {
    estado.total = n;
    estado.idx = 0;
    estado.jinetes = [];
    prepararFicha();
    ir("enroll");
  });
  cifras.appendChild(b);
});

/* ═════════ Registro y dibujo ═════════ */

const tablero = crearTablero($("#pad"), vacio => {
  $("#pad-vacio").toggleAttribute("data-oculto", !vacio);
  $("#in-sticker").disabled = vacio;
});

const selectorSticker = $("#in-sticker");
selectorSticker.add(new Option("Sin sticker", ""));
STICKERS.forEach(s => selectorSticker.add(new Option(s.codigo + " · " + s.nombre, s.codigo)));
function previsualizarSticker() {
  $("#sticker-preview").replaceChildren();
  const etiqueta = etiquetaSticker(selectorSticker.value);
  if (etiqueta) $("#sticker-preview").append(etiqueta);
}
selectorSticker.addEventListener("change", previsualizarSticker);

$("#btn-undo").addEventListener("click", () => tablero.deshacer());
$("#btn-clear").addEventListener("click", () => tablero.limpiar());
$("#btn-borrow").addEventListener("click", () => {
  if (!tablero.vacio() && !confirm("Esto reemplaza lo que ya dibujó. ¿Sigo?")) return;
  tablero.prestar();
});

/* Enter en el nombre pasa al contacto en vez de enviar: si enviara, se
   saltaría la captura de contacto, que es la razón de negocio del stand. */
[["#in-name", "#in-phone"], ["#in-phone", "#in-email"]].forEach(([de, a]) =>
  $(de).addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    $(a).focus();
  }));

function pintarInscritos() {
  const cont = $("#inscritos");
  cont.innerHTML = "";
  if (!estado.jinetes.length) {
    const p = document.createElement("p");
    p.className = "inscritos-vacio";
    p.textContent = estado.total > 1 ? `Faltan ${estado.total} jinetes` : "";
    cont.appendChild(p);
    return;
  }
  estado.jinetes.forEach((j, i) => {
    const d = document.createElement("div");
    d.className = "inscrito";
    d.style.animationDelay = `${i * 60}ms`;
    const cv = document.createElement("canvas");
    cv.width = 156; cv.height = 92;
    miniatura(cv.getContext("2d"), j.dibujo, 156, 92, j.color, 2.6);
    d.appendChild(cv);
    const b = document.createElement("b");
    b.textContent = j.nombre;
    const s = document.createElement("span");
    s.textContent = `Botón ${nombreTecla(j.teclas.correr)}`;
    d.append(b, s);
    cont.appendChild(d);
  });
}

function prepararFicha() {
  const color = CARRILES[estado.idx];
  $("#enroll-punto").style.color = color;
  $("#in-name").value = "";
  $("#in-phone").value = "+506 ";
  $("#in-email").value = "";
  $("#in-consent").checked = false;
  $("#enroll-err").textContent = "";
  $("#btn-enroll-back").textContent = estado.idx === 0 ? "Volver" : "Atrás, corregir el anterior";
  selectorSticker.value = "";
  previsualizarSticker();
  tablero.limpiar();
  tablero.tinta = color;
  pintarInscritos();
  pintarBarra();
  requestAnimationFrame(() => { tablero.medir(); $("#in-name").focus(); });
}

/** Atrás de verdad: recupera al jinete anterior en vez de tirar todo. */
$("#btn-enroll-back").addEventListener("click", () => {
  if (estado.idx === 0) { ir("setup"); return; }
  estado.idx--;
  const j = estado.jinetes.pop();
  prepararFicha();
  $("#in-name").value = j.nombre;
  tablero.cargar(j.trazosCrudos);
  $("#in-phone").value = j.telefono || "";
  $("#in-email").value = j.correo || "";
  $("#in-consent").checked = !!j.consiente;
  selectorSticker.value = j.sticker || "";
  previsualizarSticker();
});

$("#ficha").addEventListener("submit", e => { e.preventDefault(); inscribir(); });

/* WhatsApp y correo son obligatorios para jugar: decisión del cliente.
   Se validan de verdad, no solo que no estén vacíos, porque un dato
   inventado a la carrera no sirve para nada en el CRM. */
const TELEFONO_OK = t => (t.match(/\d/g) || []).length >= 8;
const CORREO_OK = c => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c);

function inscribir() {
  const err = $("#enroll-err");
  const nombre = $("#in-name").value.trim();
  const telefono = $("#in-phone").value.trim();
  const correo = $("#in-email").value.trim();
  const consiente = $("#in-consent").checked;

  if (estado.jinetes.length >= estado.total) return;   // no se pasa de la cuenta
  if (nombre.length < 2) { err.textContent = "Póngale un nombre al jinete."; $("#in-name").focus(); return; }
  if (!TELEFONO_OK(telefono)) { err.textContent = "Escriba un WhatsApp válido: hacen falta al menos ocho dígitos."; $("#in-phone").focus(); return; }
  if (!CORREO_OK(correo)) { err.textContent = "Escriba un correo válido, con arroba y dominio."; $("#in-email").focus(); return; }
  if (!consiente) { err.textContent = "Hay que marcar la autorización para poder correr."; return; }
  if (tablero.vacio()) { err.textContent = "Falta el caballo. Dibuje algo o use «Présteme uno»."; return; }
  err.textContent = "";

  almacen.guardarLead({ nombre, telefono, correo, consiente });

  const crudos = tablero.trazos();
  estado.jinetes.push({
    nombre, telefono, correo, consiente,
    sticker: stickerPorCodigo(selectorSticker.value)?.codigo || null,
    color: CARRILES[estado.idx],
    dibujo: normalizar(crudos),
    trazosCrudos: crudos,
    esBot: false,
    teclas: estado.teclas[estado.idx]
  });

  estado.idx++;
  if (estado.idx < estado.total) prepararFicha();
  else { armarParrilla(); ir("grid"); }
}

/* ═════════ Sala de celulares ═════════
   Cuatro teléfonos como mandos de una sola carrera. El celular solo dibuja
   y manda pulsaciones: la simulación entera se queda en la mesa, que es lo
   que garantiza que los cuatro vean la misma carrera. */

const sala = crearSala({
  alEstado: pintarLobby,
  alJinete(m) {
    const previo = estado.mandos.get(m.carril) || {};
    estado.mandos.set(m.carril, { ...previo, nombre: m.nombre, telefono: m.telefono, correo: m.correo });
    almacen.guardarLead({ nombre: m.nombre, telefono: m.telefono, correo: m.correo, consiente: true });
    pintarLobby();
  },
  alDibujo(m) {
    const j = estado.mandos.get(m.carril);
    if (!j) return;
    j.trazosCrudos = m.trazos;
    j.dibujo = normalizar(m.trazos);
    pintarLobby();
  },
  alListo(m) {
    const j = estado.mandos.get(m.carril);
    if (j) { j.listo = true; pintarLobby(); }
  },
  alFuera(m) { estado.mandos.delete(m.carril); pintarLobby(); },
  alAccion(m) {
    const i = mapaMandos.get(m.carril);
    if (i == null || !estado.carrera?.corriendo) return;
    if (m.a === "correr") gritar(estado.carrera, i);
    else accionar(estado.carrera, i, m.a);
  }
});

function pintarLobby() {
  if (estado.pantalla !== "lobby") return;
  const lienzo = $("#qr");
  const aviso = $("#lobby-aviso");

  if (!sala.vivo || !sala.codigo) {
    $("#lobby-url").textContent = "Buscando el servidor del stand…";
    $("#lobby-codigo").textContent = "····";
    aviso.textContent = "Si esto no cambia, el juego se abrió sin «node server.js».";
  } else {
    const url = sala.url();
    $("#lobby-url").textContent = url.replace(/^https?:\/\//, "");
    $("#lobby-codigo").textContent = sala.codigo;
    lienzo.width = 560;
    pintarQR(lienzo, url);
    $("#lobby-paso-red").textContent = sala.publico()
      ? "Cualquier red sirve, no hace falta compartir WiFi"
      : "Conéctese al WiFi del stand";
    if (sala.publico()) {
      aviso.textContent = "Funciona desde cualquier red — no hace falta compartir WiFi.";
    } else {
      const otras = sala.direcciones().slice(1);
      aviso.textContent = otras.length
        ? `Si no entra, pruebe con otra red del equipo: ${otras.join(" · ")}`
        : "Los celulares tienen que estar en la misma red que este equipo.";
    }
  }

  const ol = $("#lobby-jinetes");
  ol.innerHTML = "";
  if (!estado.mandos.size) {
    const li = document.createElement("li");
    li.className = "lobby-vacio";
    li.textContent = "Todavía no se ha conectado nadie.";
    ol.appendChild(li);
  } else {
    [...estado.mandos.entries()].sort((a, b) => a[0] - b[0]).forEach(([carril, j]) => {
      const li = document.createElement("li");
      li.className = "lobby-jinete";
      li.style.setProperty("--carril", CARRILES[carril]);
      if (j.listo) li.setAttribute("data-listo", "");
      li.innerHTML = `<span class="lj-num">${carril + 1}</span>`;
      const cv = document.createElement("canvas");
      cv.width = 108; cv.height = 72;
      if (j.dibujo) miniatura(cv.getContext("2d"), j.dibujo, 108, 72, CARRILES[carril], 2.4);
      li.appendChild(cv);
      const b = document.createElement("b");
      b.textContent = j.nombre;
      const e = document.createElement("span");
      e.className = "lj-estado";
      e.textContent = j.listo ? "listo" : j.dibujo ? "dibujando" : "conectado";
      li.append(b, e);
      ol.appendChild(li);
    });
  }

  const listos = [...estado.mandos.values()].filter(j => j.dibujo).length;
  $("#btn-lobby-ir").disabled = listos === 0;
  $("#btn-lobby-ir").textContent = listos
    ? `Empezar con ${listos} ${listos === 1 ? "jinete" : "jinetes"}`
    : "Esperando jinetes";
}

$("#btn-celulares").addEventListener("click", () => { estado.mandos.clear(); ir("lobby"); });

$("#btn-lobby-ir").addEventListener("click", () => {
  const conDibujo = [...estado.mandos.entries()]
    .filter(([, j]) => j.dibujo)
    .sort((a, b) => a[0] - b[0])
    .slice(0, 4);
  if (!conDibujo.length) return;
  estado.jinetes = conDibujo.map(([carril, j], i) => ({
    nombre: j.nombre,
    color: CARRILES[i],
    dibujo: j.dibujo,
    trazosCrudos: j.trazosCrudos,
    esBot: false,
    teclas: null,
    carrilMando: carril
  }));
  estado.total = estado.jinetes.length;
  estado.reto = null;
  armarParrilla();
  ir("grid");
});

/* ═════════ Parrilla ═════════ */

/** Un garabato de cuatro patas para que el rival de la casa tenga cara. */
function caballoCPU(semilla) {
  const trazos = [];
  const cuerpo = [];
  for (let a = 0; a <= 18; a++) {
    const t = a / 18 * Math.PI * 2;
    cuerpo.push({ x: 50 + Math.cos(t) * 44, y: 42 + Math.sin(t) * (20 + semilla * 3) });
  }
  trazos.push({ puntos: cuerpo });
  trazos.push({ puntos: [{ x: 88, y: 30 }, { x: 106, y: 12 }, { x: 122, y: 16 }, { x: 116, y: 30 }] });
  [22, 38, 64, 80].forEach((x, k) => trazos.push({
    puntos: [{ x, y: 58 }, { x: x + (k % 2 ? 3 : -3), y: 78 }, { x, y: 96 }]
  }));
  trazos.push({ puntos: [{ x: 7, y: 34 }, { x: -6, y: 44 }, { x: -2, y: 58 }] });
  return normalizar(trazos);
}

/** Humanos primero, después grabaciones de gente real, y la máquina al final. */
function corredores() {
  const todos = estado.jinetes.slice(0, 4).map((j, i) => ({ ...j, color: CARRILES[i] }));

  // Si se retó a alguien en concreto, ese va primero entre los grabados
  const grabados = [];
  if (estado.reto && estado.reto.gritos?.length) grabados.push(estado.reto);
  const huecos = 4 - todos.length - grabados.length;
  almacen.fantasmas(estado.curso.id, Math.max(0, huecos))
    .filter(f => f !== estado.reto)
    .forEach(f => grabados.push(f));

  grabados.slice(0, 4 - todos.length).forEach(f => {
    todos.push({
      nombre: f.nombre,
      color: CARRILES[todos.length],
      dibujo: f.dibujo,
      sticker: f.sticker || null,
      esFantasma: true,
      gritos: f.gritos,
      acciones: f.acciones || [],
      tiempoOficial: f.tiempo,
      teclas: null
    });
  });

  for (let k = 0; todos.length < 4; k++) {
    todos.push({
      nombre: NOMBRES_CPU[k % NOMBRES_CPU.length],
      color: CARRILES[todos.length],
      dibujo: caballoCPU(k),
      esBot: true,
      teclas: null
    });
  }
  return todos.slice(0, 4);
}

const rolDe = r => r.esFantasma ? "grabado" : r.esBot ? "la máquina" : r.carrilMando != null ? "su celular" : "su botón";

function armarParrilla() {
  const cont = $("#parrilla");
  cont.innerHTML = "";
  corredores().forEach(r => {
    const col = document.createElement("div");
    col.className = "puesto";
    col.style.setProperty("--carril", r.color);
    if (r.esBot || r.esFantasma) col.setAttribute("data-cpu", "");
    if (r.carrilMando != null) col.style.setProperty("--carril", r.color);

    const cv = document.createElement("canvas");
    cv.width = 380; cv.height = 240;
    miniatura(cv.getContext("2d"), r.dibujo, 380, 240, r.color, 4);
    col.appendChild(cv);

    const tecla = document.createElement("div");
    tecla.className = "puesto-tecla";
    if (!r.teclas) {
      tecla.textContent = r.carrilMando != null ? "Celular" : r.esFantasma ? "Grabado" : "CPU";
    } else if (estado.curso.obstaculos) {
      // Arriba saltar, en medio correr, abajo agacharse: igual que en el teclado
      tecla.classList.add("puesto-tecla-trio");
      tecla.innerHTML =
        `<span class="pt-arriba">↑ ${nombreTecla(r.teclas.saltar)}</span>` +
        `<span class="pt-correr">${nombreTecla(r.teclas.correr)}</span>` +
        `<span class="pt-abajo">↓ ${nombreTecla(r.teclas.agachar)}</span>`;
    } else {
      tecla.textContent = nombreTecla(r.teclas.correr);
    }
    const nom = document.createElement("div");
    nom.className = "puesto-nombre";
    nom.textContent = r.nombre;
    const rol = document.createElement("div");
    rol.className = "puesto-rol";
    rol.textContent = r.teclas && estado.curso.obstaculos ? "saltar · correr · agacharse" : rolDe(r);
    if (r.carrilMando != null) col.removeAttribute("data-cpu");

    col.append(tecla, nom, rol);
    cont.appendChild(col);
  });
}

$("#btn-go").addEventListener("click", arrancar);

/* ═════════ Carrera ═════════ */

const renderer = crearRenderer($("#track"));
const salida = $("#salida");
const tablaViva = $("#tabla-viva");
let ultimoCuadro = 0, ultimoHUD = 0, mapaTeclas = new Map(), mapaMandos = new Map();

function arrancar() {
  const lista = corredores();
  estado.carrera = crearCarrera(lista.map(({ sticker, ...r }) => r), estado.curso);
  // Metadato visual; el motor no lo recibe ni lo utiliza.
  estado.carrera.corredores.forEach((r, i) => { r.sticker = lista[i].sticker || null; });

  mapaTeclas = new Map();
  mapaMandos = new Map();
  lista.forEach((r, i) => {
    if (r.carrilMando != null) mapaMandos.set(r.carrilMando, i);
    if (!r.teclas || r.esBot || r.esFantasma) return;
    mapaTeclas.set(r.teclas.correr, { i, accion: "correr" });
    if (estado.curso.obstaculos) {
      mapaTeclas.set(r.teclas.saltar, { i, accion: "salto" });
      mapaTeclas.set(r.teclas.agachar, { i, accion: "agache" });
    }
  });

  // Recordatorio de teclas bajo la cuenta atrás
  const st = $("#salida-teclas");
  st.innerHTML = "";
  lista.forEach(r => {
    if (!r.teclas) return;
    const d = document.createElement("div");
    d.className = "salida-tecla";
    d.style.setProperty("--carril", r.color);
    d.innerHTML = estado.curso.obstaculos
      ? `<i>↑ ${nombreTecla(r.teclas.saltar)}</i><b>${nombreTecla(r.teclas.correr)}</b>` +
        `<i>↓ ${nombreTecla(r.teclas.agachar)}</i><span></span>`
      : `<b>${nombreTecla(r.teclas.correr)}</b><span></span>`;
    d.querySelector("span").textContent = r.nombre;
    st.appendChild(d);
  });

  tablaViva.innerHTML = "";
  lista.forEach(r => {
    const fila = document.createElement("div");
    fila.className = "viva";
    fila.style.setProperty("--carril", r.color);
    if (r.esBot || r.esFantasma) fila.setAttribute("data-cpu", "");
    fila.innerHTML =
      `<span class="viva-pos">–</span><span class="viva-tecla"></span>
       <span class="viva-nombre"></span><span class="viva-dato"></span>
       <span class="viva-aviso"></span><span class="viva-ritmo"></span>`;
    fila.querySelector(".viva-tecla").textContent = r.teclas ? nombreTecla(r.teclas.correr) : "·";
    fila.querySelector(".viva-nombre").textContent = r.nombre;
    tablaViva.appendChild(fila);
  });

  ir("race");
  // Con setTimeout y no con rAF: si la ventana del stand queda detrás de
  // otra, rAF se congela y la cuenta atrás nunca empezaría.
  setTimeout(() => cuentaAtras(() => {
    if (!estado.carrera) return;
    estado.carrera.corriendo = true;
    ultimoCuadro = performance.now();
    estado.cuadro = requestAnimationFrame(bucle);
  }), 60);
}

function cuentaAtras(listo) {
  const pasos = ["3", "2", "1", "YA"];
  let k = 0;
  salida.hidden = false;
  renderConStickers(renderer, $("#track"), estado.carrera, estado.curso, 1 / 60);
  const tic = () => {
    if (!estado.carrera) return;
    if (k >= pasos.length) { salida.hidden = true; salida.removeAttribute("data-ya"); listo(); return; }
    $("#salida-cifra").textContent = pasos[k];
    salida.toggleAttribute("data-ya", k === pasos.length - 1);
    k++;
    setTimeout(tic, k === pasos.length ? 430 : 760);
  };
  tic();
}

function bucle(ahora) {
  const c = estado.carrera;
  if (!c) return;
  const dt = Math.min(0.1, (ahora - ultimoCuadro) / 1000);
  ultimoCuadro = ahora;

  avanzar(c, dt);
  renderConStickers(renderer, $("#track"), c, estado.curso, dt);
  $("#hud-clock").textContent = c.t.toFixed(2);

  pintarPerfil(c);
  if (ahora - ultimoHUD > 90) {
    ultimoHUD = ahora;
    pintarTablaViva(c);
    avisarMandos(c);
  }
  if (c.terminada) { setTimeout(() => mostrarActa(c), 1100); return; }
  estado.cuadro = requestAnimationFrame(bucle);
}

/* La tira de perfil. En un plano isométrico una loma suave casi no se
   lee y quien se descuelga se sale del cuadro; aquí siempre se ve el
   terreno entero y dónde va cada quien. */
const lienzoPerfil = $("#perfil");
function pintarPerfil(carrera) {
  const caja = lienzoPerfil.getBoundingClientRect();
  if (caja.width < 1 || caja.height < 1) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (lienzoPerfil.width !== Math.round(caja.width * dpr)) {
    lienzoPerfil.width = Math.round(caja.width * dpr);
    lienzoPerfil.height = Math.round(caja.height * dpr);
  }
  const c = lienzoPerfil.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = caja.width, H = caja.height;
  c.clearRect(0, 0, W, H);

  const curso = estado.curso;
  const base = H - 16, techo = 14;
  const alto = curso.cuesta?.alto || 1;
  const enX = m => (m / curso.largo) * (W - 4) + 2;
  const enY = m => base - (curso.cuesta ? (altura(curso, m) / alto) * (base - techo) : 0);

  // Terreno
  c.strokeStyle = "#2A332C"; c.lineWidth = 1.4; c.lineJoin = "round";
  c.beginPath();
  for (let i = 0; i <= 90; i++) {
    const m = (i / 90) * curso.largo;
    i ? c.lineTo(enX(m), enY(m)) : c.moveTo(enX(m), enY(m));
  }
  c.stroke();

  // Obstáculos: palito hacia arriba el de saltar, travesaño el de agacharse
  if (curso.obstaculos) {
    c.lineWidth = 1.4;
    for (const o of curso.obstaculos) {
      const x = enX(o.x), y = enY(o.x);
      c.strokeStyle = o.tipo === "salto" ? "#E879F9" : "#22D3EE";
      c.beginPath(); c.moveTo(x, y); c.lineTo(x, o.tipo === "salto" ? y - 9 : y - 18); c.stroke();
      if (o.tipo === "agache") { c.beginPath(); c.moveTo(x - 4, y - 18); c.lineTo(x + 4, y - 18); c.stroke(); }
    }
  }

  // Salida y meta
  c.strokeStyle = "#00E676"; c.lineWidth = 1.6; c.globalAlpha = 0.7;
  for (const m of [0, curso.largo]) {
    c.beginPath(); c.moveTo(enX(m), enY(m) + 5); c.lineTo(enX(m), enY(m) - 13); c.stroke();
  }
  c.globalAlpha = 1;

  // Cada jinete. Quien juega lleva anillo; los grabados y la máquina, no.
  for (const r of carrera.corredores) {
    const x = enX(r.distancia), y = enY(r.distancia) - 4;
    const propio = !r.esBot && !r.esFantasma;
    c.fillStyle = r.color;
    c.globalAlpha = propio ? 1 : 0.5;
    c.beginPath(); c.arc(x, y, propio ? 4.5 : 3, 0, 6.28); c.fill();
    if (propio) {
      c.strokeStyle = r.color; c.lineWidth = 1.2; c.globalAlpha = 0.45;
      c.beginPath(); c.arc(x, y, 8, 0, 6.28); c.stroke();
    }
    c.globalAlpha = 1;
  }
}

/** Lo que cada jinete de celular ve en su propia pantalla. */
function avisarMandos(c) {
  if (!mapaMandos.size) return;
  const orden = clasificacion(c);
  for (const [carril, i] of mapaMandos) {
    const r = c.corredores[i];
    if (!r) continue;
    const av = avisoObstaculo(c, r);
    sala.marcador(carril, {
      puesto: orden.indexOf(r) + 1,
      distancia: Math.round(r.distancia),
      meta: r.meta,
      aviso: av ? { tipo: av.tipo, listo: av.listo } : null
    });
  }
}

function pintarTablaViva(c) {
  const orden = clasificacion(c);
  const filas = [...tablaViva.children];
  orden.forEach((r, pos) => {
    const fila = filas[r.i];
    if (!fila) return;
    fila.style.order = pos;
    fila.toggleAttribute("data-lider", pos === 0);
    fila.toggleAttribute("data-tropieza", r.tropiezo > 0);
    fila.querySelector(".viva-pos").textContent = pos + 1;
    fila.querySelector(".viva-dato").textContent =
      r.meta !== null ? `${r.meta.toFixed(2)} s`
      : r.tropiezo > 0 ? "tropezó"
      : `${r.distancia.toFixed(0)} m`;
    // Qué botón toca ahora. Es lo único que el jinete no puede adivinar.
    const aviso = fila.querySelector(".viva-aviso");
    const prox = r.teclas ? avisoObstaculo(c, r) : null;
    if (prox) {
      aviso.textContent = `${ACCIONES[prox.tipo].flecha} ${nombreTecla(prox.tipo === "salto" ? r.teclas.saltar : r.teclas.agachar)}`;
      aviso.setAttribute("data-on", "");
      aviso.toggleAttribute("data-ya", prox.listo);
    } else {
      aviso.textContent = "";
      aviso.removeAttribute("data-on");
      aviso.removeAttribute("data-ya");
    }
    fila.querySelector(".viva-ritmo").style.width = `${nivelImpulso(r) * 100}%`;
  });
}

function pararCarrera() {
  if (estado.cuadro) cancelAnimationFrame(estado.cuadro);
  estado.cuadro = 0;
  estado.carrera = null;
  salida.hidden = true;
}

window.addEventListener("keydown", e => {
  if (!estado.carrera || !estado.carrera.corriendo) return;
  if (e.repeat) return;                       // mantener apretado no cuenta
  const k = e.key.toLowerCase();
  const m = mapaTeclas.get(k);
  if (!m) return;
  e.preventDefault();
  if (m.accion === "correr") gritar(estado.carrera, m.i);
  else accionar(estado.carrera, m.i, m.accion);
});

/* ═════════ Acta ═════════ */

function mostrarActa(c) {
  const orden = clasificacion(c);

  orden.forEach(r => {
    if (!r.esBot && !r.esFantasma && r.meta !== null) {
      almacen.guardarCorrida({
        nombre: r.nombre, tiempo: r.meta, dibujo: r.dibujo, color: r.color, sticker: r.sticker,
        curso: estado.curso.id, gritos: r.registro, acciones: r.registroAcciones
      });
    }
  });

  const ganador = orden[0];
  const humanos = orden.filter(r => !r.esBot && !r.esFantasma);
  const yo = humanos.find(r => r.meta !== null) || humanos[0];
  const puesto = yo ? orden.indexOf(yo) + 1 : 1;

  // El último frame de la experiencia no puede ser el sistema burlándose
  // de quien vino a jugar.
  $("#acta-nota").textContent =
    ganador.esFantasma ? `Le ganó ${ganador.nombre}, que pasó por aquí antes`
    : ganador.esBot ? "El récord de la casa sigue en pie"
    : humanos.length > 1 ? "Y contra todo pronóstico, terminaron"
    : "Queda grabado";

  $("#acta-puesto").textContent = `${puesto}.º`;
  $("#acta-puesto").style.color = yo ? yo.color : "var(--texto)";

  $("#acta-frase").textContent = yo && yo.meta !== null
    ? `${yo.nombre} corrió ${estado.curso.largo} m en ${yo.meta.toFixed(2)} segundos. Ese caballo lo dibujó usted.`
    : "Nadie llegó a la meta. Pasa en las mejores familias.";

  // Contra cuánta gente grabada se midió de verdad
  const historico = almacen.ranking(estado.curso.id);
  const mejorPropia = yo ? historico.filter(r => r.nombre === yo.nombre)[0] : null;
  const superados = yo && yo.meta !== null ? historico.filter(r => r.tiempo > yo.meta).length : 0;
  const lineas = [];
  if (mejorPropia) lineas.push(`Su mejor marca: ${mejorPropia.tiempo.toFixed(2)}s`);
  if (yo && yo.meta !== null && historico.length > 1) {
    lineas.push(`Le ganó a ${superados} ${superados === 1 ? "corrida guardada" : "corridas guardadas"}`);
    const record = historico[0];
    if (record && record.tiempo < yo.meta) lineas.push(`A ${(yo.meta - record.tiempo).toFixed(2)}s del récord`);
    else if (record && record.tiempo >= yo.meta) lineas.push("Récord de la carrera");
  }
  $("#acta-marca").textContent = lineas.join(" · ");

  const ol = $("#tabla-final");
  ol.innerHTML = "";
  orden.forEach((r, i) => ol.appendChild(filaResultado({
    pos: i + 1,
    nombre: r.nombre,
    rol: rolDe(r),
    meta: estado.curso.obstaculos
      ? `${r.limpios} de ${estado.curso.obstaculos.length} limpios · ${r.gritos} pulsaciones`
      : `${r.gritos} pulsaciones · ritmo ${(r.ritmo * 100).toFixed(0)}%`,
    tiempo: r.meta === null ? "no llegó" : `${r.meta.toFixed(2)}s`,
    dibujo: r.dibujo, color: r.color, sticker: r.sticker, gana: i === 0,
    apagado: r.esBot || r.esFantasma
  })));

  pintarHistorico(yo);
  pintarPoster($("#poster"), orden, estado.curso);
  estado.carrera = null;
  ir("result");
}

/* ═════════ Ranking histórico del acta ═════════
   La tabla de la derecha: contra quién se acaba de medir y a quién puede
   retar ahora mismo. Cada fila es una corrida grabada de verdad, así que
   «Retar» corre contra esa persona, no contra un número. */

function pintarHistorico(yo) {
  const curso = estado.curso;
  const filas = almacen.ranking(curso.id);
  $("#historico-sub").textContent = `${curso.nombre} · ${filas.length} ${filas.length === 1 ? "corrida" : "corridas"}`;

  const ol = $("#tabla-historico");
  ol.innerHTML = "";
  if (!filas.length) {
    const li = document.createElement("li");
    li.className = "tabla-vacia";
    li.textContent = "Todavía no hay marcas en esta carrera.";
    ol.appendChild(li);
    return;
  }

  filas.slice(0, 100).forEach((r, i) => {
    const li = document.createElement("li");
    li.className = "fila fila-historico";
    li.style.setProperty("--carril", r.color);
    if (i === 0) li.setAttribute("data-gana", "");
    if (yo && yo.meta !== null && Math.abs(r.tiempo - yo.meta) < 0.005 && r.nombre === yo.nombre) {
      li.setAttribute("data-propia", "");
    }
    li.innerHTML = `<span class="fila-pos">${i + 1}</span>`;
    const cv = document.createElement("canvas");
    cv.width = 120; cv.height = 82;
    miniatura(cv.getContext("2d"), r.dibujo, 120, 82, r.color, 2.6);
    li.appendChild(cv);

    const cuerpo = document.createElement("span");
    cuerpo.className = "fila-cuerpo";
    cuerpo.innerHTML = `<span class="fila-nombre"></span>`;
    cuerpo.querySelector(".fila-nombre").textContent = r.nombre;
    const reto = document.createElement("button");
    reto.className = "enlace enlace-mini";
    reto.type = "button";
    reto.textContent = `Retar ${r.tiempo.toFixed(2)}s`;
    reto.addEventListener("click", () => retar(r));
    cuerpo.appendChild(reto);

    const t = document.createElement("span");
    t.className = "fila-tiempo";
    t.textContent = `${r.tiempo.toFixed(2)}s`;
    li.append(cuerpo, t);
    ol.appendChild(li);
  });
}

/** Una fila de resultado: misma pieza para el acta y para los rankings. */
function filaResultado({ pos, nombre, rol, meta, tiempo, dibujo, color, sticker, gana, apagado }) {
  const li = document.createElement("li");
  li.className = "fila";
  li.style.setProperty("--carril", color);
  if (gana) li.setAttribute("data-gana", "");
  if (apagado) li.setAttribute("data-cpu", "");
  li.innerHTML = `<span class="fila-pos">${pos}</span>`;
  const cv = document.createElement("canvas");
  cv.width = 152; cv.height = 104;
  miniatura(cv.getContext("2d"), dibujo, 152, 104, color, 3);
  li.appendChild(cv);
  const cuerpo = document.createElement("span");
  cuerpo.className = "fila-cuerpo";
  cuerpo.innerHTML = `<span class="fila-nombre"></span><span class="fila-meta"></span>`;
  cuerpo.querySelector(".fila-nombre").textContent = nombre;
  cuerpo.querySelector(".fila-meta").textContent = rol ? `${rol} · ${meta}` : meta;
  const t = document.createElement("span");
  t.className = "fila-tiempo";
  t.textContent = tiempo;
  li.append(cuerpo, t);
  const etiqueta = etiquetaSticker(sticker);
  if (etiqueta) cuerpo.append(etiqueta);
  return li;
}

/** Correr otra vez, pero contra esta persona en concreto. */
function retar(corrida) {
  if (!estado.jinetes.length) { ir("carrera"); return; }
  estado.reto = corrida;
  armarParrilla();
  ir("grid");
}

$("#btn-again").addEventListener("click", () => {
  if (!estado.jinetes.length) { ir("carrera"); return; }
  estado.reto = null;
  armarParrilla();
  ir("grid");
});

/* La lámina a pantalla completa: el souvenir se lleva con una foto del
   celular, que es lo único que funciona en un stand sin internet. */
const capaLamina = $("#capa-lamina");
$("#btn-lamina").addEventListener("click", () => { capaLamina.hidden = false; });
$("#btn-lamina-close").addEventListener("click", () => { capaLamina.hidden = true; });
capaLamina.addEventListener("click", e => { if (e.target === capaLamina) capaLamina.hidden = true; });
$("#btn-save-img").addEventListener("click", () => {
  const hoy = new Date().toISOString().slice(0, 10);
  $("#poster").toBlob(b => almacen.descargar(`${hoy}_vla_caballos-de-fuerza.png`, b, "image/png"), "image/png");
});

/* ═════════ Ranking del evento ═════════ */

function pintarPestanas() {
  const cont = $("#pestanas-ranking");
  cont.innerHTML = "";
  CURSOS.forEach(curso => {
    const b = document.createElement("button");
    b.className = "pestana";
    b.textContent = curso.nombre;
    b.toggleAttribute("data-on", curso.id === estado.rankingCurso);
    b.addEventListener("click", () => { estado.rankingCurso = curso.id; pintarRanking(); });
    cont.appendChild(b);
  });
}

function pintarRanking() {
  pintarPestanas();
  const ol = $("#tabla-ranking");
  const filas = almacen.ranking(estado.rankingCurso).slice(0, 12);
  ol.innerHTML = "";
  if (!filas.length) {
    const li = document.createElement("li");
    li.className = "tabla-vacia";
    li.textContent = "Todavía no corre nadie esta carrera.";
    ol.appendChild(li);
    return;
  }
  filas.forEach((r, i) => ol.appendChild(filaResultado({
    pos: i + 1, nombre: r.nombre, rol: "",
    meta: new Date(r.fecha).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" }),
    tiempo: `${r.tiempo.toFixed(2)}s`,
    dibujo: r.dibujo, color: r.color, gana: i === 0
  })));
}

/* ═════════ Modo promotor ═════════
   Exportar contactos y reiniciar el evento no pueden estar a un clic de
   la portada: son ocho horas de captación y los teléfonos de terceros. */

const capaStand = $("#capa-stand");

function abrirStand() {
  const n = almacen.leads().length, c = almacen.ranking().length;
  $("#nota-stand").textContent =
    `${n} ${n === 1 ? "contacto capturado" : "contactos capturados"} con autorización · ` +
    `${c} ${c === 1 ? "corrida guardada" : "corridas guardadas"}.`;
  capaStand.hidden = false;
}

$("#btn-stand-close").addEventListener("click", () => { capaStand.hidden = true; });
$("#btn-keys-open").addEventListener("click", () => { capaStand.hidden = true; abrirTeclas(); });

$("#btn-export").addEventListener("click", () => {
  if (!almacen.leads().length) { $("#nota-stand").textContent = "No hay contactos que exportar todavía."; return; }
  const hoy = new Date().toISOString().slice(0, 10);
  almacen.descargar(`${hoy}_vla_leads_caballos-de-fuerza.csv`, almacen.leadsCSV());
});

$("#btn-reset").addEventListener("click", () => {
  if (!confirm("Esto borra el ranking, las corridas grabadas y los contactos de este equipo. ¿Seguro?")) return;
  almacen.reiniciarEvento();
  abrirStand();
  pintarCarreras();
  refrescarHero();
});

/* ═════════ Botones de carril ═════════ */

const capaTeclas = $("#capa-teclas");
let escuchando = null;   // {i, accion} del hueco que espera una tecla

const RANURAS = [
  { accion: "saltar", etiqueta: "Saltar", flecha: "↑" },
  { accion: "correr", etiqueta: "Correr", flecha: "" },
  { accion: "agachar", etiqueta: "Agacharse", flecha: "↓" }
];

function abrirTeclas() {
  capaTeclas.hidden = false;
  escuchando = null;
  const lista = $("#lista-teclas");
  lista.innerHTML = "";
  estado.teclas.forEach((t, i) => {
    const fila = document.createElement("div");
    fila.className = "tecla";
    fila.style.setProperty("--carril", CARRILES[i]);
    const nom = document.createElement("b");
    nom.textContent = `Carril ${i + 1}`;
    fila.appendChild(nom);

    const grupo = document.createElement("div");
    grupo.className = "tecla-grupo";
    RANURAS.forEach(({ accion, etiqueta, flecha }) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ranura";
      b.dataset.accion = accion;
      b.innerHTML = `<kbd></kbd><span>${flecha} ${etiqueta}</span>`;
      b.querySelector("kbd").textContent = nombreTecla(t[accion]);
      b.addEventListener("click", () => {
        escuchando = { i, accion };
        $$(".ranura").forEach(r => r.removeAttribute("data-escucha"));
        b.setAttribute("data-escucha", "");
        b.querySelector("kbd").textContent = "…";
      });
      grupo.appendChild(b);
    });
    fila.appendChild(grupo);
    lista.appendChild(fila);
  });
}

const cerrarTeclas = () => { capaTeclas.hidden = true; escuchando = null; pintarBarra(); };
$("#btn-keys-close").addEventListener("click", cerrarTeclas);
capaTeclas.addEventListener("click", e => { if (e.target === capaTeclas) cerrarTeclas(); });
capaStand.addEventListener("click", e => { if (e.target === capaStand) capaStand.hidden = true; });

$("#btn-keys-default").addEventListener("click", () => {
  estado.teclas = almacen.teclasPorDefecto();
  almacen.guardarTeclas(estado.teclas);
  abrirTeclas();
});

window.addEventListener("keydown", e => {
  if (capaTeclas.hidden || !escuchando) return;
  const k = e.key.toLowerCase();
  if (k.length > 1 && k !== " ") return;      // solo teclas de carácter o espacio
  e.preventDefault();
  // Si la tecla ya era de otro hueco se intercambian, en vez de dejar a
  // alguien sin botón y por tanto sin poder jugar.
  const { i, accion } = escuchando;
  const previa = estado.teclas[i][accion];
  estado.teclas = estado.teclas.map((t, fi) => {
    const copia = { ...t };
    for (const { accion: a } of RANURAS) {
      if (fi === i && a === accion) copia[a] = k;
      else if (copia[a] === k) copia[a] = previa;
    }
    return copia;
  });
  almacen.guardarTeclas(estado.teclas);
  escuchando = null;
  abrirTeclas();
});

function nombreTecla(t) {
  if (!t) return "sin botón";
  return t === " " ? "ESPACIO" : t.toUpperCase();
}

/* ═════════ Teclado global ═════════
   Cuatro personas ocupan el teclado; buscar el ratón no es una opción. */

const PRIMARIO = { home: "#btn-new", grid: "#btn-go", result: "#btn-again" };

window.addEventListener("keydown", e => {
  reiniciarInactividad();

  if (e.key === "Escape") {
    if (!capaTeclas.hidden) { cerrarTeclas(); return; }
    if (!capaLamina.hidden) { capaLamina.hidden = true; return; }
    if (!capaStand.hidden) { capaStand.hidden = true; return; }
    if (estado.pantalla === "race") { pararCarrera(); ir("home"); return; }
    return;
  }

  // Ctrl+Shift+E abre el modo promotor desde cualquier sitio
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "e") {
    e.preventDefault();
    abrirStand();
    return;
  }

  if (e.key !== "Enter" || e.repeat) return;
  if (!capaTeclas.hidden || !capaStand.hidden || !capaLamina.hidden) return;
  if (e.target.matches("input, textarea, button")) return;
  const sel = PRIMARIO[estado.pantalla];
  if (sel) { e.preventDefault(); $(sel).click(); }
});

/* ═════════ Inactividad ═════════
   Si un grupo se va a mitad del registro, el que pasa después tiene que
   encontrar la portada y no el nombre a medio escribir de un desconocido. */

let relojInactividad = 0;

function reiniciarInactividad() {
  clearTimeout(relojInactividad);
  const vigilada = ["carrera", "setup", "enroll", "grid", "ranking"].includes(estado.pantalla);
  if (!vigilada) return;
  relojInactividad = setTimeout(() => {
    estado.jinetes = [];
    estado.idx = 0;
    ir("home");
  }, INACTIVIDAD);
}

["pointerdown", "keydown", "pointermove"].forEach(ev =>
  window.addEventListener(ev, reiniciarInactividad, { passive: true }));

/* ═════════ Arranque ═════════ */

window.addEventListener("resize", () => {
  if (estado.pantalla === "enroll") tablero.medir();
  if (estado.pantalla === "home") hero.remedir();
});

ir("home");
