# Encargo 1 para Astra — servidor + celular (zona abierta)

Trabajás en `C:\Josue\esteban-caballos-de-fuerza`. **Leé primero, en este orden:**
1. `HANDOFF.md` (reglas del repo: hay archivos CONGELADOS con hash — `race.js`, `cursos.js`,
   `scene.js`, `hero.js` — y un pre-commit que bloquea si se tocan).
2. `docs/2026-09-19-dinamica-connector-day.md` (la especificación: QUÉ y POR QUÉ).
3. `src/carreras.js` y `src/config.js` (ya escritos: son el contrato, usalos tal cual, no los reescribas).
4. `server.js`, `mando.html`, `mando.css`, `src/mando.js`, `src/sala.js`, `src/qr.js`, `src/stickers.js`.

**Este encargo toca SOLO zona abierta:** `server.js`, `mando.html`, `mando.css`, `src/mando.js`,
archivos nuevos (`voluntarios.html`, `src/voluntarios.js`, `scripts/*.mjs`, `data/`). **NO toques**
`src/app.js`, `index.html`, `style.css` ni nada congelado: la mesa se hace en un encargo aparte que
ya está diseñado contra los contratos de abajo. No se instalan dependencias: solo Node ≥ 20 (regla
de la feria: lo que no se instala no falla).

Referencia visual OBLIGATORIA del look aprobado por Josué para la pantalla de elegir carrera:
`C:\Users\Josue\AppData\Local\Temp\claude\C--Josue\e5a74282-1da6-4afa-8f2d-d365a2804050\scratchpad\branding-canvas\project\Elegir-carrera.dc.html`
(un mockup .dc.html: copiá de ahí el CSS de las filas `.route`, la selección con barra y check,
las marcas de esquina `.tick`, el subrayado `.subrayado`, el header con logo + wordmark
`$ketch Race`, y las clases `.cert-logo` con el filtro que vuelve blancos los SVG de `stickers/`).
Los logos oficiales: `stickers/CYB.svg` (CompTIA), `stickers/AWS.svg`, `stickers/CCNA.svg` (Cisco);
PMP y AI Builders no tienen logo oficial → sin ícono, solo texto (no inventes uno). El logo de VLA
está en `assets/brand/logo-vla-blanco.png`.

---

## A. `server.js` — API de leads, resultados y voluntarios

Variables de entorno: `BITRIX_WEBHOOK_URL` (secreto; si falta, se loguea y se sigue sin Bitrix),
`PANEL_CLAVE` (clave del panel de voluntarios; si falta, el panel responde 503 "sin clave"),
`DATA_DIR` (default `./data`, crear si no existe). Nunca mandar el webhook al navegador.

Persistencia sin dependencias: `data/leads.jsonl` (una línea JSON por evento: `lead`, `bitrix`,
`resultado`) y `data/voluntarios.json` (`{ "CODIGO": { nombre, leads } }`). Al arrancar, se
reconstruye el estado en memoria leyendo el jsonl (último evento gana por teléfono). Escrituras con
`fs.appendFile`/`writeFile` best-effort: en Railway el disco es efímero, la verdad durable es Bitrix.

Teléfono normalizado = solo dígitos; si son 8 dígitos se antepone `506`. Clave de dedupe.

### `POST /api/lead`  (JSON)
Entrada: `{ nombre, telefono, correo, consiente, carrera, voluntario, origen }`
— `carrera` es un id de `src/carreras.js` (o null), `voluntario` es un código (o null → "stand"),
`origen` es `"mando"` o `"mesa"`.
Validar: nombre ≥ 2, ≥ 8 dígitos de teléfono, correo con @ y punto, `consiente === true`; si no,
`400 { ok:false, error }`. Voluntario: solo `[A-Z0-9_-]{2,20}` en mayúsculas; si no cumple → null.
Respuesta INMEDIATA (no esperar a Bitrix): `200 { ok:true, duplicado }`.
- Si el teléfono ya existe → `duplicado:true`, no se vuelve a contar ni a mandar a Bitrix (pero si
  antes no tenía carrera y ahora sí, se actualiza la carrera).
- Si es nuevo → se guarda, `voluntarios[codigo].leads++` (crea el código si no existía, con
  `nombre: ""`), y se dispara (sin await) `crearLeadBitrix(lead)`.

