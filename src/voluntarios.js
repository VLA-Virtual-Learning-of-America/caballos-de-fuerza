import { pintarQR } from "./qr.js";

const $ = s => document.querySelector(s);
const clave = new URLSearchParams(location.search).get("clave") || "";
let datos = null;
const urlApi = ruta => `${ruta}?clave=${encodeURIComponent(clave)}`;
const dinero = n => new Intl.NumberFormat("es-CR", { style: "currency", currency: "USD" }).format(n);
async function pedir(ruta, opciones = {}) {
  const r = await fetch(urlApi(ruta), { ...opciones, signal: AbortSignal.timeout(120000) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "No se pudo consultar el servidor");
  return d;
}
function tarjeta(v) {
  const card = document.createElement("div"); card.className = "qr-tarjeta";
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 600;
  const url = `${location.origin}/mando?v=${encodeURIComponent(v.codigo)}`;
  pintarQR(canvas, url, { claro: "#ffffff", oscuro: "#000000" });
  const codigo = document.createElement("p"); codigo.className = "qr-codigo"; codigo.textContent = v.codigo;
  const nombre = document.createElement("p"); nombre.textContent = v.nombre;
  const direccion = document.createElement("p"); direccion.className = "qr-url"; direccion.textContent = url;
  card.append(canvas, codigo, nombre, direccion); return card;
}
function mostrar(d) {
  datos = d;
  $("#v-filas").replaceChildren();
  for (const v of d.voluntarios) {
    const fila = document.createElement("tr");
    for (const valor of [v.codigo, v.nombre, v.leads, dinero(v.pago)]) {
      const td = document.createElement("td"); td.textContent = valor; fila.append(td);
    }
    const td = document.createElement("td"), boton = document.createElement("button"); boton.className = "m-chico"; boton.textContent = "QR";
    boton.addEventListener("click", () => {
      try { $("#v-qr").replaceChildren(tarjeta(v)); $("#v-qr").hidden = false; $("#v-qr").scrollIntoView({ behavior: "smooth" }); }
      catch (e) { $("#v-estado").textContent = e.message; }
    });
    // Link propio del voluntario: lo abre en su celular y muestra su QR sin necesitar la clave del panel.
    const propio = `${location.origin}/qr?v=${encodeURIComponent(v.codigo)}&n=${encodeURIComponent(v.nombre || "")}`;
    const enviar = document.createElement("a"); enviar.className = "m-chico"; enviar.textContent = "Enviar";
    enviar.href = `https://wa.me/?text=${encodeURIComponent(`Tu QR de voluntario para $ketch Race (abrilo en tu celular y mostralo): ${propio}`)}`;
    enviar.target = "_blank"; enviar.rel = "noopener";
    const copiar = document.createElement("button"); copiar.className = "m-chico"; copiar.textContent = "Copiar link";
    copiar.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(propio); copiar.textContent = "Copiado"; setTimeout(() => { copiar.textContent = "Copiar link"; }, 1500); }
      catch { $("#v-estado").textContent = propio; }
    });
    td.style.whiteSpace = "nowrap"; td.append(boton, " ", enviar, " ", copiar); fila.append(td); $("#v-filas").append(fila);
  }
  $("#v-total").textContent = d.total; $("#v-pago").textContent = dinero(d.pagoTotal);
  $("#v-tarifa").textContent = `${dinero(d.pagoPorLead)} por lead válido`;
  $("#v-estado").textContent = d.fuente === "bitrix" ? "Conteo desde Bitrix. El CSV descargará este conteo." : "Conteo local del stand.";
}
async function cargar(bitrix = false) {
  $("#v-estado").textContent = "Consultando…"; $("#v-recontar").disabled = true;
  try { mostrar(await pedir(bitrix ? "/api/voluntarios/bitrix" : "/api/voluntarios")); }
  catch (e) { $("#v-estado").textContent = e.message; }
  finally { $("#v-recontar").disabled = false; }
}
$("#v-recontar").addEventListener("click", () => cargar(true));
$("#v-alta").addEventListener("submit", async e => {
  e.preventDefault(); const boton = e.currentTarget.querySelector("button"); boton.disabled = true;
  try {
    await pedir("/api/voluntarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo: $("#v-codigo").value, nombre: $("#v-nombre").value }) });
    await cargar(datos?.fuente === "bitrix");
  } catch (error) { $("#v-estado").textContent = error.message; }
  finally { boton.disabled = false; }
});
$("#v-imprimir").addEventListener("click", () => {
  if (!datos?.voluntarios.length) return;
  try { $("#v-impresion").replaceChildren(...datos.voluntarios.map(tarjeta)); window.print(); }
  catch (e) { $("#v-estado").textContent = e.message; }
});
$("#v-csv").href = urlApi("/api/voluntarios.csv");
$("#v-csv").addEventListener("click", e => {
  if (datos?.fuente !== "bitrix") return;
  e.preventDefault();
  const celda = v => '"' + String(v).replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
  const csv = ["codigo,nombre,leads,pago", ...datos.voluntarios.map(v => [v.codigo, v.nombre, v.leads, v.pago].map(celda).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = "voluntarios-bitrix.csv"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
void cargar();
