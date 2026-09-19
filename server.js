/* ═══════════════════════════════════════════════════
   SERVIDOR DEL STAND — estático + sala en tiempo real
   ═══════════════════════════════════════════════════
   Uso:  node server.js  →  http://localhost:4173
   Sin dependencias: solo Node. En una feria, lo que no se instala no falla.

   Dos papeles se conectan a la misma sala:
     · la MESA  — el equipo con la pantalla grande, que corre el juego
     · los MANDOS — hasta cuatro celulares, que dibujan y aporrean botones

   El servidor no sabe jugar: solo reparte carriles y pasa mensajes. Toda
   la simulación vive en la mesa, en un único sitio, que es lo que hace
   que los cuatro jinetes vean exactamente la misma carrera.
*/

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { carreraPorId } from "./src/carreras.js";
import { EVENTO, premioPorPuesto } from "./src/config.js";

const RAIZ = import.meta.dirname;
const PUERTO = Number(process.env.PORT) || 4173;
const CARRILES = 4;

/* Persistencia best-effort, serializada para conservar el orden del journal. */
const DATA = path.resolve(process.env.DATA_DIR || "./data");
const WEBHOOK = process.env.BITRIX_WEBHOOK_URL || "";
const PANEL = process.env.PANEL_CLAVE || "";
const leads = new Map(), resultados = new Map(), voluntarios = Object.create(null);
let escritura = Promise.resolve();
const telefonoNormal = valor => {
  const n = String(valor || "").replace(/\D/g, "");
  return n.length === 8 ? "506" + n : n;
};
const codigoNormal = valor => {
  const c = String(valor || "").trim().toUpperCase();
  return /^[A-Z0-9_-]{2,20}$/.test(c) ? c : null;
};
function persistir(tarea) {
  escritura = escritura.then(tarea).catch(() => console.error("No se pudo persistir un evento local."));
}
function evento(datos) {
  persistir(() => fs.promises.appendFile(path.join(DATA, "leads.jsonl"), JSON.stringify(datos) + "\n"));
}
function guardarVoluntarios() {
  const texto = JSON.stringify(voluntarios);
  persistir(() => fs.promises.writeFile(path.join(DATA, "voluntarios.json"), texto));
}
try { await fs.promises.mkdir(DATA, { recursive: true }); } catch { console.error("DATA_DIR no disponible; se continúa en memoria."); }
try {
  const previos = JSON.parse(await fs.promises.readFile(path.join(DATA, "voluntarios.json"), "utf8"));
  for (const [c, v] of Object.entries(previos)) voluntarios[c] = { nombre: String(v.nombre || ""), leads: 0 };
} catch { /* primer arranque o disco efímero */ }
try {
  const journal = await fs.promises.readFile(path.join(DATA, "leads.jsonl"), "utf8");
  for (const linea of journal.split("\n")) {
    if (!linea.trim()) continue;
    try {
      const e = JSON.parse(linea);
      if (e.t === "lead") leads.set(e.telefono, { ...leads.get(e.telefono), ...e });
      if (e.t === "bitrix" && e.id && leads.has(e.telefono)) leads.get(e.telefono).bitrixId = e.id;
      if (e.t === "resultado") resultados.set(e.telefono, [...(resultados.get(e.telefono) || []), e]);
    } catch { console.error("Línea inválida en leads.jsonl; se omite."); }
  }
} catch { /* primer arranque */ }
for (const lead of leads.values()) {
  const c = lead.voluntario || "stand";
  voluntarios[c] ||= { nombre: "", leads: 0 };
  voluntarios[c].leads++;
}
if (!WEBHOOK) console.log("BITRIX_WEBHOOK_URL no configurado; se continúa sin Bitrix.");

