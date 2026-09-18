# Caballos de Fuerza · VLA

Experiencia de stand para ferias de tecnología. Hasta cuatro personas dibujan cada una su caballo en un solo equipo y después lo ponen a correr aporreando un botón cada una.

Inspirado en la mecánica de [oddhoof.cc](https://oddhoof.cc); código, marca y diseño propios. La diferencia de fondo: allá se corre solo, aquí corren **hasta cuatro humanos a la vez**, y los carriles que sobran los llenan **corridas grabadas de gente que ya pasó por el stand**.

> ### ⚠️ Si le entregaron este proyecto para trabajar en él, lea primero [HANDOFF.md](HANDOFF.md)
>
> La física del juego y la perspectiva de la pista están **congeladas** y hay un verificador que lo comprueba (`node verificar.js`). La zona de trabajo abierta es el juego desde el celular por QR.

---

## Las tres carreras

| Carrera | Largo | Qué la hace distinta |
|---|---|---|
| **Los 100 llanos** | 100 m | Sin accidentes. Gana el pulso más parejo. Unos 11 s. |
| **La subida** | 180 m | Una cuesta al medio que **iguala al pelotón**: arriba todos quedan reducidos al mismo trote por mucho impulso que traigan. Unos 24 s. |
| **La pista de obstáculos** | 140 m | Seis obstáculos y **dos botones más**: uno se salta y otro se pasa agachado. Unos 17 s bien jugada, 22 s sin tocarlos. |

Cada carrera tiene su propio ranking: un tiempo de 100 m y uno de 180 m no se comparan.

## Fantasmas

Cada corrida terminada se guarda con los **tiempos exactos de cada pulsación**. Cuando alguien corre y sobran carriles, esos carriles los ocupan personas que ya jugaron: el motor vuelve a correr su carrera tal cual la corrieron. No es vídeo, es la misma simulación con sus pulsaciones.

Los rivales no son los tres mejores del día, a propósito: se elige **el récord, uno del montón y el más flojo**, para que el que llega tenga a quién ganarle y no se vaya derrotado. La máquina solo sale cuando todavía no hay grabaciones de esa carrera, o sea al abrir el stand.

## Cómo se juega

1. **Empezar**, elegir carrera y cuántos jinetes (1 a 4).
2. Cada jinete, por turnos: escribe su nombre, deja su WhatsApp o correo si quiere, y dibuja su caballo. Si se bloquea, **Présteme uno** le da el caballo de la casa.
3. En la parrilla cada quien ve su botón asignado.
4. Cuenta atrás y a correr. Cada jinete aporrea **su** tecla.
5. **Acta**: su puesto, su tiempo y el ranking histórico de esa carrera al lado. Desde ahí puede **retar** a cualquier persona de la tabla y correr contra su corrida grabada, o abrir la lámina a pantalla completa para que le tome una foto.

## Lo único que hay que saber para operar el stand

| Acción | Dónde |
|---|---|
| Empezar una ronda | Botón **Empezar** en la portada |
| Cambiar las teclas de los carriles | Arriba a la derecha en la portada |
| Ver el ranking del día | **Ranking del evento** en la portada |
| **Modo promotor** (exportar y reiniciar) | **Ctrl + Shift + E** desde cualquier pantalla |
| Sacar los contactos del día | Modo promotor → **Exportar contactos** (descarga un CSV) |
| Borrar todo y empezar limpio | Modo promotor → **Reiniciar evento** |

Exportar contactos y reiniciar el evento están detrás de una combinación de teclas y no en una pantalla pública **a propósito**: son ocho horas de captación y los teléfonos de terceros. Un visitante no puede descubrirlos por accidente.

**Atajos:** `Enter` dispara la acción principal de cada pantalla (empezar, dar la salida, otra carrera), porque cuatro personas ocupan el teclado y buscar el ratón no es una opción. `Esc` abandona una carrera o cierra cualquier ventana. Si nadie toca nada durante 100 segundos, la pantalla vuelve sola a la portada.

### Los botones

Cada jinete tiene una **columna vertical del teclado**: arriba salta, en medio corre, abajo se agacha. La posición dice lo que hace.

| Jinete | Saltar | Correr | Agacharse |
|---|---|---|---|
| 1 | `Q` | `A` | `Z` |
| 2 | `R` | `F` | `V` |
| 3 | `U` | `J` | `M` |
| 4 | `O` | `L` | `.` |

En los 100 llanos y en la subida solo se usa la del medio. Si usa botones arcade USB, entran como pulsaciones normales: abra la configuración, toque una ranura y presione el botón físico.

---

## Jugar desde el celular

Hay dos maneras de jugar y las dos funcionan:

**Con el teclado de la mesa.** Es la de siempre y no necesita red de ninguna clase. Cuatro personas alrededor de un teclado.

**Con los celulares.** Cada quien entra desde su teléfono, dibuja su caballo con el dedo y durante la carrera tiene tres botones a pantalla completa. La carrera sigue siendo una sola, en la pantalla grande.

> Ojo con la referencia: **oddhoof no hace esto.** Su código tiene backend (`/api/leaderboard`, `/api/ghosts`) pero ni un WebSocket. Cuando dice que se puede jugar en el celular, quiere decir que la página es responsive y uno juega solo, entero, en su teléfono. Cuatro amigos serían cuatro partidas sueltas que solo se cruzan como fantasmas en el ranking. Lo de aquí es otra cosa: cuatro mandos de una misma carrera.

### Cómo se conectan

1. En la mesa: **Empezar → elegir carrera → «Que jueguen desde su celular»**.
2. Sale un **código QR** y un código de sala de cuatro letras.
3. Cada participante escanea con la cámara del teléfono. No se instala nada.
4. Dibuja, toca «Esto es un caballo» y espera.
5. El promotor da la salida desde la mesa.

El celular no simula nada: dibuja y manda pulsaciones. Toda la carrera vive en la mesa, en un solo sitio, y eso es lo que garantiza que los cuatro vean exactamente la misma carrera y que nadie pueda adelantar su propio reloj.

### La red del stand, que es donde esto se rompe

**Los celulares y el equipo tienen que estar en la misma red, y esa red tiene que dejar que se hablen entre sí.** Por orden de menos a más riesgo:

| Montaje | Qué tal |
|---|---|
| **Router de viaje propio** en el stand, sin internet | **Lo recomendado.** Cuesta poco, no depende de nadie y nunca aísla clientes. |
| **Zona wifi del propio equipo** (Mobile Hotspot de Windows) | Funciona bien. En equipos corporativos a veces está bloqueada por política. |
| **WiFi del recinto** | **El que falla.** Casi todos los wifis de feria tienen aislamiento de clientes activado, que bloquea justo esto. Pruébelo el día antes, no el día. |

La pantalla de la sala muestra la dirección exacta a la que hay que entrar. Si el equipo está en varias redes, muestra las otras debajo para probar.

Si el juego se abrió sin `node server.js` (por ejemplo, la versión publicada en la web), la sala lo dice y el teclado sigue funcionando igual.

### Detalles del mando

- Tres botones a pantalla completa: **arriba saltar, en medio correr, abajo agacharse**, la misma disposición que las teclas de la mesa.
- Responde a `pointerdown`, no a `click`: el `click` de un móvil llega tarde y esto es un juego de ritmo.
- Vibración corta como acuse, porque en una feria con ruido el pulgar no oye nada.
- La pantalla no se apaga a media carrera.
- Si se cae el wifi, el mando se vuelve a conectar solo y recupera su carril.
- El QR se genera en el propio equipo, sin internet ni librerías. El codificador está en [`src/qr.js`](src/qr.js) y se verificó contra un decodificador real.

## La mecánica, y por qué está así

**El dibujo no afecta la velocidad. Ni un poco.** Es puramente estético. Lo único que decide la carrera es el ritmo con que cada jinete aporrea su botón. Es una decisión deliberada: si dibujar bien diera ventaja, media fila se iría antes de jugar.

El botón da un impulso que se escapa solo, con una espera mínima de 0,18 s entre pulsaciones válidas. Machacar sin ritmo no sirve: las pulsaciones que caen dentro de la espera se descartan. Además hay una prima de hasta +40% para la cadencia pareja, así que el que va como metrónomo le gana al que va a lo loco.

Calibración medida, no estimada:

| Cómo juega | 100 llanos | La subida | Obstáculos |
|---|---|---|---|
| Metrónomo (~0,20 s) | 10,8 s | 22,7 s | 15,0 s, ninguna valla |
| Buena (~0,26 s) | 11,6 s | 23,6 s | 15,6 s, ninguna valla |
| Floja (~0,33 s) | 12,5 s | 24,9 s | 19,0 s, dos vallas |
| Sin tocar el botón | 17,6 s | 33,4 s | 31,8 s, las seis |

**La cuesta iguala, no castiga.** La primera versión multiplicaba la velocidad por la pendiente y, medida, hacía lo contrario de lo que sirve: el líder pasaba de 7,3 m de ventaja al pie a 16,2 m en la cima. Ahora la cuesta pone un techo de velocidad, así que arriba el pelotón se junta (9,6 m) y la carrera sigue peleada.

Todo esto se ajusta en las constantes de arriba de [`src/race.js`](src/race.js) y en [`src/cursos.js`](src/cursos.js).

### Saltar y agacharse

En oddhoof estos dos obstáculos son **pasivos**: se resuelven con un deslizador de largo de pata antes de correr y durante la carrera el jugador no hace nada. Aquí son **activos**.

- El de **saltar** es una valla baja. El de **agacharse** es un travesaño por encima de la cabeza. La forma dice la acción; no hay código de color porque los colores ya son de los carriles.
- Quince metros antes aparece el aviso con la tecla que toca, tenue. Cuando de verdad toca pulsar, **se enciende**. Sin eso sería un juego de cronometrar; con eso es un juego de reaccionar, que es lo único aprendible de pie en un pasillo.
- Ventanas medidas: **0,62 s** para saltar y **0,54 s** para agacharse. Muy por encima del tiempo de reacción humano.
- Hacer la acción contraria es peor que no hacer nada: saltar hacia un travesaño es estrellarse (1,25 s contra 0,90 s).
- Agacharse frena al 74%. Si no, bastaría con ir agachado toda la pista.
- El salto dura fijo, así que **a más velocidad se cubre más terreno en el aire** y la ventana se cierra. Correr rápido vuelve la pista más difícil: esa tensión es el juego.

Medido en la pista de obstáculos, cadencia media: **17,2 s** pasándolos todos · **23,0 s** sin tocar los botones · **25,5 s** haciendo siempre lo contrario.

**El truco de la animación:** el dibujo nunca se riggea. Se toman los trazos crudos del participante y se mueve con un seno todo punto que caiga en el tercio inferior del dibujo, agrupado en cuatro columnas con fases distintas. El ojo lo lee como patas galopando. Está en `caballo()` dentro de [`src/scene.js`](src/scene.js).

---

## Datos y privacidad

- Todo vive en el `localStorage` **del equipo del stand**. No hay servidor, no hay nube, no sale nada a internet.
- **WhatsApp y correo son obligatorios para jugar.** No es un peaje: el ranking compite por créditos VLA y hacen falta los datos para avisarle a quien gane. La pantalla lo dice antes de pedirlos, que es lo que hace que la gente los dé sin problema.
- Los dos campos se validan de verdad: al menos ocho dígitos en el teléfono, y arroba con dominio en el correo. Un dato inventado a la carrera no sirve en el CRM.
- El CSV sale con fecha, nombre, teléfono, correo, autorización y origen. Listo para importar.
- **Reiniciar evento** borra ranking, corridas grabadas y contactos de ese equipo, y no se puede deshacer.
- Si va a usar el mismo equipo en varias ferias, exporte antes de reiniciar.

---

## Levantarlo

**Requisito único: Node 20.11 o superior.** Ni `npm install`, ni dependencias, ni build.

### En el stand, sin internet

Doble clic en **`start.bat`**. Abre el navegador en `http://localhost:4173` y deja el servidor corriendo en una consola; no la cierre.

Necesita Node instalado y nada más: ni `npm install`, ni dependencias, ni conexión. Las fuentes van dentro del proyecto.

```bash
node server.js
```

Después, **F11** para pantalla completa.

### Publicado

Es un sitio estático. Se sube tal cual:

```bash
vercel --prod
```

Todo funciona igual en la web, con una diferencia: el ranking y los contactos quedan en el navegador de cada visitante, no en un tablero común. Para la feria use la versión local.

---

## Estructura

```
index.html          Las ocho pantallas
style.css           Sistema visual (ver DESIGN.md)
fonts/              Archivo variable, servido localmente
src/
  app.js            Orquestador: pantallas, estado, teclas, exportación
  draw.js           Tablero de dibujo, trazos vectoriales
  scene.js          Pista en falso 3D y galope de los dibujos
  race.js           Motor de carrera, fantasmas y calibración
  cursos.js         Las tres carreras: perfil del terreno y vallas
  hero.js           El caballo que trota en la portada
  poster.js         Lámina de resultado 1080×1350
  store.js          localStorage: contactos, corridas grabadas, teclas
mando.html          La pantalla del celular
mando.css           Estilos del mando, pensados para un pulgar
src/
  mando.js          Lo que corre en el celular
  sala.js           Lado mesa de la conexión
  qr.js             Codificador de QR propio, sin dependencias
server.js           Estático + sala en tiempo real (WebSocket a pelo)
verificar.js        Candado: hashes + 22 pruebas de que el juego sigue igual
blindaje.json       Hashes de los archivos congelados
HANDOFF.md          Instrucciones para quien reciba el proyecto
PRODUCT.md          Público, tono, principios, anti-referencias
DESIGN.md           Color, tipografía, componentes, prohibiciones
```

Sin frameworks, sin build, sin dependencias. En una feria, lo que no se instala no falla.

## Antes de la feria

- [ ] Probar `start.bat` en el equipo que va a ir, no en otro.
- [ ] Probar las cuatro teclas con cuatro personas de verdad alrededor del teclado.
- [ ] Si va a usar celulares: montar la red **el día antes** y probar con dos teléfonos distintos que el QR abra la página.
- [ ] Comprobar que el wifi del stand no aísla clientes (si un celular no carga la página, es eso).
- [ ] Si hay botones arcade, reasignarlos en la configuración y verificar los cuatro.
- [ ] Desactivar suspensión y salvapantallas del equipo.
- [ ] **Ctrl+Shift+E → Reiniciar evento** para arrancar el ranking limpio.
- [ ] Al cerrar el día: **Ctrl+Shift+E → Exportar contactos** antes de apagar.
