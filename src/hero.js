/* ═══════════════════════════════════════════════════
   HERO — el caballo como producto
   ═══════════════════════════════════════════════════
   La portada de un stand no puede ser solo texto: alguien que pasa
   por el pasillo tiene que entender la mecánica sin leer. Aquí trota
   un caballo en el vacío, con la misma deformación de patas que usa
   la carrera, para que la promesa y el producto sean lo mismo.
*/

const LINEA_PATAS = 0.62;
const GRUPOS = 4;

export function crearHero(canvas, dibujo) {
  const c = canvas.getContext("2d");
  let W = 0, H = 0, t = 0, ultimo = 0, vivo = false, cuadro = 0;
  const suave = !(typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches);

  function medir() {
    const caja = canvas.getBoundingClientRect();
    if (caja.width < 1 || caja.height < 1) return false;
    W = caja.width; H = caja.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  function pintar() {
    c.clearRect(0, 0, W, H);
    if (!dibujo || !dibujo.trazos.length) return;

    // Arriba a la derecha del vacío, dejando el cuadrante inferior
    // izquierdo libre para el titular.
    const alto = Math.min(H * 0.52, W * 0.34);
    const ancho = alto * dibujo.aspecto;
    const ox = W * 0.68, oy = H * 0.26;
    const zancada = suave ? t * 9 : 0;
    const vaiven = suave ? Math.sin(zancada * 2) * alto * 0.012 : 0;

    c.lineCap = "round";
    c.lineJoin = "round";
    c.lineWidth = Math.max(1.5, alto * 0.011);
    c.strokeStyle = "oklch(0.44 0.05 155)";

    for (const trazo of dibujo.trazos) {
      if (trazo.puntos.length < 2) continue;
      c.beginPath();
      trazo.puntos.forEach((v, i) => {
        const pata = Math.max(0, (v.y - LINEA_PATAS) / (1 - LINEA_PATAS));
        const grupo = Math.min(GRUPOS - 1, Math.max(0, Math.floor((v.x + 0.5) * GRUPOS)));
        const fase = zancada + grupo * Math.PI * 0.85;
        const balanceo = suave ? Math.sin(fase) * pata * ancho * 0.05 : 0;
        const levante = suave ? Math.max(0, Math.cos(fase)) * pata * alto * 0.08 : 0;
        const X = ox + (v.x * ancho) + balanceo;
        const Y = oy + (v.y * alto) + vaiven - levante;
        i ? c.lineTo(X, Y) : c.moveTo(X, Y);
      });
      c.stroke();
    }
  }

  function bucle(ahora) {
    if (!vivo) return;
    const dt = Math.min(0.06, (ahora - ultimo) / 1000);
    ultimo = ahora;
    t += dt;
    pintar();
    cuadro = requestAnimationFrame(bucle);
  }

  return {
    arrancar() {
      if (vivo) return;
      if (!medir()) { requestAnimationFrame(() => this.arrancar()); return; }
      vivo = true; ultimo = performance.now();
      cuadro = requestAnimationFrame(bucle);
    },
    parar() { vivo = false; cancelAnimationFrame(cuadro); },
    remedir() { if (medir()) pintar(); },
    cambiar(nuevo) { if (nuevo && nuevo.trazos.length) dibujo = nuevo; }
  };
}