function comentarios(lead) {
  const c = carreraPorId(lead.carrera);
  return `${EVENTO.nombre}\nCarrera: ${c ? c.nombre + " · " + c.cert : "sin carrera"}\nVoluntario: ${lead.voluntario || "stand"}\nOrigen: ${lead.origen}\nFecha: ${lead.fecha}`;
}
async function bitrix(metodo, datos) {
  if (!WEBHOOK) throw new Error("Bitrix no configurado");
  let r;
  try {
    r = await fetch(`${WEBHOOK.replace(/\/?$/, "/")}${metodo}.json`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos), signal: AbortSignal.timeout(15000)
    });
  } catch { throw new Error("Bitrix: conexión fallida o timeout"); }
  if (!r.ok) throw new Error(`Bitrix HTTP ${r.status}`);
  let d;
  try { d = await r.json(); } catch { throw new Error("Bitrix: respuesta inválida"); }
  if (d.error) throw new Error("Bitrix rechazó la operación");
  return d;
}
async function crearLeadBitrix(lead) {
  if (!WEBHOOK) return;
  try {
    const c = carreraPorId(lead.carrera);
    const d = await bitrix("crm.lead.add", { fields: {
      TITLE: `Sketch Race — ${lead.nombre} (${c?.nombre || "sin carrera"})`, NAME: lead.nombre,
      PHONE: [{ VALUE: "+" + lead.telefono, VALUE_TYPE: "MOBILE" }],
      EMAIL: [{ VALUE: lead.correo, VALUE_TYPE: "WORK" }],
      SOURCE_ID: "CONNECTOR_DAY_2026", STATUS_ID: "JUNK", ASSIGNED_BY_ID: 4391,
      UTM_SOURCE: lead.voluntario || "stand", UTM_CAMPAIGN: "sketch-race-connector-day",
      UTM_CONTENT: lead.carrera || "", COMMENTS: comentarios(lead)
    } });
    if (!/^\d+$/.test(String(d.result))) throw new Error("Bitrix: ID inválido");
    lead.bitrixId = d.result;
    evento({ t: "bitrix", telefono: lead.telefono, id: d.result });
  } catch (e) {
    evento({ t: "bitrix", telefono: lead.telefono, error: e.message });
    console.error(e.message);
  }
}
const actualizaciones = new Map();
function actualizarResultadoBitrix(telefono) {
  if (!WEBHOOK || !leads.get(telefono)?.bitrixId) return;
  const tarea = (actualizaciones.get(telefono) || Promise.resolve()).then(async () => {
    const lead = leads.get(telefono);
    const lineas = (resultados.get(telefono) || []).map(r =>
      `Resultado: ${r.puesto}.º en ${r.curso} (${r.tiempo === null ? "no llegó" : `${r.tiempo}s`}) · premio: ${premioPorPuesto(r.puesto).titulo}`);
    const d = await bitrix("crm.lead.update", { id: lead.bitrixId, fields: { COMMENTS: [comentarios(lead), ...lineas].join("\n") } });
    if (d.result !== true) throw new Error("Bitrix: actualización no confirmada");
  }).catch(e => { console.error(e.message); evento({ t: "bitrix", telefono, error: e.message }); });
  actualizaciones.set(telefono, tarea);
  tarea.finally(() => { if (actualizaciones.get(telefono) === tarea) actualizaciones.delete(telefono); });
}
function resumen(datos = voluntarios) {
  const filas = Object.entries(datos).map(([codigo, v]) => ({ codigo, ...v, pago: v.leads * EVENTO.pagoPorLead }));
  const total = filas.reduce((n, v) => n + v.leads, 0);
  return { voluntarios: filas, total, pagoTotal: total * EVENTO.pagoPorLead, pagoPorLead: EVENTO.pagoPorLead };
}
const json = (res, status, datos) => res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(datos));
function autorizarPanel(res, url) {
  if (!PANEL) { json(res, 503, { ok: false, error: "sin clave" }); return false; }
  if (url.searchParams.get("clave") !== PANEL) { json(res, 401, { ok: false, error: "Clave incorrecta" }); return false; }
  return true;
}
async function cuerpo(req) {
  const trozos = []; let bytes = 0;
  for await (const trozo of req) {
    bytes += trozo.length;
    if (bytes > 16384) throw new Error("JSON demasiado grande");
    trozos.push(trozo);
  }
  let d;
  try { d = JSON.parse(Buffer.concat(trozos).toString("utf8")); } catch { throw new Error("JSON inválido"); }
  if (!d || typeof d !== "object" || Array.isArray(d)) throw new Error("Se espera un objeto JSON");
  return d;
}
async function api(req, res, url) {
  const ruta = url.pathname;
  if (ruta.startsWith("/api/voluntarios") || ruta === "/voluntarios.html") {
    if (!autorizarPanel(res, url)) return true;
    if (ruta === "/voluntarios.html") return false;
  }
  if (!ruta.startsWith("/api/") || ruta === "/api/red") return false;
  try {
    if (ruta === "/api/lead" && req.method === "POST") {
      const d = await cuerpo(req), telefono = telefonoNormal(d.telefono);
      const nombre = String(d.nombre || "").trim(), correo = String(d.correo || "").trim();
      if (nombre.length < 2 || telefono.length < 8 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || d.consiente !== true)
        throw new Error("Nombre, teléfono, correo y consentimiento son obligatorios");
      if (d.carrera != null && !carreraPorId(d.carrera)) throw new Error("Carrera inválida");
      if (!["mando", "mesa"].includes(d.origen)) throw new Error("Origen inválido");
      const previo = leads.get(telefono);
      if (previo) {
        if (!previo.carrera && d.carrera) { previo.carrera = d.carrera; evento({ ...previo, t: "lead" }); }
        json(res, 200, { ok: true, duplicado: true }); return true;
      }
      const lead = { t: "lead", nombre, telefono, correo, consiente: true, carrera: d.carrera || null,
        voluntario: codigoNormal(d.voluntario), origen: d.origen, fecha: new Date().toISOString() };
      leads.set(telefono, lead); evento(lead);
      const codigo = lead.voluntario || "stand";
      voluntarios[codigo] ||= { nombre: "", leads: 0 };
      voluntarios[codigo].leads++; guardarVoluntarios();
      json(res, 200, { ok: true, duplicado: false }); void crearLeadBitrix(lead); return true;
    }
    if (ruta === "/api/resultado" && req.method === "POST") {
      const d = await cuerpo(req), telefono = telefonoNormal(d.telefono);
      if (telefono.length < 8 || !Number.isInteger(d.puesto) || d.puesto < 1 || d.puesto > 4 ||
          (d.tiempo !== null && (!Number.isFinite(d.tiempo) || d.tiempo < 0)) || typeof d.curso !== "string" || !d.curso.trim()) throw new Error("Resultado inválido");
      const r = { t: "resultado", telefono, nombre: String(d.nombre || ""), puesto: d.puesto, tiempo: d.tiempo,
        carrera: carreraPorId(d.carrera)?.id || null, curso: d.curso, fecha: new Date().toISOString() };
      resultados.set(telefono, [...(resultados.get(telefono) || []), r]); evento(r);
      json(res, 200, { ok: true });
      if (leads.get(telefono)?.bitrixId) actualizarResultadoBitrix(telefono);
      else if (WEBHOOK) setTimeout(() => actualizarResultadoBitrix(telefono), 20000).unref();
      return true;
    }
    if (ruta === "/api/voluntarios" && req.method === "POST") {
      const d = await cuerpo(req), codigo = codigoNormal(d.codigo);
      if (!codigo || typeof d.nombre !== "string") throw new Error("Código o nombre inválido");
      voluntarios[codigo] = { nombre: d.nombre.trim().slice(0, 100), leads: voluntarios[codigo]?.leads || 0 };
      guardarVoluntarios(); json(res, 200, { ok: true }); return true;
    }
    if (ruta === "/api/voluntarios" && req.method === "GET") { json(res, 200, resumen()); return true; }
    if (ruta === "/api/voluntarios/bitrix" && req.method === "GET") {
      if (!WEBHOOK) { json(res, 503, { ok: false, error: "Bitrix no configurado" }); return true; }
      const conteo = Object.create(null), vistos = new Set(), paginas = new Set();
      for (const [c, v] of Object.entries(voluntarios)) conteo[c] = { nombre: v.nombre, leads: 0 };
      let start = 0;
      try {
        do {
          if (paginas.has(start)) throw new Error("Bitrix: paginación inválida");
          paginas.add(start);
          const d = await bitrix("crm.lead.list", { filter: { SOURCE_ID: "CONNECTOR_DAY_2026" }, select: ["ID", "UTM_SOURCE", "PHONE"], start });
          if (!Array.isArray(d.result)) throw new Error("Bitrix: lista inválida");
          for (const lead of d.result) {
            const telefono = telefonoNormal(lead.PHONE?.[0]?.VALUE);
            const key = telefono || `id:${lead.ID}`;
            if (vistos.has(key)) continue;
            vistos.add(key);
            const c = codigoNormal(lead.UTM_SOURCE) || "stand";
            const codigo = String(lead.UTM_SOURCE).toLowerCase() === "stand" ? "stand" : c;
            conteo[codigo] ||= { nombre: voluntarios[codigo]?.nombre || "", leads: 0 };
            conteo[codigo].leads++;
          }
          start = d.next;
        } while (start != null);
        json(res, 200, { ...resumen(conteo), fuente: "bitrix" });
      } catch (e) { console.error(e.message); json(res, 502, { ok: false, error: e.message }); }
      return true;
    }
    if (ruta === "/api/voluntarios.csv" && req.method === "GET") {
      const celda = v => '"' + String(v).replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
      const csv = ["codigo,nombre,leads,pago", ...resumen().voluntarios.map(v => [v.codigo, v.nombre, v.leads, v.pago].map(celda).join(","))].join("\r\n");
      res.writeHead(200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="voluntarios.csv"', "Cache-Control": "no-store" }).end(csv); return true;
    }
    json(res, 404, { ok: false, error: "Endpoint o método no disponible" });
  } catch (e) { json(res, 400, { ok: false, error: e.message }); }
  return true;
}

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

/* ───────── Direcciones en las que se puede entrar desde un celular ───────── */

function direccionesLan() {
  const salida = [];
  for (const [, redes] of Object.entries(os.networkInterfaces())) {
    for (const r of redes || []) {
      if (r.family === "IPv4" && !r.internal) salida.push(r.address);
    }
  }
  // Las 192.168.x suelen ser la del router del stand: van primero
  return salida.sort((a, b) => (b.startsWith("192.168.") ? 1 : 0) - (a.startsWith("192.168.") ? 1 : 0));
}

/* En un hosting con dominio público (Railway) las IPs de red del
   contenedor son internas y un celular nunca las alcanza. Si existe
   RAILWAY_PUBLIC_DOMAIN, esa es la única dirección real; si no, se sigue
   usando la LAN del stand como siempre. */
const DOMINIO_PUBLICO = process.env.RAILWAY_PUBLIC_DOMAIN || null;

/* ───────── Salas ───────── */

/** codigo → { mesa, mandos: Map(carril → conexion) } */
const salas = new Map();

const nuevoCodigo = () => {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ";   // sin I ni O, que se confunden
  let c;
  do { c = Array.from({ length: 4 }, () => letras[Math.floor(Math.random() * letras.length)]).join(""); }
  while (salas.has(c));
  return c;
};

function enviar(con, obj) {
  if (!con || con.destruida) return;
  try { con.socket.write(tramaTexto(JSON.stringify(obj))); } catch { /* se cayó */ }
}

function aLaMesa(sala, obj) { enviar(sala?.mesa, obj); }

function soltarMando(con) {
  const sala = salas.get(con.sala);
  if (!sala || con.carril == null) return;
  if (sala.mandos.get(con.carril) === con) {
    sala.mandos.delete(con.carril);
    aLaMesa(sala, { t: "fuera", carril: con.carril });
  }
}

function manejarMensaje(con, texto) {
  let m;
  try { m = JSON.parse(texto); } catch { return; }

  /* La mesa abre la sala */
  if (m.t === "mesa") {
    const codigo = m.sala && salas.has(m.sala) ? m.sala : nuevoCodigo();
    const previa = salas.get(codigo);
    if (previa && previa.mesa && previa.mesa !== con) previa.mesa.destruida = true;
    const sala = previa || { mesa: null, mandos: new Map() };
    sala.mesa = con;
    salas.set(codigo, sala);
    con.papel = "mesa";
    con.sala = codigo;
    enviar(con, { t: "sala", codigo, direcciones: direccionesLan(), puerto: PUERTO, publico: DOMINIO_PUBLICO });
    // Si ya había mandos esperando, la mesa se entera de todos
    for (const [carril, mando] of sala.mandos) {
      aLaMesa(sala, { t: "jinete", carril, ...mando.ficha });
      if (mando.dibujo) aLaMesa(sala, { t: "dibujo", carril, trazos: mando.dibujo });
      if (mando.listo) aLaMesa(sala, { t: "listo", carril });
    }
    return;
  }

  /* Un celular entra a la sala */
  if (m.t === "unirse") {
    const sala = salas.get(String(m.sala || "").toUpperCase());
    if (!sala) { enviar(con, { t: "error", msg: "Esa sala no existe. Revise el código." }); return; }
    if (con.papel === "mando" && con.sala === String(m.sala).toUpperCase() && sala.mandos.get(con.carril) === con) {
      enviar(con, { t: "bienvenida", carril: con.carril }); return;
    }
    if (con.papel === "mando") soltarMando(con);
    let carril = null;
    for (let i = 0; i < CARRILES; i++) if (!sala.mandos.has(i)) { carril = i; break; }
    if (carril === null) { enviar(con, { t: "error", msg: "Los cuatro carriles están ocupados." }); return; }

    con.papel = "mando";
    con.sala = String(m.sala).toUpperCase();
    con.carril = carril;
    con.ficha = {
      nombre: String(m.nombre || "").slice(0, 18),
      telefono: String(m.telefono || "").slice(0, 24),
      correo: String(m.correo || "").slice(0, 60),
      carrera: carreraPorId(m.carrera)?.id || null,
      sticker: carreraPorId(m.carrera)?.sticker || null,
      voluntario: codigoNormal(m.voluntario)
    };
    sala.mandos.set(carril, con);
    enviar(con, { t: "bienvenida", carril });
    aLaMesa(sala, { t: "jinete", carril, ...con.ficha });
    return;
  }

  const sala = salas.get(con.sala);
  if (!sala) return;

  /* De la mesa a los mandos */
  if (con.papel === "mesa") {
    if (m.t === "fase" || m.t === "marcador") {
      if (m.carril == null) for (const mando of sala.mandos.values()) enviar(mando, m);
      else enviar(sala.mandos.get(m.carril), m);
    }
    if (m.t === "cerrar") {
      for (const mando of sala.mandos.values()) enviar(mando, { t: "fase", fase: "fin" });
    }
    return;
  }

  /* De un mando a la mesa */
  if (con.carril == null) return;
  if (m.t === "dibujo") { con.dibujo = m.trazos; aLaMesa(sala, { t: "dibujo", carril: con.carril, trazos: m.trazos }); }
  else if (m.t === "listo") { con.listo = true; aLaMesa(sala, { t: "listo", carril: con.carril }); }
  else if (m.t === "accion") aLaMesa(sala, { t: "accion", carril: con.carril, a: m.a });
  else if (m.t === "salir") soltarMando(con);
}

/* ───────── WebSocket a pelo (sin librerías) ───────── */

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function tramaTexto(texto) {
  const datos = Buffer.from(texto, "utf8");
  const n = datos.length;
  let cab;
  if (n < 126) { cab = Buffer.from([0x81, n]); }
  else if (n < 65536) { cab = Buffer.alloc(4); cab[0] = 0x81; cab[1] = 126; cab.writeUInt16BE(n, 2); }
  else { cab = Buffer.alloc(10); cab[0] = 0x81; cab[1] = 127; cab.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([cab, datos]);
}

const tramaControl = op => Buffer.from([0x80 | op, 0]);

/** Saca las tramas completas que haya en el buffer y devuelve lo que sobra. */
function leerTramas(buf) {
  const tramas = [];
  let i = 0;
  while (i + 2 <= buf.length) {
    const b0 = buf[i], b1 = buf[i + 1];
    const fin = (b0 & 0x80) !== 0;
    const op = b0 & 0x0f;
    const enmascarado = (b1 & 0x80) !== 0;
    let largo = b1 & 0x7f;
    let off = i + 2;
    if (largo === 126) { if (buf.length < off + 2) break; largo = buf.readUInt16BE(off); off += 2; }
    else if (largo === 127) { if (buf.length < off + 8) break; largo = Number(buf.readBigUInt64BE(off)); off += 8; }
    let mascara = null;
    if (enmascarado) { if (buf.length < off + 4) break; mascara = buf.subarray(off, off + 4); off += 4; }
    if (buf.length < off + largo) break;
    let datos = buf.subarray(off, off + largo);
    if (mascara) {
      const d = Buffer.allocUnsafe(largo);
      for (let k = 0; k < largo; k++) d[k] = datos[k] ^ mascara[k & 3];
      datos = d;
    }
    tramas.push({ op, fin, datos });
    i = off + largo;
  }
  return { tramas, resto: buf.subarray(i) };
}

function atenderSocket(req, socket) {
  const clave = req.headers["sec-websocket-key"];
  if (!clave) { socket.destroy(); return; }
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
    "Upgrade: websocket\r\n" +
    "Connection: Upgrade\r\n" +
    `Sec-WebSocket-Accept: ${crypto.createHash("sha1").update(clave + GUID).digest("base64")}\r\n\r\n`
  );
  socket.setNoDelay(true);   // sin Nagle: es un juego de ritmo

  const con = { socket, papel: null, sala: null, carril: null, destruida: false };
  let pendiente = Buffer.alloc(0);
  let trozos = [];            // para mensajes partidos en varias tramas

  socket.on("data", chunk => {
    pendiente = Buffer.concat([pendiente, chunk]);
    const { tramas, resto } = leerTramas(pendiente);
    pendiente = resto;
    for (const t of tramas) {
      if (t.op === 0x8) { socket.end(tramaControl(0x8)); return; }
      if (t.op === 0x9) { socket.write(tramaControl(0xA)); continue; }
      if (t.op === 0xA) continue;
      if (t.op === 0x0 || t.op === 0x1) {
        trozos.push(t.datos);
        if (!t.fin) continue;
        const texto = Buffer.concat(trozos).toString("utf8");
        trozos = [];
        try { manejarMensaje(con, texto); } catch (e) { console.error("mensaje:", e.message); }
      }
    }
  });

  const adios = () => {
    con.destruida = true;
    if (con.papel === "mando") soltarMando(con);
    if (con.papel === "mesa") {
      const sala = salas.get(con.sala);
      if (sala && sala.mesa === con) sala.mesa = null;
    }
  };
  socket.on("close", adios);
  socket.on("error", adios);
}

/* ───────── HTTP ───────── */

const servidor = http.createServer(async (req, res) => {
  let direccion, url;
  try {
    direccion = new URL(req.url, "http://localhost");
    url = decodeURIComponent(direccion.pathname).replaceAll("\\", "/");
    direccion.pathname = new URL(url, "http://localhost").pathname;
    url = decodeURIComponent(direccion.pathname);
  }
  catch { res.writeHead(400).end("URL inválida"); return; }
  if (await api(req, res, direccion)) return;

  if (url === "/api/red") {
    res.writeHead(200, { "Content-Type": TIPOS[".json"] });
    res.end(JSON.stringify({ direcciones: direccionesLan(), puerto: PUERTO, publico: DOMINIO_PUBLICO }));
    return;
  }

  const relativa = url === "/" ? "/index.html"
    : url === "/mando" || url === "/mando/" ? "/mando.html"
    : url === "/qr" || url === "/qr/" ? "/qr.html"
    : url;
  const destino = path.normalize(path.join(RAIZ, relativa));
  const rel = path.relative(RAIZ, destino);
  const datosRel = path.relative(DATA, destino);
  // Windows no distingue mayúsculas; proteger también la ruta física final.
  if (rel.toLowerCase() === "voluntarios.html" && !autorizarPanel(res, direccion)) return;
  if (rel.startsWith("..") || path.isAbsolute(rel) || rel.split(path.sep)[0] === "data" || rel.split(path.sep).some(p => p.startsWith(".")) ||
      (!datosRel.startsWith("..") && !path.isAbsolute(datosRel)) ||
      ![".html", ".css", ".js", ".json", ".woff2", ".png", ".svg", ".ico"].includes(path.extname(destino))) {
    res.writeHead(403).end("Prohibido"); return;
  }

  fs.readFile(destino, (err, datos) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("No existe"); return; }
    res.writeHead(200, {
      "Content-Type": TIPOS[path.extname(destino).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(datos);
  });
});

servidor.on("upgrade", (req, socket) => {
  if (req.url.split("?")[0] !== "/ws") { socket.destroy(); return; }
  atenderSocket(req, socket);
});

servidor.listen(PUERTO, "0.0.0.0", () => {
  const ips = direccionesLan();
  console.log("\n  🐴  Caballos de Fuerza — VLA\n");
  console.log(`      Mesa:    http://localhost:${PUERTO}`);
  if (ips.length) {
    console.log(`      Mandos:  http://${ips[0]}:${PUERTO}/mando`);
    if (ips.length > 1) console.log(`               (otras redes: ${ips.slice(1).join(", ")})`);
  } else {
    console.log("      Mandos:  este equipo no está en ninguna red; los celulares no podrán entrar.");
  }
  console.log("");
});
