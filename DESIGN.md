# Sistema de diseño — Caballos de Fuerza

Registro: **brand**. Carril estético declarado: **tablero de cronometraje de federación deportiva**, construido con la gramática de una página de producto de Apple. Datos tabulares, filetes de un pixel usados como medida y no como adorno, vacío generoso, una sola idea por pantalla.

## Escena física

Cuatro desconocidos apiñados alrededor de un teclado en un stand de feria, bajo luz de pabellón, con una pantalla grande detrás que tiene que leerse desde diez metros mientras la gente pasa caminando.

Esa escena obliga a **oscuro**. Una pantalla clara en un pabellón iluminado se convierte en una plancha de reflejo; sobre negro, los trazos de los caballos son luz y se leen desde el pasillo.

## Color

Estrategia: **Restrained**. La superficie es casi negra con un matiz verde; el acento aparece en menos del 10% del área y solo donde significa algo (la acción principal, un dato en vivo, quien va ganando). El color de verdad vive dentro del lienzo de la carrera, donde cada jinete tiene el suyo. El cromo alrededor se queda callado para que eso destaque.

```
--tinta-0   oklch(0.15 0.008 155)   fondo
--tinta-1   oklch(0.19 0.009 155)   superficie elevada
--tinta-2   oklch(0.25 0.010 155)   filete fuerte
--filete    oklch(0.30 0.010 155 / .5)
--texto     oklch(0.96 0.006 155)   titulares
--texto-2   oklch(0.72 0.008 155)   cuerpo
--texto-3   oklch(0.52 0.008 155)   metadatos
--vla       oklch(0.82 0.21 152)    = #00E676
--vla-tinta oklch(0.28 0.09 152)    verde apagado para trazas
```

Nunca `#000` ni `#fff`. Todo neutro lleva croma 0.006–0.010 hacia el verde de marca.

Carriles (solo dentro del lienzo y en la miniatura del jinete):
`#00E676` · `#FF6200` · `#22D3EE` · `#E879F9`

## Tipografía

**Archivo** (Omnibus-Type), variable, un solo tipo para todo. Peso 300–800, ancho 62–125%.

Elegida por lo que es como objeto: una grotesca de señalética con cifras tabulares impecables. Es la letra de un marcador de estadio, no la de un póster. El eje de ancho permite apretar el cronómetro sin cambiar de familia.

Se descartaron por reflejo: Inter, Space Grotesk, Helvetica. Se descartó Bebas Neue (condensada de cartel: ruidosa, lo contrario de sobrio).

Escala fluida, razón 1.3 entre pasos:

```
--t-hero    clamp(3.5rem, 8vw, 9rem)     peso 700, tracking -0.045em
--t-titulo  clamp(2.2rem, 4.2vw, 4rem)   peso 650, tracking -0.035em
--t-sub     clamp(1.05rem, 1.5vw, 1.5rem) peso 450, tracking -0.011em
--t-cuerpo  clamp(0.9rem, 1vw, 1.05rem)  peso 400
--t-meta    0.75rem                       peso 550, tracking 0.1em, versalitas
```

Texto claro sobre oscuro: interlineado +0.06 sobre lo que se usaría en claro.
Cifras: siempre `font-variant-numeric: tabular-nums`. Un cronómetro que baila está roto.

## Espacio

Rejilla de 8. Escala fluida `--e-1` a `--e-7` (4px → 96px). El ritmo se varía a propósito: separaciones amplias entre bloques, agrupaciones apretadas dentro de un bloque. Nunca el mismo padding en todo.

Cada pantalla ocupa el viewport completo, sin scroll. El texto se ancla **abajo a la izquierda** sobre el vacío, como el hero de Apple; nunca una pila centrada.

## Componentes

- **Barra superior**: filete de 1px, marca a la izquierda, paso a la derecha. Es el único indicador de progreso. No se repiten etiquetitas en versalitas encima de cada titular.
- **Acción principal**: una sola píldora rellena en verde VLA por pantalla. Texto `oklch(0.18 0.03 152)`.
- **Acción secundaria**: texto plano con una flecha. Sin borde, sin caja.
- **Listas de datos** (parrilla, posiciones, acta, ranking): filas separadas por filetes de 1px. Número de posición grande a la izquierda, nombre, cifra alineada a la derecha con cifras tabulares. Sin tarjetas.
- **Color del jinete**: aparece como el trazo de su dibujo y como una barra funcional de 2px que mide su ritmo. Nunca como franja decorativa.

## Movimiento

Duraciones 180–420ms, `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo). Sin rebote, sin elástico. Solo se animan `opacity` y `transform`.

Al entrar una pantalla, sus bloques aparecen escalonados cada 60ms. Una sola coreografía por pantalla; nada de micro-animaciones sueltas.

## Prohibiciones de este proyecto

- Franjas de color al costado de tarjetas o filas.
- Texto con degradado.
- Vidrio esmerilado decorativo.
- Rejillas de tarjetas idénticas.
- Resplandores en el cromo. El `box-shadow` con glow verde se reserva al lienzo de la carrera, donde es luz de escena y no decoración.
- Rayas (`—`) en el texto de interfaz.
- Signos de admiración, salvo el rótulo de salida de la carrera.
