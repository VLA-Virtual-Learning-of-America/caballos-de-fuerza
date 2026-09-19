// Integración sin dependencias. Datos y Bitrix exclusivamente locales y ficticios.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import http from "node:http";
import { once } from "node:events";

const raiz = path.resolve(import.meta.dirname, "..");
const data = await mkdtemp(path.join(tmpdir(), "sr-connector-"));
let servidor, puerto = 4173, mock;
const sockets = [];
const pausa = ms => new Promise(r => setTimeout(r, ms));
async function arrancar(extra = {}) {
  let log = "";
  servidor = spawn(process.execPath, ["server.js"], { cwd: raiz, windowsHide: true,
    env: { ...process.env, PORT: String(puerto), DATA_DIR: data, BITRIX_WEBHOOK_URL: "", PANEL_CLAVE: "x", ...extra }, stdio: ["ignore", "pipe", "pipe"] });
  servidor.stdout.on("data", b => log += b); servidor.stderr.on("data", b => log += b);
  for (let i = 0; i < 100; i++) {
    if (log.includes("Mesa:")) return;
    if (servidor.exitCode !== null) {
      if (log.includes("EADDRINUSE") && puerto === 4173) { puerto = 4180; return arrancar(extra); }
      throw new Error(log);
    }
    await pausa(50);
  }
  throw new Error("El servidor no arrancó: " + log);
}
async function parar() {
  if (!servidor || servidor.exitCode !== null) return;
  const cerrado = once(servidor, "exit"); servidor.kill(); await cerrado;
}
async function curl(ruta, body) {
  const args = ["-sS", "--max-time", "5", "-w", "\nHTTP %{http_code}"];
  if (body) {
    const archivo = path.join(data, "request.json"); await writeFile(archivo, JSON.stringify(body));
    args.push("-H", "Content-Type: application/json", "--data-binary", "@" + archivo);
  }
  args.push(`http://127.0.0.1:${puerto}${ruta}`);
  return execFileSync("curl.exe", args, { encoding: "utf8", windowsHide: true });
}
async function api(ruta, body) {
  const r = await fetch(`http://127.0.0.1:${puerto}${ruta}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  return { status: r.status, data: await r.json() };
}
const lead = { nombre: "Prueba local", telefono: "8888 1234", correo: "prueba@example.test", consiente: true, carrera: "aws", voluntario: "ana01", origen: "mando" };
const resultado = { telefono: lead.telefono, nombre: lead.nombre, puesto: 1, tiempo: 11.63, carrera: "aws", curso: "100 llanos" };
try {
  await arrancar(); console.log(`Servidor de prueba: ${puerto}; sin BITRIX_WEBHOOK_URL`);
  for (const [titulo, ruta, body] of [
    ["Lead nuevo", "/api/lead", lead], ["Lead duplicado", "/api/lead", { ...lead, telefono: "+50688881234" }],
    ["Voluntarios", "/api/voluntarios?clave=x"], ["Resultado", "/api/resultado", resultado]
  ]) console.log(titulo + "\n" + await curl(ruta, body));
  assert.equal((await api("/api/voluntarios?clave=x")).data.total, 1);
  for (const ruta of ["/voluntarios.html?clave=x", "/mando?v=ANA01", "/voluntarios.html", "/%76oluntarios.html", "/VOLUNTARIOS.html", "/%2576oluntarios.html", "/data/leads.jsonl", "/blindaje.json"]) {
    const status = Number(execFileSync("curl.exe", ["-sS", "--max-time", "5", "-o", "NUL", "-w", "%{http_code}", `http://127.0.0.1:${puerto}${ruta}`], { encoding: "utf8", windowsHide: true }));
    console.log(`GET ${ruta} -> ${status}`);
    assert.equal(status, ["/voluntarios.html", "/%76oluntarios.html", "/VOLUNTARIOS.html", "/%2576oluntarios.html"].includes(ruta) ? 401 : ruta === "/data/leads.jsonl" ? 403 : 200);
  }
  assert.equal((await api("/api/lead", { ...lead, consiente: false })).status, 400);
  assert.equal((await api("/api/voluntarios?clave=no")).status, 401);
  assert.equal((await api("/api/voluntarios/bitrix?clave=x")).status, 503);
  await api("/api/voluntarios?clave=x", { codigo: "ana01", nombre: "Ana" });
  await pausa(100); await parar(); await arrancar();
  const restaurado = (await api("/api/voluntarios?clave=x")).data;
  assert.equal(restaurado.total, 1); assert.equal(restaurado.voluntarios[0].nombre, "Ana");
  assert.equal((await api("/api/lead", lead)).data.duplicado, true);
  console.log("OK: validación, autorización, CSV, dedupe normalizado y reconstrucción tras reinicio.");
  assert.match(await curl("/api/voluntarios.csv?clave=x"), /"ANA01","Ana","1","2"/);

  if (typeof WebSocket !== "undefined") {
    const abrir = async () => { const ws = new WebSocket(`ws://127.0.0.1:${puerto}/ws`); sockets.push(ws); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; }); return ws; };
    const recibir = (ws, t) => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout WS " + t)), 3000);
      const handler = e => { const m = JSON.parse(e.data); if (m.t === t) { clearTimeout(timeout); ws.removeEventListener("message", handler); resolve(m); } };
      ws.addEventListener("message", handler);
    });
    const mesa = await abrir(), sala = recibir(mesa, "sala"); mesa.send(JSON.stringify({ t: "mesa" }));
    const codigo = (await sala).codigo, mando = await abrir(), jinete = recibir(mesa, "jinete");
    mando.send(JSON.stringify({ t: "unirse", sala: codigo, ...lead, sticker: "AWS" }));
    const j = await jinete; assert.equal(j.carrera, "aws"); assert.equal(j.sticker, "AWS"); assert.equal(j.voluntario, "ANA01");
    const marcador = recibir(mando, "marcador"); mesa.send(JSON.stringify({ t: "marcador", carril: j.carril, puesto: 2, tiempo: 12.5, final: true }));
    assert.equal((await marcador).final, true);
    for (const ws of sockets) ws.close();
    console.log("OK: relay WebSocket carrera, sticker, voluntario y marcador final.");
  }
  await parar(); await arrancar({ PANEL_CLAVE: "" });
  assert.equal((await api("/api/voluntarios?clave=x")).status, 503);
  await parar();

  const llamadas = [];
  mock = http.createServer(async (req, res) => {
    let texto = ""; for await (const b of req) texto += b;
    const body = JSON.parse(texto); llamadas.push({ url: req.url, body });
    let respuesta;
    if (req.url.includes("add")) { await pausa(350); respuesta = body.fields.PHONE[0].VALUE.endsWith("2222") ? { error: "ERROR_SIMULADO" } : { result: 123 }; }
    else if (req.url.includes("update")) respuesta = { result: true };
    else respuesta = body.start === 0 ? { result: [{ ID: "1", UTM_SOURCE: "ANA01", PHONE: [{ VALUE: "88881234" }] }], next: 50 }
      : { result: [{ ID: "2", UTM_SOURCE: "ANA01", PHONE: [{ VALUE: "+50688881234" }] }, { ID: "3", UTM_SOURCE: "BOB02", PHONE: [{ VALUE: "88889999" }] }] };
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(respuesta));
  });
  mock.listen(0, "127.0.0.1"); await once(mock, "listening");
  await arrancar({ BITRIX_WEBHOOK_URL: `http://127.0.0.1:${mock.address().port}/` });
  const nuevo = { ...lead, telefono: "88881111", carrera: null };
  const inicio = Date.now(); await api("/api/lead", nuevo); assert.ok(Date.now() - inicio < 350);
  await api("/api/lead", { ...nuevo, carrera: "cyber" });
  await api("/api/resultado", { ...resultado, telefono: nuevo.telefono });
  await pausa(500);
  assert.equal(llamadas.filter(l => l.url.includes("add")).length, 1);
  const fields = llamadas.find(l => l.url.includes("add")).body.fields;
  assert.equal(fields.ASSIGNED_BY_ID, 4391); assert.equal(fields.SOURCE_ID, "CONNECTOR_DAY_2026"); assert.equal(fields.PHONE[0].VALUE, "+50688881111");
  const recuento = (await api("/api/voluntarios/bitrix?clave=x")).data;
  assert.equal(recuento.total, 2); assert.equal(recuento.fuente, "bitrix");
  console.log("OK: Bitrix simulado, respuesta inmediata, alta única y recuento paginado con dedupe. Esperando reintento de resultado a los 20 s…");
  await pausa(20000);
  assert.ok(llamadas.some(l => l.url.includes("update") && l.body.fields.COMMENTS.includes("Resultado: 1.º en 100 llanos (11.63s) · premio: $100 en créditos VLA")));
  await pausa(100);
  const eventos = (await readFile(path.join(data, "leads.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
  assert.ok(eventos.some(e => e.t === "bitrix" && e.id === 123));
  console.log("OK: resultado pendiente actualizado a los 20 s, comentarios y journal de Bitrix.");
  assert.equal((await api("/api/lead", { ...lead, telefono: "88882222" })).data.ok, true);
  await pausa(500);
  const fallidos = (await readFile(path.join(data, "leads.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
  assert.ok(fallidos.some(e => e.t === "bitrix" && e.telefono === "50688882222" && e.error));
  assert.equal((await api("/api/lead", { ...lead, telefono: "88882222" })).data.duplicado, true);
  console.log("OK: error de Bitrix persistido sin romper respuesta ni duplicar el lead.");
} finally {
  for (const ws of sockets) ws.close();
  await parar(); if (mock) await new Promise(r => mock.close(r));
  console.log("Servidores de prueba detenidos. Datos ficticios: " + data);
}
