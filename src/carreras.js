/* ═══════════════════════════════════════════════════
   CARRERAS — la certificación que "corre" cada persona
   ═══════════════════════════════════════════════════
   Elegir una carrera antes de dibujar es el paso educativo del stand:
   conecta el juego con lo que VLA vende. Cada carrera lleva su sticker
   (cosmético: el motor nunca lo ve) y un rango salarial de mercado.

   Los rangos salen de fuentes públicas consultadas el 18-sep-2026
   (docs/2026-09-19-dinamica-connector-day.md, sección 4). Son rangos de
   mercado en Costa Rica, no una promesa de VLA: la nota va siempre visible.
*/

export const CARRERAS = Object.freeze([
  { id: "cyber", nombre: "Cyber Seguridad", cert: "CompTIA Security+", sticker: "CYB",
    salario: "$1,500–2,500", aplicacion: "Proteger sistemas y responder a incidentes" },
  { id: "aws", nombre: "Cloud · AWS", cert: "AWS Certified", sticker: "AWS",
    salario: "$1,600–3,250", aplicacion: "Implementar y administrar la nube" },
  { id: "cisco", nombre: "Redes · Cisco", cert: "CCNA", sticker: "CCNA",
    salario: "$1,240–2,050", aplicacion: "Conectar y mantener redes reales" },
  { id: "pmp", nombre: "Gestión de Proyectos", cert: "PMP", sticker: "PMP",
    salario: "$4,000–5,800", aplicacion: "Dirigir equipos, tiempos y presupuestos" },
  { id: "aib", nombre: "AI Builders", cert: "Sin dato de mercado en CR", sticker: "AIB",
    salario: null, demanda: "Alta demanda", aplicacion: "Construir soluciones con IA" }
].map(Object.freeze));

export const NOTA_SALARIOS =
  "Rangos de mercado en Costa Rica — no es un salario garantizado. Fuente: SalaryExpert, Talently, Tusalario.org, Levels.fyi.";

export const carreraPorId = id => CARRERAS.find(c => c.id === id) || null;
