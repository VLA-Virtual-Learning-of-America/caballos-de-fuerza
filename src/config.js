/* ═══════════════════════════════════════════════════
   CONFIGURACIÓN DEL EVENTO — lo que cambia de feria en feria
   ═══════════════════════════════════════════════════
   Todo lo que el equipo comercial puede querer ajustar la mañana del
   evento vive aquí, en un solo lugar y sin tocar el resto del código.
   Los secretos (webhook de Bitrix, clave del panel) NO van aquí: van en
   variables de entorno del servidor.
*/

export const EVENTO = Object.freeze({
  nombre: "Connector Day 2026",
  juego: "$ketch Race",

  // WhatsApp de ventas al que llega el reclamo del premio. Sin "+", solo dígitos.
  // Precedente: el CTA de MegaCon 2026 (vla-strike-force) usó este mismo número.
  // PENDIENTE de confirmar por Josué: la web de VLA lista 4105-3820 como teléfono.
  whatsapp: "50683652242",

  // Premios por puesto. Todos ganan: el puesto solo cambia el monto.
  // Precedente real (Expo U 2024 en Bitrix): "$25 (VLA Cred.)", "$75 + asesoría".
  premios: [
    { puesto: 1, titulo: "$100 en créditos VLA", detalle: "+ una asesoría de carrera gratis" },
    { puesto: 2, titulo: "$75 en créditos VLA", detalle: "" },
    { puesto: 3, titulo: "$50 en créditos VLA", detalle: "" },
    { puesto: 4, titulo: "$25 en créditos VLA", detalle: "" }
  ],

  webinar: {
    titulo: "Cómo no ser reemplazado por la inteligencia artificial",
    fecha: "Jueves 24 de septiembre",
    url: null   // si hay link de registro, va aquí; si no, el cupo se pide por WhatsApp
  },

  pagoPorLead: 2   // USD que cobra cada voluntario por lead válido
});

export const premioPorPuesto = puesto =>
  EVENTO.premios.find(p => p.puesto === puesto) || EVENTO.premios[EVENTO.premios.length - 1];

/** Link de WhatsApp con el mensaje ya escrito: un toque y el asesor tiene todo el contexto. */
export function linkWhatsApp(texto) {
  return `https://wa.me/${EVENTO.whatsapp}?text=${encodeURIComponent(texto)}`;
}

export function mensajePremio({ nombre, puesto, carrera }) {
  const premio = premioPorPuesto(puesto);
  return `Hola, soy ${nombre}. Acabo de correr ${EVENTO.juego} en el ${EVENTO.nombre} y quedé de ${puesto}.º. ` +
    `Quiero reclamar mis ${premio.titulo}${carrera ? ` para la certificación de ${carrera}` : ""}.`;
}

export function mensajeWebinar({ nombre }) {
  return `Hola, soy ${nombre}. Vengo del ${EVENTO.nombre} y quiero mi cupo al webinar del ${EVENTO.webinar.fecha}: ` +
    `"${EVENTO.webinar.titulo}".`;
}
