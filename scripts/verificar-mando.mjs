// Prueba de lógica del mando con DOM mínimo; no sustituye la revisión visual.
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { CARRERAS, carreraPorId, NOTA_SALARIOS } from "../src/carreras.js";
import { stickerPorCodigo } from "../src/stickers.js";
import { EVENTO, premioPorPuesto, linkWhatsApp, mensajePremio, mensajeWebinar } from "../src/config.js";
const html = await readFile(new URL("../mando.html", import.meta.url), "utf8");
const source = (await readFile(new URL("../src/mando.js", import.meta.url), "utf8")).replace(/^import .*;\r?\n/gm, "");
function entorno(url, guardado, fallaFetch = false) {
  const elements = [], ids = new Map(), requests = [], sent = [], storage = new Map(guardado ? [["sr-perfil-v1", JSON.stringify(guardado)]] : []);
  class Elemento {
    constructor(tag = "div") {
      this.tag = tag; this.children = []; this.events = {}; this.value = ""; this.checked = false; this.style = { setProperty() {} };
      this.className = ""; elements.push(this);
      this.classList = { toggle: (c, on) => { const all = new Set(this.className.split(" ")); if (on) all.add(c); else all.delete(c); this.className = [...all].join(" "); }, remove: c => this.classList.toggle(c, false) };
    }
    append(...items) { for (const item of items) { if (this.children.length) this.children.at(-1).nextElementSibling = item; this.children.push(item); } }
    prepend(item) { this.children.unshift(item); }
    replaceChildren(...items) { this.children = []; this.append(...items); }
    cloneNode() { return new Elemento(this.tag); }
    setAttribute() {} toggleAttribute() {} getContext() { return {}; }
    addEventListener(t, fn) { (this.events[t] ||= []).push(fn); }
    async fire(t, props = {}) { for (const f of this.events[t] || []) await f({ preventDefault() {}, ...props }); }
    reset() { for (const e of elements) { e.value = ""; e.checked = false; } }
  }
  for (const match of html.matchAll(/<([a-z0-9]+)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)) {
    const el = new Elemento(match[1]); el.id = match[3]; el.className = match[2].match(/class="([^"]+)"/)?.[1] || ""; ids.set(el.id, el);
  }
  const header = new Elemento("header");
  const queryAll = sel => elements.filter(e => sel === ".m-pantalla" ? e.className.split(" ").includes("m-pantalla") : sel === ".route-radio" ? e.className === "route-radio" : sel === ".route.selected" ? e.className.includes("selected") : false);
  const document = { querySelector: s => s === "#m-entrar .m-cabecera" ? header : s === "input[name=carrera]:checked" ? elements.find(e => e.name === "carrera" && e.checked) : ids.get(s.slice(1)),
    querySelectorAll: queryAll, createElement: t => new Elemento(t), createTextNode: text => ({ textContent: text }), documentElement: new Elemento(), addEventListener() {} };
  class WS extends Elemento {
    static OPEN = 1; static CONNECTING = 0;
    constructor() { super(); this.readyState = 0; queueMicrotask(() => { this.readyState = 1; void this.fire("open"); }); }
    send(s) { sent.push(JSON.parse(s)); }
  }
  const location = new URL(url); location.reload = () => {};
  const ctx = vm.createContext({ document, location, history: { replaceState: (_a, _b, u) => { location.href = u.href; } }, window: { addEventListener() {} }, navigator: {},
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    URL, URLSearchParams, AbortController, setTimeout, clearTimeout, WebSocket: WS, requestAnimationFrame: fn => fn(), confirm: () => true,
    fetch: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); if (fallaFetch) throw new Error("offline"); return { ok: true }; },
    crearHero: () => ({ arrancar() {}, remedir() {} }), normalizar: v => v, caballoDeMuestra: () => [], miniatura() {},
    crearTablero: () => ({ medir() {}, vacio: () => false, trazos: () => [], deshacer() {}, limpiar() {}, prestar() {} }),
    CARRERAS, carreraPorId, NOTA_SALARIOS, stickerPorCodigo, EVENTO, premioPorPuesto, linkWhatsApp, mensajePremio, mensajeWebinar });
  vm.runInContext(source, ctx);
  return { ctx, ids, elements, storage, requests, sent, location, phase: () => vm.runInContext("estado.fase", ctx), receive: obj => vm.runInContext(`recibir(${JSON.stringify(obj)})`, ctx),
    choose: id => { for (const e of elements.filter(e => e.name === "carrera")) e.checked = e.value === id; } };
}
const perfil = { nombre: "Ana", telefono: "50688881234", correo: "ana@example.test", carrera: "aws", voluntario: "ANA01" };
const e = entorno("http://localhost/mando?v=ana01", null, true);
assert.equal(JSON.parse(e.storage.get("sr-perfil-v1")).voluntario, "ANA01");
e.ids.get("m-nombre").value = "Ana"; e.ids.get("m-tel").value = "88881234"; e.ids.get("m-correo").value = perfil.correo; e.ids.get("m-consent").checked = true;
await e.ids.get("m-ficha").fire("submit"); assert.equal(e.requests.length, 0);
e.choose("aws"); await e.ids.get("m-ficha").fire("submit");
assert.equal(e.phase(), "sala"); assert.equal(e.requests[0].body.telefono, "50688881234"); assert.equal(e.requests[0].body.voluntario, "ANA01");
e.ids.get("m-codigo").value = "abcd"; await e.ids.get("m-elegir-sala").fire("submit");
assert.equal(e.sent[0].carrera, "aws"); assert.equal(e.sent[0].sticker, "AWS"); assert.equal(e.location.searchParams.get("s"), "ABCD"); assert.equal(e.location.searchParams.get("v"), "ana01");
e.receive({ t: "fase", fase: "fin" }); assert.equal(e.ids.get("m-fin-puesto").textContent, "4.º");
e.receive({ t: "marcador", puesto: 2, meta: 12.5, final: true });
e.receive({ t: "marcador", puesto: 3, meta: 13 });
assert.equal(e.ids.get("m-fin-puesto").textContent, "2.º"); assert.equal(e.ids.get("m-fin-tiempo").textContent, "12.50 s");
assert.ok(decodeURIComponent(e.ids.get("m-reclamar").href).includes("$75 en créditos VLA"));
assert.ok(e.ids.get("m-webinar").href.startsWith("https://wa.me/"));
const volver = entorno("http://localhost/mando?s=ABCD", perfil);
assert.equal(volver.phase(), "volver"); assert.equal(volver.ids.get("m-tel").value, "88881234");
await volver.ids.get("m-volver-entrar").fire("click"); assert.equal(volver.sent[0].voluntario, "ANA01");
await volver.ids.get("m-no-soy").fire("click"); assert.equal(volver.phase(), "entrar"); assert.equal(volver.storage.has("sr-perfil-v1"), false);
const nuevoQR = entorno("http://localhost/mando?v=bob02&s=ABCD", perfil);
assert.equal(JSON.parse(nuevoQR.storage.get("sr-perfil-v1")).voluntario, "BOB02");
const logos = e.elements.filter(el => el.tag === "img").map(el => el.src);
assert.ok(!logos.some(src => /AIB|PMP/.test(src)));
console.log("OK: carrera obligatoria, perfil y atribución, teléfono sin doble prefijo, registro offline, sala manual, regreso y No soy yo.");
console.log("OK: unirse con carrera/sticker, URL conservada, premio 4.º sin marcador, marcador final prioritario, tiempo y CTA WhatsApp/webinar.");
console.log("OK: solo logos CYB, AWS y CCNA. Prueba de lógica con DOM simulado; no verifica layout ni cámaras reales.");
