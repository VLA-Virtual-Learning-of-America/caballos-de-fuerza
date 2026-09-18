# Entrega a desarrollo — Caballos de Fuerza · VLA

**Léalo entero antes de abrir un archivo.** Son diez minutos y le ahorran rehacer trabajo.

Esto no es un prototipo: es una pieza terminada, medida y calibrada que va a estar frente a público en un stand de feria. El encargo tiene **una sola zona de trabajo abierta** y **una zona cerrada con candado**.

---

## 1. Qué puede tocar, y qué no

### 🟢 ZONA DE TRABAJO — adelante

**Que la gente pueda jugar desde su celular escaneando un QR.**

Ya hay una primera versión funcionando de punta a punta. Su trabajo es endurecerla, probarla con teléfonos reales y dejarla lista para un día de feria.

| Archivo | Qué es |
|---|---|
| `mando.html` · `mando.css` · `src/mando.js` | La pantalla del celular: entrar, dibujar, los tres botones |
| `src/sala.js` | Lado mesa de la conexión |
| `src/qr.js` | Codificador de QR propio |
| `server.js` | Servidor estático + sala en tiempo real (WebSocket a pelo) |
| `README.md` | Documentación de operación |

Dentro de `src/app.js` puede tocar **solo el bloque `═════ Sala de celulares ═════`** y lo que necesite para conectarlo. Todo lo demás de ese archivo entra en la zona protegida.

### 🔴 ZONA CONGELADA — no se toca

**La física del juego y la perspectiva de la pista.**

| Archivo | Por qué está cerrado |
|---|---|
| `src/race.js` | Motor de carrera: impulso, ritmo, cuesta, obstáculos, fantasmas |
| `src/cursos.js` | Las tres carreras: perfil del terreno, vallas, umbrales |
| `src/scene.js` | Proyección en falso 3D, galope, escala de altura, cámara |
| `src/hero.js` | Galope de la portada (comparte la misma matemática) |

**Estos números no son opinión: están medidos y contrastados.** Cada constante de ahí se ajustó contra mediciones reales y varias se corrigieron después de descubrir que la primera versión empeoraba el juego. Dos ejemplos de lo que hay detrás:

- La cuesta de *La subida* primero **multiplicaba** la velocidad por la pendiente. Medido, eso **abría** la carrera: el líder pasaba de 7,3 m de ventaja al pie a 16,2 m en la cima, y el último se salía de la pantalla. Se rehizo para que la cuesta ponga un **techo de velocidad** y junte al pelotón. Hoy la ventaja en la cima es 9,4 m. Si alguien "simplifica" eso a una multiplicación, el juego vuelve a romperse y no se nota hasta tener cuatro personas delante.
- La ventana para agacharse era de 0,36 s. Para alguien que nunca lo ha visto, de pie y con ruido, eso es injugable. Se subió a 0,54 s y se añadió el aviso que se enciende cuando toca pulsar.

La perspectiva está igual de cerrada. `ESCALA_ALTURA = 0.5` y la compensación de cámara al 55% existen porque, con la altura real, a 90 m el suelo se salía 298 px por encima del borde y la cuesta no se veía.

### 🟡 ZONA PROTEGIDA — pida aprobación antes

`index.html`, `style.css`, `src/app.js` (fuera del bloque de sala), `src/draw.js`, `src/poster.js`, `src/store.js`, `PRODUCT.md`, `DESIGN.md`.

Es el sistema de diseño y el recorrido. Pasó una revisión de UX que sacó 17/40 en la primera versión y se corrigió problema por problema. Cambiarlo sin contexto deshace ese trabajo. Si necesita tocar algo aquí para el tema del celular, propóngalo antes.

---

## 2. El candado no es de palabra

```bash
npm run verificar        # o: node verificar.js
```

Hace dos cosas, y **falla con código de salida 1** si algo se rompió:

1. **Compara el hash** de los cuatro archivos congelados contra `blindaje.json`.
2. **Corre el juego de verdad**, sin interfaz, y comprueba 22 cosas: los tiempos de las tres carreras con cuatro cadencias distintas, que la cuesta junte al pelotón, que las ventanas de acción no bajen de 0,45 s, que equivocarse de botón cueste más que no hacer nada, que los fantasmas reproduzcan la carrera a la mitad de cuadros por segundo, y que **el dibujo no dé ventaja**.

