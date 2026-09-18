/* ═══════════════════════════════════════════════════
   CÓDIGO QR — versiones 1 a 6, modo byte, corrección M
   ═══════════════════════════════════════════════════
   Escrito a mano porque el proyecto no lleva dependencias y porque en un
   stand la alternativa es que la gente teclee una IP con fila detrás.

   Con la versión 6 caben 106 caracteres: de sobra para una URL de red
   local como http://192.168.1.50:4173/mando?s=ABCD (38).
*/

/* Por versión: [datos, ec] de cada bloque, y centros de los patrones de alineación */
const VERSIONES = [
  null,
  { bloques: [[16, 10]], alineacion: [] },
  { bloques: [[28, 16]], alineacion: [6, 18] },
  { bloques: [[44, 26]], alineacion: [6, 22] },
  { bloques: [[32, 18], [32, 18]], alineacion: [6, 26] },
  { bloques: [[43, 24], [43, 24]], alineacion: [6, 30] },
  { bloques: [[27, 16], [27, 16], [27, 16], [27, 16]], alineacion: [6, 34] }
];

/* ───────── Aritmética en GF(256) ───────── */

const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x; LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/**
 * Polinomio generador de `n` términos, en grado DESCENDENTE: g[0] es el
 * coeficiente principal. El orden importa: corregir() lee g[i+1] dando por
 * hecho que g[0] es el término de mayor grado, y construirlo al revés
 * produce una corrección de errores que parece válida y no lo es.
 */
export function generador(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const nuevo = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      nuevo[j] ^= g[j];                     // · x
      nuevo[j + 1] ^= mul(g[j], EXP[i]);    // · α^i
    }
    g = nuevo;
  }
  return g;
}

export function corregir(datos, n) {
  const g = generador(n);
  const resto = new Array(n).fill(0);
  for (const byte of datos) {
    const factor = byte ^ resto[0];
    resto.shift(); resto.push(0);
    if (factor !== 0) for (let i = 0; i < n; i++) resto[i] ^= mul(g[i + 1], factor);
  }
  return resto;
}

/* ───────── Construcción ───────── */

function versionPara(largo) {
  for (let v = 1; v <= 6; v++) {
    const datos = VERSIONES[v].bloques.reduce((a, [d]) => a + d, 0);
    if (largo + 2 <= datos) return v;      // +2: indicador de modo y contador
  }
  throw new Error("El texto no cabe en un QR de versión 6");
}

export function bitsDeDatos(bytes, version) {
  const bits = [];
  const mete = (valor, n) => { for (let i = n - 1; i >= 0; i--) bits.push((valor >> i) & 1); };
  mete(0b0100, 4);                    // modo byte
  mete(bytes.length, 8);              // contador (8 bits hasta la versión 9)
  for (const b of bytes) mete(b, 8);

  const totalDatos = VERSIONES[version].bloques.reduce((a, [d]) => a + d, 0);
  const capacidad = totalDatos * 8;
  for (let i = 0; i < 4 && bits.length < capacidad; i++) bits.push(0);   // terminador
  while (bits.length % 8) bits.push(0);

  const palabras = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let k = 0; k < 8; k++) b = (b << 1) | bits[i + k];
    palabras.push(b);
  }
  const relleno = [0xec, 0x11];
  for (let i = 0; palabras.length < totalDatos; i++) palabras.push(relleno[i % 2]);
  return palabras;
}

function entrelazar(palabras, version) {
  const { bloques } = VERSIONES[version];
  const datos = [], ec = [];
  let off = 0;
  for (const [nd, ne] of bloques) {
    const trozo = palabras.slice(off, off + nd);
    off += nd;
    datos.push(trozo);
    ec.push(corregir(trozo, ne));
  }
  const salida = [];
  const maxD = Math.max(...datos.map(b => b.length));
  for (let i = 0; i < maxD; i++) for (const b of datos) if (i < b.length) salida.push(b[i]);
  const maxE = Math.max(...ec.map(b => b.length));
  for (let i = 0; i < maxE; i++) for (const b of ec) if (i < b.length) salida.push(b[i]);
  return salida;
}

/* ───────── Matriz ───────── */

function plantilla(version) {
  const n = 17 + 4 * version;
  const m = Array.from({ length: n }, () => new Array(n).fill(null));
  const reservado = Array.from({ length: n }, () => new Array(n).fill(false));

  const buscador = (fr, fc) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const y = fr + r, x = fc + c;
      if (y < 0 || y >= n || x < 0 || x >= n) continue;
      const dentro = r >= 0 && r <= 6 && c >= 0 && c <= 6 &&
        (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      m[y][x] = dentro ? 1 : 0;
      reservado[y][x] = true;
    }
  };
  buscador(0, 0); buscador(0, n - 7); buscador(n - 7, 0);

  // Temporización
  for (let i = 8; i < n - 8; i++) {
    m[6][i] = i % 2 === 0 ? 1 : 0; reservado[6][i] = true;
    m[i][6] = i % 2 === 0 ? 1 : 0; reservado[i][6] = true;
  }

  // Alineación
  const ali = VERSIONES[version].alineacion;
  for (const fr of ali) for (const fc of ali) {
    if ((fr <= 8 && fc <= 8) || (fr <= 8 && fc >= n - 9) || (fr >= n - 9 && fc <= 8)) continue;
    for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) {
      m[fr + r][fc + c] = (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) ? 1 : 0;
      reservado[fr + r][fc + c] = true;
    }
  }

  // Módulo oscuro y huecos del formato
  m[n - 8][8] = 1; reservado[n - 8][8] = true;
  for (let i = 0; i < 9; i++) {
    if (!reservado[8][i]) { reservado[8][i] = true; m[8][i] = 0; }
    if (!reservado[i][8]) { reservado[i][8] = true; m[i][8] = 0; }
  }
  for (let i = 0; i < 8; i++) {
    if (!reservado[8][n - 1 - i]) { reservado[8][n - 1 - i] = true; m[8][n - 1 - i] = 0; }
    if (!reservado[n - 1 - i][8]) { reservado[n - 1 - i][8] = true; m[n - 1 - i][8] = 0; }
  }
  return { m, reservado, n };
}

