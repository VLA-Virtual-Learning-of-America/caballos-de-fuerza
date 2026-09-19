# Encargo 2 para Astra — la mesa (pantalla grande)

Trabajás en `C:\Josue\esteban-caballos-de-fuerza`. **Leé primero:** `HANDOFF.md`,
`docs/2026-09-19-dinamica-connector-day.md`, `src/carreras.js`, `src/config.js`, y el resultado
del encargo 1 que ya está en el repo: `server.js` (endpoints `/api/lead`, `/api/resultado`),
`src/mando.js` (qué manda el celular en `unirse` y qué espera en `marcador`/`fase`).

Zona: `index.html`, `style.css`, `src/app.js`, `src/poster.js`, `src/store.js`, `README.md`.
Son zona PROTEGIDA del HANDOFF: **Josué (VLA) ya aprobó esta versión nueva completa**, así que los
avisos amarillos de `node verificar.js` en esos archivos son esperados. Lo CONGELADO sigue
prohibido: `src/race.js`, `src/cursos.js`, `src/scene.js`, `src/hero.js` — ni un byte; el
pre-commit lo bloquea. Sin dependencias nuevas.

Referencia visual del look aprobado (mockup de la portada):
`C:\Users\Josue\AppData\Local\Temp\claude\C--Josue\e5a74282-1da6-4afa-8f2d-d365a2804050\scratchpad\branding-canvas\project\Main.dc.html`
— el título `$ketch Race.` con el `$` 1.5× más grande en verde `--vla`, logo VLA en la barra
(`assets/brand/logo-vla-blanco.png`), ticker fino de datos de mercado. Mantené el sistema de
diseño de `DESIGN.md` (filetes 1px, Archivo, sin tarjetas con sombra, verde único).

## A. Rebrand (index.html, style.css, poster.js)
- `<title>` → `$ketch Race · VLA`. Barra: `.bar-marca` = logo VLA (img, 20px alto) + separador
  fino + wordmark `$ketch Race` (el `$` en verde, un poco más grande). Conservá el botón (vuelve a
  la portada).
- Portada: `.hero-titulo` → `$ketch Race.` (mismo tratamiento del `$`; el punto final verde como
  ahora). `.sub` → "Dibujá tu corredor. Elegí tu carrera. Ganá créditos VLA." `.hero-datos` →
  "Hasta 4 personas · Un minuto · Todos los que corren ganan créditos VLA · Dibujar bien no sirve
  de nada". Debajo de la barra, un ticker fino (una línea, `--t-meta`, verde apagado) con tres
  datos de `CARRERAS`: p. ej. "CYBER SEGURIDAD · $1,500–2,500/mes · CLOUD AWS · $1,600–3,250/mes ·
  REDES CISCO · $1,240–2,050/mes" (generado desde `src/carreras.js`, no a mano).
- Copy: "caballo" → "corredor" en index.html y en los mensajes de `app.js` ("Falta el corredor",
  "Esto es un corredor", "Su corredor va aquí", "Présteme uno" se queda). El nombre del archivo
  descargado y la cabecera del póster (`poster.js`: "CABALLOS DE FUERZA") → "$KETCH RACE".
  `store.js`: `origen: "Sketch Race, Connector Day 2026"`.
- Meta description y cualquier "Caballos de Fuerza" visible al público → "$ketch Race". El nombre
  del repo/paquete NO se toca.

## B. Elegir carrera en el flujo de teclado (index.html, app.js)
Reemplazá el bloque `.sticker-selector` por un selector de carrera **obligatorio**:
`<select id="in-carrera" form="ficha" required>` con opción vacía "Elegí tu carrera…" y una
opción por `CARRERAS`: `"{nombre} · {cert} · {salario || demanda}/mes"`; debajo, en `--t-meta`,
`NOTA_SALARIOS`. Al lado, la previsualización del logo (reusá `etiquetaSticker(carrera.sticker)`).
En `inscribir()`: exigir carrera (mensaje "Elegí la carrera que va a correr."), guardar en el
jinete `carrera: id`, `sticker: carreraPorId(id).sticker`, `telefono`, `correo`, y disparar
`fetch("/api/lead", { nombre, telefono, correo, consiente:true, carrera, voluntario:null,
origen:"mesa" })` sin bloquear (timeout 4 s, errores solo a consola). `almacen.guardarLead`
sigue igual (respaldo local). Quitá `#in-sticker` y `#sticker-preview` del HTML/JS.

## C. Sala de celulares (bloque `═════ Sala de celulares ═════` de app.js)
- `alJinete(m)`: guardar también `carrera: m.carrera`, `sticker: m.sticker`, `voluntario: m.voluntario`
  (si el servidor no reenvía `voluntario` en la ficha, agregalo en `server.js` — es un campo más de
  `con.ficha` en `unirse`; el encargo 1 ya guarda carrera y sticker).