Ejecútelo antes de cada entrega. Si sale en rojo, algo que usted tocó cambió cómo se siente el juego.

Compruébelo usted mismo: cambie `BASE = 5.6` por `5.7` en `src/race.js` y verá saltar nueve comprobaciones a la vez.

> Para que quede claro: esto es un **cable trampa, no una caja fuerte**. Quien quiera puede editar `blindaje.json` y los números esperados. Está para que nadie rompa el juego **sin darse cuenta**, que es exactamente como se rompen estas cosas. Si de verdad hace falta cambiar algo congelado, hable con VLA, cámbielo con conocimiento y regenere el blindaje a propósito, no por accidente.

---

## 3. Levantarlo

```bash
node server.js
```

Necesita **solo Node 20.11 o superior**. Ni `npm install`, ni dependencias, ni build, ni framework. Las fuentes van dentro del proyecto. En una feria, lo que no se instala no falla: mantenga esa regla.

La consola imprime dos direcciones: la de la mesa y la de los mandos.

---

## 4. Lo que hay que rematar en la zona abierta

Por orden de importancia para el día del evento:

1. **Probar con teléfonos reales.** El QR se verificó contra un decodificador de software sobre nueve URLs distintas, pero una cámara real a contraluz es otra prueba. Pruebe iPhone y Android, y con la cámara nativa, no con una app.
2. **La red del stand.** Es donde esto se rompe de verdad. Casi todos los wifis de feria tienen aislamiento de clientes activado, que bloquea justo que el celular hable con el equipo. Ver la tabla de montajes en el README. **Pruébelo el día antes, no el día.**
3. **Una carrera completa de obstáculos con cuatro celulares a la vez.** Es lo único que no se pudo probar en vivo durante el desarrollo. Mire la latencia del botón y si el aviso de saltar/agacharse llega a tiempo.
4. **Reconexión.** El mando ya se reconecta solo y recupera su carril, pero pruebe a apagar el wifi del teléfono a mitad de carrera y ver qué pasa.
5. **Cuatro jinetes mezclados**: dos por teclado y dos por celular. Está contemplado en el código pero no probado.

### Cosas que quedaron sabidas y sin hacer

- La lámina de resultado se descarga en el disco del equipo del stand, no en el celular del visitante. Hoy se resuelve pidiéndole que le tome una foto a la pantalla. Mandarla al teléfono sería una mejora real y cae dentro de su zona.
- La revisión de UX propuso pedir el contacto **después** de correr y no antes. VLA decidió que va antes, porque el ranking compite por créditos VLA y hace falta poder avisarle al que gana. No lo cambie por su cuenta.

---

## 5. Contexto que conviene leer

| Archivo | Qué le va a contar |
|---|---|
| `README.md` | Operación del stand, mecánicas, calibración medida, montaje de red |
| `PRODUCT.md` | Para quién es esto, el tono, los principios y las anti-referencias |
| `DESIGN.md` | Color en OKLCH, tipografía, componentes y prohibiciones del sistema visual |

Tres cosas que explican casi todas las decisiones raras que va a encontrar:

**El dibujo no afecta la velocidad, a propósito.** Si dibujar bien diera ventaja, media fila se iría antes de jugar. Hay una prueba automática que lo defiende.

**Los rivales grabados no son los tres mejores del día.** Se elige el récord, uno del montón y el más flojo, para que quien llega tenga a quién ganarle y no se vaya derrotado.

**El usuario es alguien que pasaba por un pasillo y decide en dos segundos si se queda**, con tres personas mirándolo y cola detrás. Cada segundo de fricción cuesta. Si una decisión suya le añade un paso, probablemente no valga la pena.

---

## 6. Antes de devolver el trabajo

- [ ] `node verificar.js` en verde
- [ ] El recorrido de teclado sigue funcionando igual (no toque nada y compruébelo)
- [ ] QR escaneado con un iPhone y con un Android reales
- [ ] Una carrera completa de obstáculos con cuatro celulares
- [ ] Probado en la red que se va a usar el día del evento
- [ ] Sin dependencias nuevas en `package.json`

Cualquier duda sobre por qué algo está como está: está escrito en los comentarios del propio código. No están de adorno; casi todos explican una decisión que costó una medición.
