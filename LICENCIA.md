# Condiciones de la entrega — Caballos de Fuerza

Propiedad de **Virtual Learning of America (VLA)**. Se entrega para un encargo concreto: **habilitar el juego desde el celular por QR** y dejarlo listo para operar en feria.

## Alcance permitido

- Trabajo sobre la conexión con celulares (`mando.*`, `src/mando.js`, `src/sala.js`, `src/qr.js`, `server.js`) y el bloque de sala de `src/app.js`.
- Corrección de errores (bugs) en cualquier archivo, siempre que **no cambie el comportamiento del juego**: los tiempos, el balance, la perspectiva o el sistema visual deben quedar iguales. `node verificar.js` tiene que seguir pasando después del arreglo.

## No permitido sin aprobación escrita de VLA

- Modificar la física del juego ni la perspectiva de la pista: `src/race.js`, `src/cursos.js`, `src/scene.js`, `src/hero.js`.
- Cambiar el sistema de diseño o el recorrido: `index.html`, `style.css`, `src/app.js` (fuera del bloque de sala), `src/draw.js`, `src/poster.js`, `src/store.js`, `PRODUCT.md`, `DESIGN.md`.

Estos valores están medidos y calibrados. Cambiarlos rompe el objetivo del juego (ver `HANDOFF.md`). Un "arreglo" que altere los tiempos o el balance **no es un arreglo**: es un cambio de diseño y necesita aprobación.

## Verificación

El proyecto trae un verificador (`node verificar.js`) que comprueba la integridad y el comportamiento, un hook de pre-commit y un CI que bloquean cambios que rompan lo anterior. No se deben desactivar ni editar los valores de referencia para "hacerlos pasar".

## Entregable

Se considera entregado y aceptable solo si `node verificar.js` pasa en verde y el recorrido con teclado funciona igual que en la versión original.