function colocar(m, reservado, n, palabras) {
  const bits = [];
  for (const b of palabras) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  let k = 0, arriba = true;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;                       // la columna de temporización se salta
    for (let paso = 0; paso < n; paso++) {
      const fila = arriba ? n - 1 - paso : paso;
      for (const c of [col, col - 1]) {
        if (reservado[fila][c]) continue;
        m[fila][c] = k < bits.length ? bits[k] : 0;
        k++;
      }
    }
    arriba = !arriba;
  }
}

const MASCARAS = [
  (r, c) => (r + c) % 2 === 0,
  r => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
];

function penalizar(m, n) {
  let p = 0;
  // Rachas de cinco o más
  for (let i = 0; i < n; i++) {
    for (const leer of [(a, b) => m[a][b], (a, b) => m[b][a]]) {
      let run = 1;
      for (let j = 1; j < n; j++) {
        if (leer(i, j) === leer(i, j - 1)) run++;
        else { if (run >= 5) p += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) p += 3 + (run - 5);
    }
  }
  // Bloques de 2×2
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
    const v = m[r][c];
    if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) p += 3;
  }
  // Patrón 1011101 con espacio
  const patron = [1, 0, 1, 1, 1, 0, 1];
  const buscar = linea => {
    let n2 = 0;
    for (let i = 0; i + 7 <= linea.length; i++) {
      if (patron.every((v, k) => linea[i + k] === v)) {
        const antes = linea.slice(Math.max(0, i - 4), i);
        const despues = linea.slice(i + 7, i + 11);
        if ((antes.length === 4 && antes.every(v => v === 0)) ||
            (despues.length === 4 && despues.every(v => v === 0))) n2++;
      }
    }
    return n2;
  };
  for (let i = 0; i < n; i++) {
    p += 40 * buscar(m[i]);
    p += 40 * buscar(m.map(f => f[i]));
  }
  // Desequilibrio de oscuros
  let oscuros = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) oscuros += m[r][c];
  p += 10 * Math.floor(Math.abs((oscuros * 100) / (n * n) - 50) / 5);
  return p;
}

function escribirFormato(m, n, mascara) {
  // Nivel M = 00, más los tres bits de la máscara, con BCH(15,5) y XOR 0x5412
  let datos = (0b00 << 3) | mascara;
  let bch = datos << 10;
  for (let i = 4; i >= 0; i--) if ((bch >> (i + 10)) & 1) bch ^= 0x537 << i;
  const formato = ((datos << 10) | bch) ^ 0x5412;
  // El primer módulo que se escribe lleva el bit MÁS significativo: la
  // cadena de formato se coloca de izquierda a derecha, no al revés.
  const bit = i => (formato >> (14 - i)) & 1;

  for (let i = 0; i <= 5; i++) m[8][i] = bit(i);
  m[8][7] = bit(6); m[8][8] = bit(7); m[7][8] = bit(8);
  for (let i = 9; i <= 14; i++) m[14 - i][8] = bit(i);

  // Segunda copia: los bits 0 a 6 bajan por la columna 8 y los bits 7 a 14
  // salen por la fila 8. El módulo oscuro se cuela entre los dos tramos y
  // no es un bit de formato: escribirlo ahí desplaza todo lo demás.
  for (let i = 0; i <= 6; i++) m[n - 1 - i][8] = bit(i);
  for (let i = 7; i <= 14; i++) m[8][n - 15 + i] = bit(i);
  m[n - 8][8] = 1;   // módulo oscuro, siempre
}

/** Devuelve una matriz de 0 y 1 lista para pintar. */
export function generarQR(texto) {
  const bytes = [...new TextEncoder().encode(texto)];
  const version = versionPara(bytes.length);
  const palabras = entrelazar(bitsDeDatos(bytes, version), version);
  const { m, reservado, n } = plantilla(version);
  colocar(m, reservado, n, palabras);

  let mejor = null;
  for (let mascara = 0; mascara < 8; mascara++) {
    const copia = m.map(f => f.slice());
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!reservado[r][c] && MASCARAS[mascara](r, c)) copia[r][c] ^= 1;
    }
    escribirFormato(copia, n, mascara);
    const p = penalizar(copia, n);
    if (!mejor || p < mejor.p) mejor = { p, m: copia };
  }
  return mejor.m;
}

/** Pinta el QR en un canvas, con su margen obligatorio de cuatro módulos. */
export function pintarQR(canvas, texto, { claro = "#F2F6F2", oscuro = "#0F1210" } = {}) {
  const m = generarQR(texto);
  const n = m.length, margen = 4, total = n + margen * 2;
  const lado = Math.max(1, Math.floor(canvas.width / total));
  const c = canvas.getContext("2d");
  canvas.width = canvas.height = lado * total;
  c.fillStyle = claro;
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = oscuro;
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) {
    if (m[r][col]) c.fillRect((col + margen) * lado, (r + margen) * lado, lado, lado);
  }
}