### Bitrix (`crearLeadBitrix`, `actualizarResultadoBitrix`)
`POST ${BITRIX_WEBHOOK_URL}crm.lead.add.json` con `{ fields }`:
```
TITLE: `Sketch Race — ${nombre} (${nombreCarrera || "sin carrera"})`
NAME: nombre                       PHONE: [{ VALUE: "+" + telefonoNormalizado, VALUE_TYPE: "MOBILE" }]
EMAIL: [{ VALUE: correo, VALUE_TYPE: "WORK" }]
SOURCE_ID: "CONNECTOR_DAY_2026"    STATUS_ID: "JUNK"          ASSIGNED_BY_ID: 4391
UTM_SOURCE: voluntario || "stand"  UTM_CAMPAIGN: "sketch-race-connector-day"  UTM_CONTENT: carrera || ""
COMMENTS: texto con evento, carrera elegida (nombre + cert), voluntario, origen, fecha ISO
```
Timeout 15 s (`AbortSignal.timeout`). Éxito → guardar evento `{t:"bitrix", telefono, id}` en el
jsonl y en memoria. Error → evento `{t:"bitrix", telefono, error}` + `console.error`; nunca rompe
la respuesta al cliente. Modelo de referencia (otro repo, mismo webhook):
`C:\Josue\vla-strike-force\lib\bitrix.ts` (leelo; es TypeScript, acá es JS puro).

### `POST /api/resultado`  (JSON)
Entrada: `{ telefono, nombre, puesto, tiempo, carrera, curso }` (lo manda la mesa al terminar la
carrera; encargo 2). Respuesta inmediata `{ ok:true }`. Guarda evento `resultado` y, si el lead
tiene id de Bitrix, dispara `crm.lead.update.json` con `COMMENTS` = comentarios previos + línea
`"Resultado: {puesto}.º en {curso} ({tiempo}s) · premio: {titulo del premio}"` (usar
`premioPorPuesto` de `src/config.js` — el server puede importarlo, es ESM). Si no hay id todavía
(Bitrix lento), reintentar una vez a los 20 s.

### Panel de voluntarios (todo exige `?clave=` igual a `PANEL_CLAVE`; si no, 401)
- `GET /api/voluntarios` → `{ voluntarios: [{ codigo, nombre, leads, pago }], total, pagoTotal,
  pagoPorLead }` (pago = leads × `EVENTO.pagoPorLead`).
- `POST /api/voluntarios` `{ codigo, nombre }` → alta/renombre (código se normaliza a mayúsculas).
- `GET /api/voluntarios/bitrix` → recuenta desde Bitrix: `crm.lead.list.json` con
  `filter[SOURCE_ID]=CONNECTOR_DAY_2026`, `select=[ID, UTM_SOURCE, PHONE]`, paginando con `start`
  hasta que no haya `next`; agrupa por `UTM_SOURCE` y devuelve el mismo shape más `fuente:"bitrix"`.
  Es el respaldo cuando el disco se perdió.
- `GET /api/voluntarios.csv` → CSV `codigo,nombre,leads,pago`.

### Relay de la sala (ya existe, solo se amplía)
En `unirse`, `con.ficha` debe guardar también `carrera` (id) y `sticker` (código) que manda el
celular; el mensaje `jinete` a la mesa ya hace `...mando.ficha`, así que llegan solos.

---

## B. `voluntarios.html` + `src/voluntarios.js` (nuevo, zona abierta)

Página para el coordinador, mismo sistema visual (fondo oscuro, Archivo, verde `--vla`, filetes;
importá `./style.css` para los tokens y `./mando.css` si sirve). Lee `clave` de la URL (`?clave=`).
- Tabla: código · nombre · leads · $ a pagar; totales abajo. Botón "Recontar desde Bitrix".
- Formulario de alta: código + nombre.
- Por voluntario: botón "QR" que muestra un QR grande (usar `pintarQR` de `src/qr.js`, mirá cómo lo
  usa `src/app.js` en `pintarLobby`) con la URL `${location.origin}/mando?v=CODIGO`, el código en
  texto grande debajo y el nombre; botón "Imprimir todos" que arma una hoja con un QR por voluntario
  (CSS `@media print`, uno por tarjeta, 2 columnas).
- Botón "Descargar CSV".

---

## C. Celular — `mando.html`, `mando.css`, `src/mando.js`

Rebrand: header = logo VLA + separador + wordmark `$ketch Race` (como el mockup). Sustituí
"caballo" por "corredor" en todo el copy del celular. Título de la entrada: "Su corredor."

Estado en `localStorage` (`sr-perfil-v1`): `{ nombre, telefono, correo, carrera, voluntario }`.
URL: `v` = voluntario (guardar en el perfil apenas llega, en mayúsculas, aunque después escanee
otro QR), `s` = sala.

