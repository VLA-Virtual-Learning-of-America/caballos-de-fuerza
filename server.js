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

const RAIZ = import.meta.dirname;
const PUERTO = Number(process.env.PORT) || 4173;
const CARRILES = 4;

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
    enviar(con, { t: "sala", codigo, direcciones: direccionesLan(), puerto: PUERTO });
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
    let carril = null;
    for (let i = 0; i < CARRILES; i++) if (!sala.mandos.has(i)) { carril = i; break; }
    if (carril === null) { enviar(con, { t: "error", msg: "Los cuatro carriles están ocupados." }); return; }

    con.papel = "mando";
    con.sala = String(m.sala).toUpperCase();
    con.carril = carril;
    con.ficha = {
      nombre: String(m.nombre || "").slice(0, 18),
      telefono: String(m.telefono || "").slice(0, 24),
      correo: String(m.correo || "").slice(0, 60)
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

const servidor = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);

  if (url === "/api/red") {
    res.writeHead(200, { "Content-Type": TIPOS[".json"] });
    res.end(JSON.stringify({ direcciones: direccionesLan(), puerto: PUERTO }));
    return;
  }

  const relativa = url === "/" ? "/index.html"
    : url === "/mando" || url === "/mando/" ? "/mando.html"
    : url;
  const destino = path.normalize(path.join(RAIZ, relativa));
  if (!destino.startsWith(RAIZ)) { res.writeHead(403).end("Prohibido"); return; }

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
