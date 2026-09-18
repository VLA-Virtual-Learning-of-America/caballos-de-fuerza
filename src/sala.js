/* ═══════════════════════════════════════════════════
   LA SALA — el lado mesa de la conexión con los celulares
   ═══════════════════════════════════════════════════
   La mesa abre una sala con un código de cuatro letras y se queda
   escuchando. Los celulares entran, dibujan y mandan pulsaciones; la mesa
   les devuelve en qué fase va la cosa y cómo van ellos.

   Si no hay servidor con WebSocket (por ejemplo, publicado como sitio
   estático en Vercel), esto se queda callado y el juego sigue funcionando
   entero con el teclado. Los celulares son un extra, no un requisito.
*/

export function crearSala(manejadores = {}) {
  let ws = null, codigo = null, red = null, reintentos = 0, vivo = false;

  function conectar() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    try { ws = new WebSocket(`${proto}//${location.host}/ws`); }
    catch { manejadores.alEstado?.({ vivo: false }); return; }

    ws.addEventListener("open", () => {
      vivo = true; reintentos = 0;
      enviar({ t: "mesa", sala: codigo });      // si ya había código, se recupera
    });
    ws.addEventListener("message", e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === "sala") {
        codigo = m.codigo;
        red = { direcciones: m.direcciones || [], puerto: m.puerto };
        manejadores.alEstado?.({ vivo: true, codigo, red });
        return;
      }
      if (m.t === "jinete") manejadores.alJinete?.(m);
      else if (m.t === "dibujo") manejadores.alDibujo?.(m);
      else if (m.t === "listo") manejadores.alListo?.(m);
      else if (m.t === "accion") manejadores.alAccion?.(m);
      else if (m.t === "fuera") manejadores.alFuera?.(m);
    });
    ws.addEventListener("close", () => {
      vivo = false;
      manejadores.alEstado?.({ vivo: false, codigo, red });
      setTimeout(conectar, Math.min(5000, 500 * 2 ** reintentos++));
    });
    ws.addEventListener("error", () => { try { ws.close(); } catch { /* ya está */ } });
  }

  function enviar(obj) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }

  conectar();

  return {
    get vivo() { return vivo; },
    get codigo() { return codigo; },
    /** La URL que va dentro del QR. */
    url() {
      const ip = red?.direcciones?.[0];
      const base = ip ? `http://${ip}:${red.puerto}` : location.origin;
      return `${base}/mando${codigo ? `?s=${codigo}` : ""}`;
    },
    direcciones: () => red?.direcciones || [],
    /** Avisa a todos los mandos de en qué fase va la mesa. */
    fase(fase, curso) {
      enviar({ t: "fase", fase, curso: curso ? { id: curso.id, nombre: curso.nombre, obstaculos: !!curso.obstaculos } : null });
    },
    /** Marcador individual, para que cada uno vea cómo va en su celular. */
    marcador(carril, datos) { enviar({ t: "marcador", carril, ...datos }); }
  };
}
