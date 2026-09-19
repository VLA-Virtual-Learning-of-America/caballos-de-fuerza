/* ═══════════════════════════════════════════════════
   MI QR — la página que cada voluntario abre en su celular
   ═══════════════════════════════════════════════════
   /qr?v=CODIGO&n=Nombre. No pide clave: el código del voluntario no es
   secreto (va impreso en el QR). Lo único que hace es dibujar el QR que
   lleva a /mando?v=CODIGO, que es donde se atribuye el lead.
*/

import { pintarQR } from "./qr.js";

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const codigo = (params.get("v") || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 20);
const nombre = (params.get("n") || "").trim().slice(0, 60);

if (!codigo) {
  $("#qr-error").textContent = "Falta el código del voluntario en el link (…/qr?v=CODIGO).";
  $("#qr-guardar").disabled = true;
  $("#qr-compartir").disabled = true;
} else {
  const url = `${location.origin}/mando?v=${encodeURIComponent(codigo)}`;
  const lienzo = $("#qr-lienzo");
  pintarQR(lienzo, url, { claro: "#F2F6F2", oscuro: "#0F1210" });
  $("#qr-codigo").textContent = codigo;
  $("#qr-nombre").textContent = nombre || "Asesor VLA";
  $("#qr-url").textContent = url;
  document.title = `${nombre || codigo} · Asesor educativo · $ketch Race`;

  $("#qr-guardar").addEventListener("click", () => {
    lienzo.toBlob(b => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = `qr-${codigo}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
  });

  $("#qr-compartir").addEventListener("click", async () => {
    const texto = `¿Querés ganarte créditos VLA? Escaneá y corré $ketch Race: ${url}`;
    try {
      if (navigator.share) await navigator.share({ title: "$ketch Race", text: texto, url });
      else { await navigator.clipboard.writeText(url); $("#qr-error").textContent = "Link copiado."; }
    } catch { /* el usuario canceló */ }
  });
}