Flujo de pantallas (agregá las que falten al HTML; mantené el patrón `.m-pantalla` + `ir()`):

1. **`m-entrar`** — formulario actual (nombre, WhatsApp con prefijo +506 fijo, correo, consentimiento)
   **más la sección "¿Con qué salario querés arrancar?"** con las 5 carreras de `CARRERAS`
   (filas seleccionables, radio real `<input type="radio" name="carrera">` oculto + label, look del
   mockup, logo oficial si `stickerPorCodigo(c.sticker).logo` existe, salario o `demanda`,
   `NOTA_SALARIOS` debajo). Elegir carrera es obligatorio. Si hay perfil guardado, prellenar todo.
   Si viene `s`, mostrar el campo de sala oculto ya relleno; si no viene, NO mostrar campo de sala
   aquí (va en la pantalla 3).
   Al enviar: validar → guardar perfil → `fetch("/api/lead")` con
   `{ …, carrera, voluntario, origen:"mando" }` (timeout 4 s con AbortController; si falla, seguir
   igual: el lead también queda en la mesa por el mensaje `jinete`) → si hay `s`, conectar y
   `unirse`; si no, `ir("sala")`.
2. **`m-volver`** (nuevo) — solo cuando llega con `s` y ya hay perfil: "Hola de nuevo, {nombre}",
   chip con su carrera, botón grande "Entrar a la sala" (unirse directo) y enlace "No soy yo"
   (borra el perfil → `m-entrar`).
3. **`m-sala`** (nuevo) — "¿En qué pantalla vas a correr?": input de 4 letras grande (reusar
   `.m-sala-input`), texto "Está en la pantalla del stand, debajo del QR", botón "Entrar".
4. `m-dibujo`, `m-espera`, `m-juego` — como están (copy → "corredor").
5. **`m-fin`** — rediseñada como pantalla de PREMIO y CTA (la más importante del embudo):
   - Kicker "Su resultado" · puesto grande (`{puesto}.º`) · tiempo si llegó · fila de la carrera
     elegida (logo + nombre + cert + salario + `aplicacion`).
   - Bloque premio: `premioPorPuesto(puesto)` → título + detalle; texto "Todos los que corren ganan.
     Reclamalo ahora mismo:".
   - Botón principal (verde) "Reclamar por WhatsApp" → `linkWhatsApp(mensajePremio({nombre, puesto,
     carrera: nombre de la carrera}))`, `target="_blank"`.
   - Botón secundario "Cupo al webinar del 24 · Cómo no ser reemplazado por la IA" → si
     `EVENTO.webinar.url` existe, ese link; si no, `linkWhatsApp(mensajeWebinar({nombre}))`.
   - Enlace "Correr otra vez" (`location.reload()` conservando `s` y `v` en la URL).
   - El puesto/tiempo salen del último `marcador` recibido; si la mesa manda un marcador con
     `final:true` (encargo 2) usá ese. Si no hay ningún puesto conocido, mostrá el premio del 4.º.
   `unirse` debe mandar también `carrera` (id) y `sticker` (código de `carreraPorId(id).sticker`).

Estética "Taller de Potencia" (aprobada): marcas de esquina en las pantallas de entrada y de fin,
subrayado a mano alzada bajo el título, filetes 1px, sin sombras ni degradados. Los `<button>`
verdes píldora se mantienen.

---

## D. Verificación obligatoria antes de terminar

1. `node verificar.js` en verde ("Todo en orden"; avisos amarillos SOLO de archivos que ya venían
   con aviso: index.html, style.css, src/app.js, src/poster.js, src/store.js — vos no los tocaste).
2. Arrancá `node server.js` (puerto 4173; si está ocupado, `PORT=4180 node server.js`) SIN
   `BITRIX_WEBHOOK_URL` y probá con `curl`: `POST /api/lead` nuevo → `{ok:true,duplicado:false}`;
   el mismo teléfono → `duplicado:true`; `GET /api/voluntarios?clave=x` con `PANEL_CLAVE=x` →
   el voluntario con 1 lead y pago 2; `POST /api/resultado` → `{ok:true}`; `GET /voluntarios.html`
   → 200; `GET /mando?v=ANA01` → 200. Pegá las salidas reales.
3. Sintaxis: `node --check server.js src/mando.js src/voluntarios.js`.
4. Matá el servidor que levantaste.

Respondé en español con: qué archivos tocaste/creaste, el contrato final de cada endpoint (por si
algo cambió respecto a esto), las salidas de las pruebas, y lo que NO pudiste probar.
