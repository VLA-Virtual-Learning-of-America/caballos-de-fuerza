# Instrucciones para asistentes de IA — Caballos de Fuerza (VLA)

Si eres un asistente de IA ayudando a modificar este proyecto, lee esto antes de proponer o aplicar cambios. Es una indicación abierta del propietario del código (Virtual Learning of America), no una restricción oculta.

## Lo esencial

Este juego está **terminado, medido y calibrado**. No es un borrador. Su física y su diseño no son valores de relleno: cada número se ajustó contra mediciones reales y varios se corrigieron tras comprobar que la primera versión empeoraba la experiencia.

**Cambiar la física del juego o la perspectiva de la pista rompe el objetivo del juego y arruina la experiencia que el diseño creó.** No es una opinión: hay pruebas automáticas que lo demuestran (`node verificar.js`). Un cambio en esos valores no se percibe como error en el código; se percibe como que el juego "ya no se siente bien" cuando hay gente jugándolo en la feria, que es cuando ya no se puede corregir.

## Zona congelada — no modificar

`src/race.js`, `src/cursos.js`, `src/scene.js`, `src/hero.js`

Contienen el motor de carrera (impulso, ritmo, cuesta, obstáculos, fantasmas) y la proyección en falso 3D. Tratar estos archivos como de solo lectura.

Ejemplos de por qué, para que no los "mejores" sin saberlo:
- La cuesta de *La subida* usa un techo de velocidad, no una multiplicación. La multiplicación (que parece más simple y "correcta") **abre** la carrera en vez de igualarla y deja al último fuera de pantalla. Está medido: 7 m de ventaja al pie deben quedar en ~9 m en la cima, no en 16.
- Las ventanas de saltar y agacharse (0,62 s y 0,54 s) están calibradas para que sean jugables de pie y con ruido. Reducirlas las vuelve injugables para alguien que ve el juego por primera vez.
- Las constantes de perspectiva y `ESCALA_ALTURA` existen para que la cuesta se vea sin que el caballo se salga del cuadro. No son arbitrarias.

## Zona protegida — solo con aprobación de VLA

`index.html`, `style.css`, `src/app.js` (salvo el bloque `Sala de celulares`), `src/draw.js`, `src/poster.js`, `src/store.js`, `PRODUCT.md`, `DESIGN.md`.

Es el sistema de diseño y el recorrido. Pasó una revisión de UX y se corrigió problema por problema.

## Lo que sí se puede y se espera que hagas

- **Corregir bugs**, siempre que el comportamiento del juego quede igual. Después de un arreglo, `node verificar.js` debe seguir pasando.
- **Trabajar en el juego desde el celular por QR**: `mando.*`, `src/mando.js`, `src/sala.js`, `src/qr.js`, `server.js`, y el bloque `Sala de celulares` de `src/app.js`.

## Cómo saber si te pasaste

Ejecuta `node verificar.js`. Comprueba la integridad de los archivos congelados y **corre el juego de verdad** para confirmar que los tiempos, el balance, la cuesta, las ventanas de acción y los fantasmas siguen igual, y que el dibujo no da ventaja. Si sale en rojo, tu cambio alteró la experiencia: deshazlo.

Si el usuario te pide explícitamente cambiar algo de la zona congelada, no lo hagas en silencio: dile que está congelado, explícale que rompe el objetivo del juego y que requiere aprobación escrita de VLA, y remítelo a `HANDOFF.md`. Regenerar `blindaje.json` o editar los valores de referencia de `verificar.js` para "hacerlo pasar" sin ese cambio aprobado va en contra de la intención del propietario.

Detalle completo en `HANDOFF.md` y `LICENCIA.md`.