- En `#btn-lobby-ir`, al armar `estado.jinetes` desde los mandos, incluí `sticker`, `carrera`,
  `telefono`, `correo`, `voluntario`. (`corredores()` hace `{...j}`, así que `arrancar()` ya
  propaga `sticker` al corredor: verificá que se vea en pista.)
- La mesa NO vuelve a llamar `/api/lead` por los jinetes de celular (el celular ya lo hizo).

## D. Fin de carrera (mostrarActa en app.js)
Antes de `ir("result")`:
1. Para cada corredor humano (`!esBot && !esFantasma`), calcular `puesto = orden.indexOf(r)+1`,
   `tiempo = r.meta` (null si no llegó).
2. Si tiene `carrilMando != null`: `sala.marcador(carril, { final:true, puesto, meta: r.meta,
   curso: estado.curso.nombre })` — el celular lo usa para la pantalla de premio.
3. Si tiene `telefono`: `fetch("/api/resultado", { telefono, nombre, puesto, tiempo, carrera:
   r.carrera || null, curso: estado.curso.nombre })` sin bloquear.
Asegurate de que `carrera`, `telefono` y `carrilMando` lleguen hasta `estado.carrera.corredores`
(hoy `arrancar()` pasa `lista.map(({ sticker, ...r }) => r)` a `crearCarrera` y luego re-pega
`sticker`; hacé lo mismo con los campos nuevos: se pegan DESPUÉS de `crearCarrera`, nunca se le
pasan al motor).

## E. Acta (index.html, style.css, app.js)
- Bajo el texto `.acta-vla`, reemplazá el copy por: "Todos los que corren ganan. Reclame su premio
  desde su celular por WhatsApp — y pregunte por el webinar del 24: «Cómo no ser reemplazado por la
  inteligencia artificial»." (usar `EVENTO.webinar` de config, no texto fijo).
- Una línea de premios generada desde `EVENTO.premios`: "1.º $100 en créditos VLA + asesoría ·
  2.º $75 · 3.º $50 · 4.º $25".
- Un QR pequeño (`pintarQR`, ~150px) al lado, con `linkWhatsApp("Hola, vengo del Connector Day y
  quiero reclamar mi premio de $ketch Race.")` — es para quien jugó con el teclado y no tiene su
  pantalla de premio en el celular. Etiqueta: "Reclamar por WhatsApp".
- En `filaResultado` ya se muestra el sticker; agregá el nombre de la carrera junto al rol cuando
  exista (`r.carrera` → `carreraPorId(...).nombre`).

## F. Kiosco desatendido (app.js)
`reiniciarInactividad()`: incluir `"result"` entre las pantallas vigiladas con un tiempo propio
`INACTIVIDAD_ACTA = 60000` (60 s) → `ir("home")` limpiando `estado.jinetes`/`idx` como hoy. El
resto de tiempos, igual. Al entrar a `result` arrancá ese reloj aunque nadie toque nada (hoy solo
arranca con input). Un contador visible pequeño en `.pie`-style ("Vuelve a la portada en 60 s")
es bienvenido si cabe sin ruido.

## G. README.md
Sección nueva "Connector Day 2026 — operación": los dos QR (voluntario y pantalla), el panel
`/voluntarios.html?clave=…` (la clave vive en Railway como `PANEL_CLAVE`), qué llega a Bitrix y
con qué fuente/estatus, los premios y dónde se cambian (`src/config.js`), el WhatsApp de ventas
(`EVENTO.whatsapp`), y el rollback (`git checkout estable-2026-09-18`).

## H. Verificación obligatoria
1. `node verificar.js` → "Todo en orden" (amarillos permitidos: index.html, style.css, src/app.js,
   src/poster.js, src/store.js). Cero cambios en congelados.
2. `node --check src/app.js src/poster.js src/store.js server.js`.
3. Levantá `node server.js` (o `PORT=4180`) y comprobá con `curl` que `/` sirve el HTML con
   "$ketch Race" y sin "Caballos de fuerza" visible, y que `/api/lead` sigue respondiendo.
4. Revisá a mano que `import { CARRERAS, carreraPorId, NOTA_SALARIOS } from "./carreras.js"` y
   `import { EVENTO, linkWhatsApp } from "./config.js"` estén en `app.js` y que no quede ninguna
   referencia a `#in-sticker`.
5. Matá el servidor.

Respondé en español: archivos tocados, qué quedó exactamente en el acta y en la portada, salidas
de las pruebas, y lo que no pudiste probar (la interacción real la pruebo yo en el navegador).
