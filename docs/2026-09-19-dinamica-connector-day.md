# Dinámica del stand — Connector Day 2026 · $ketch Race

**Estado:** especificación aprobada para construir (Josué, noche del 18-sep-2026: "te doy permiso de
que ejecutes una nueva versión con lo que creas que es lo mejor"). Rollback: tag `estable-2026-09-18`.

## 1. Objetivo de negocio

El stand tiene un solo fin: **matrículas**. Todo lo demás (voluntarios, juego, premios) es el embudo:

```
Voluntario en el pasillo ──QR personal──▶ Registro (lead, $2 al voluntario)
       │                                        │
       └── "¿Querés ganarte créditos VLA?"      ▼
                                   Elegir carrera (certificación + salario de mercado)
                                                │
                                                ▼
                                   Dibujar corredor ──▶ Carrera en la pantalla grande
                                                │
                                                ▼
                            Acta en la pantalla + PREMIO en el celular (todos ganan algo)
                                                │
                              ┌─────────────────┴──────────────────┐
                              ▼                                    ▼
             WhatsApp "quiero reclamar mi premio"       Webinar 24-sep (cupo por WhatsApp)
                              │
                              ▼
                       Asesor VLA cierra la matrícula (lead ya está en Bitrix con TODO el contexto)
```

Principio (del council del 18-sep, unánime en los 3 cerebros): la educación NO pasa durante la
carrera (ahí solo se mira ganar). Pasa **antes** (elegir carrera con salario real) y **después**
(acta con perfil + premio + CTA). Nada de banderines en la pista, nada de "Money Machine".

## 2. Actores y dispositivos

| Actor | Dispositivo | Qué ve |
|---|---|---|
| Voluntario (cobra $2/lead) | Sticker/lanyard con su QR personal | `…/mando?v=CODIGO` |
| Visitante | Su celular | Registro → carrera → dibujo → botón → premio |
| Mesa | TV/mini-PC en kiosco (2–3 salas simultáneas) | Portada, QR de sala, carrera, acta |
| Asesor VLA | Su WhatsApp | El mensaje precargado del visitante con puesto y carrera |
| Coordinador | Celular/PC | Panel `/voluntarios.html` (leads por voluntario, $ a pagar, QR para imprimir) |

## 3. Dos puertas de entrada al mismo formulario

1. **QR del voluntario** → `/mando?v=CODIGO`. Formulario completo. Al enviar: lead al servidor
   (atribuido al voluntario) aunque la persona nunca corra. Luego el celular pide el **código de la
   pantalla** (4 letras) donde va a correr. El perfil (nombre, WhatsApp, correo, carrera, voluntario)
   queda en `localStorage`: si después escanea el QR de la TV, entra directo sin reescribir nada.
2. **QR de la TV** → `/mando?s=SALA`. Si hay perfil guardado, se salta el formulario; si no, formulario
   completo (lead atribuido a `stand`).

Dedupe en el servidor por teléfono normalizado: la misma persona cuenta **una** vez por evento.

## 4. Elegir carrera = el sticker

La pantalla "¿Con qué salario querés arrancar?" reemplaza el selector de sticker. Elegir una carrera
pone automáticamente el sticker de esa certificación en el corredor (cosmético, física intacta).
Fuente de verdad: `src/carreras.js`. Rangos de mercado con fuente citada (investigado 18-sep):

| Carrera | Sticker | Rango mensual (USD) | Fuente |
|---|---|---|---|
| Cyber Seguridad (CompTIA Security+) | CYB | 1,500–2,500 | SalaryExpert / portales CR |
| Cloud · AWS | AWS | 1,600–3,250 | Talently / SalaryExpert |
| Redes · Cisco (CCNA) | CCNA | 1,240–2,050 | Tusalario.org |
| Gestión de Proyectos (PMP) | PMP | 4,000–5,800 | Levels.fyi |
| AI Builders | AIB | sin dato en CR → "Alta demanda" | — |

Siempre con la nota "rango de mercado, no salario garantizado".

## 5. Premios (todos ganan; el puesto decide cuánto)

Precedente real de VLA (Expo U 2024 en Bitrix): "$25 (VLA Cred.)", "$75 (VLA Cred.) + asesoría".
Configurable en `src/config.js` — **valores por defecto a confirmar por Josué**:

| Puesto | Premio |
|---|---|
| 1.º | $100 en créditos VLA + asesoría de carrera gratis |
| 2.º | $75 en créditos VLA |
| 3.º | $50 en créditos VLA |
| 4.º | $25 en créditos VLA |

Se reclama por WhatsApp desde el celular con mensaje precargado:
> Hola, soy {nombre}. Acabo de correr $ketch Race en el Connector Day y quedé de {puesto}.º.
> Quiero reclamar mis {premio} para la certificación de {carrera}.

## 6. Webinar 24 de septiembre

"Cómo no ser reemplazado por la inteligencia artificial". CTA secundario en el celular tras la
carrera y en el acta de la TV. Sin link de registro conocido → cupo por WhatsApp (mensaje
precargado). Si aparece el link, va en `config.WEBINAR_URL`.

## 7. Bitrix (verificado en vivo el 18-sep)

- `SOURCE_ID = CONNECTOR_DAY_2026` (creado el 19-sep, id interno 945).
- `ASSIGNED_BY_ID = 4391` (usuario "Boletin") · `STATUS_ID = JUNK` ("NO USAR Base de datos") —
  es la bandeja de espera que VLA usa para todo lead de stand; un asesor lo reasigna a mano.
- `UTM_SOURCE = <código del voluntario | stand>` · `UTM_CAMPAIGN = sketch-race-connector-day` ·
  `UTM_CONTENT = <carrera>`.
- Al terminar la carrera: `crm.lead.update` con COMMENTS (puesto, tiempo, carrera, premio).
- El webhook vive SOLO en el servidor (`BITRIX_WEBHOOK_URL` en Railway). Nunca en el navegador.

## 8. Voluntarios y pago

- `data/leads.jsonl` (una línea por lead) y `data/voluntarios.json` (contador por código) en el
  contenedor. Railway no tiene volumen: la **verdad durable es Bitrix** (`UTM_SOURCE`). El panel
  cruza ambas fuentes; si el disco se perdió, cuenta desde Bitrix.
- `/voluntarios.html?clave=<PANEL_CLAVE>`: tabla código · nombre · leads · $ (leads × 2), CSV, y
  un QR imprimible por voluntario (`/mando?v=CODIGO`). Alta de voluntarios desde el mismo panel.

## 9. Pantalla grande

- Marca: "$ketch Race" (el $ grande en verde) + logo VLA. La pista y la física no cambian.
- Acta: cada fila muestra la carrera elegida; una línea fija con los premios por puesto y
  "reclamá en tu celular"; QR pequeño del webinar/WhatsApp.
- **Kiosco desatendido:** desde el acta vuelve sola a la portada a los 60 s sin actividad.

## 10. Lo que NO se hace

- Tocar `race.js`, `cursos.js`, `scene.js`, `hero.js` (`node verificar.js` en verde, siempre).
- Mostrar "Money Machine". Inventar cifras. Mandar el webhook al navegador.
