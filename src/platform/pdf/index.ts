// platform/pdf: genera documentos PDF simples (encabezado, bloques de datos, tablas y pie) con pdf-lib, en JavaScript
// puro: funciona en la EC2 t3.small sin Chromium. Lo usan la ficha de matrícula (US20) y la boleta de pago (US25).
import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

/** Pares «etiqueta: valor» en dos columnas. */
export interface BloqueDatos {
  tipo: "datos";
  titulo: string;
  filas: [etiqueta: string, valor: string][];
}

export interface ColumnaTabla {
  titulo: string;
  /** Fracción del ancho útil (las de una tabla suman 1). */
  ancho: number;
  alinear?: "izquierda" | "derecha";
}

export interface BloqueTabla {
  tipo: "tabla";
  titulo: string;
  columnas: ColumnaTabla[];
  filas: string[][];
  /** Texto si la tabla no tiene filas. */
  vacio?: string;
}

export interface BloqueTexto {
  tipo: "texto";
  texto: string;
}

export type BloquePdf = BloqueDatos | BloqueTabla | BloqueTexto;

export interface DocumentoPdf {
  /** Nombre interno para el log de errores; nunca lleva datos personales («ficha-matricula»). */
  nombre: string;
  institucion: string;
  titulo: string;
  subtitulo?: string;
  bloques: BloquePdf[];
  /** Línea al pie de cada página, por ejemplo la fecha de generación. */
  pie?: string;
  /**
   * Fecha que se graba en los metadatos del PDF. Con una fecha fija (por ejemplo, la del pago) el mismo documento
   * produce siempre los mismos bytes y el mismo SHA-256 (US25). Sin ella se usa el momento actual.
   */
  fechaDocumento?: Date;
  /** Marca de agua en diagonal sobre cada página, por ejemplo «ANULADO». */
  marcaAgua?: string;
}

// A4 en puntos y medidas del diseño
const ANCHO_PAGINA = 595.28;
const ALTO_PAGINA = 841.89;
const MARGEN = 48;
const ANCHO_UTIL = ANCHO_PAGINA - 2 * MARGEN;
const TAMANO_TEXTO = 10;
const COLOR_TEXTO = rgb(0.1, 0.13, 0.2);
const COLOR_SECUNDARIO = rgb(0.38, 0.42, 0.5);
const COLOR_MARCA = rgb(0.106, 0.302, 0.537);
const COLOR_BORDE = rgb(0.85, 0.87, 0.9);
const COLOR_MARCA_AGUA = rgb(0.84, 0.27, 0.27);
const TAMANO_MARCA_AGUA = 96;
const OPACIDAD_MARCA_AGUA = 0.25;
const ANGULO_MARCA_AGUA = 45;

/** Caracteres extra de Windows-1252 (fuente estándar del PDF) fuera de Latin-1. */
const EXTRAS_WIN_ANSI = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

/**
 * Deja solo caracteres que la fuente estándar puede dibujar: ASCII, Latin-1 (tildes, ñ, ü, °, «») y los extras de
 * Windows-1252. Los demás se reemplazan por «?» en lugar de hacer fallar el documento.
 */
export function textoImprimible(texto: string): string {
  let r = "";
  for (const c of texto.normalize("NFC")) {
    const codigo = c.codePointAt(0)!;
    if (c === "\t" || c === "\n") r += " ";
    else if ((codigo >= 0x20 && codigo <= 0x7e) || (codigo >= 0xa0 && codigo <= 0xff) || EXTRAS_WIN_ANSI.has(c)) r += c;
    else r += "?";
  }
  return r;
}

/** Parte el texto en líneas que entran en el ancho dado. */
function partirLineas(texto: string, fuente: PDFFont, tamano: number, ancho: number): string[] {
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of textoImprimible(texto).split(" ")) {
    const candidata = actual ? `${actual} ${palabra}` : palabra;
    if (fuente.widthOfTextAtSize(candidata, tamano) <= ancho || !actual) actual = candidata;
    else {
      lineas.push(actual);
      actual = palabra;
    }
  }
  lineas.push(actual);
  return lineas;
}

class Lienzo {
  private pagina!: PDFPage;
  private y = 0;

  constructor(
    private readonly pdf: PDFDocument,
    private readonly fuente: PDFFont,
    private readonly negrita: PDFFont,
    private readonly doc: DocumentoPdf,
  ) {
    this.nuevaPagina();
  }

  private nuevaPagina() {
    this.pagina = this.pdf.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
    this.y = ALTO_PAGINA - MARGEN;
    this.escribir(this.doc.institucion, { x: MARGEN, tamano: 9, color: COLOR_SECUNDARIO });
    this.y -= 6;
    this.pagina.drawLine({
      start: { x: MARGEN, y: this.y },
      end: { x: ANCHO_PAGINA - MARGEN, y: this.y },
      thickness: 1,
      color: COLOR_MARCA,
    });
    this.y -= 18;
  }

  /** Asegura espacio para `alto` puntos; si no entra, continúa en otra página. */
  espacio(alto: number) {
    if (this.y - alto < MARGEN + 24) this.nuevaPagina();
  }

  escribir(
    texto: string,
    o: { x: number; tamano?: number; negrita?: boolean; color?: ReturnType<typeof rgb>; ancho?: number },
  ) {
    const tamano = o.tamano ?? TAMANO_TEXTO;
    const fuente = o.negrita ? this.negrita : this.fuente;
    const lineas = partirLineas(texto, fuente, tamano, o.ancho ?? ANCHO_PAGINA - MARGEN - o.x);
    for (const linea of lineas) {
      this.pagina.drawText(linea, {
        x: o.x,
        y: this.y - tamano,
        size: tamano,
        font: fuente,
        color: o.color ?? COLOR_TEXTO,
      });
      this.y -= tamano + 4;
    }
  }

  /** Alto que ocupará un texto, para decidir saltos de página. */
  altoDe(texto: string, ancho: number, tamano = TAMANO_TEXTO, negrita = false) {
    return partirLineas(texto, negrita ? this.negrita : this.fuente, tamano, ancho).length * (tamano + 4);
  }

  titulo() {
    this.escribir(this.doc.titulo, { x: MARGEN, tamano: 18, negrita: true, color: COLOR_MARCA });
    if (this.doc.subtitulo) this.escribir(this.doc.subtitulo, { x: MARGEN, tamano: 11, color: COLOR_SECUNDARIO });
    this.y -= 10;
  }

  private tituloBloque(texto: string) {
    this.espacio(40);
    this.escribir(texto, { x: MARGEN, tamano: 12, negrita: true });
    this.y -= 2;
  }

  datos(b: BloqueDatos) {
    this.tituloBloque(b.titulo);
    const anchoEtiqueta = ANCHO_UTIL * 0.32;
    for (const [etiqueta, valor] of b.filas) {
      const xValor = MARGEN + anchoEtiqueta;
      const alto = Math.max(
        this.altoDe(etiqueta, anchoEtiqueta - 8),
        this.altoDe(valor || "—", ANCHO_UTIL - anchoEtiqueta),
      );
      this.espacio(alto);
      const inicio = this.y;
      this.escribir(etiqueta, { x: MARGEN, color: COLOR_SECUNDARIO, ancho: anchoEtiqueta - 8 });
      const finEtiqueta = this.y;
      this.y = inicio;
      this.escribir(valor || "—", { x: xValor, ancho: ANCHO_UTIL - anchoEtiqueta });
      this.y = Math.min(this.y, finEtiqueta) - 2;
    }
    this.y -= 12;
  }

  private filaTabla(celdas: string[], columnas: ColumnaTabla[], negrita: boolean) {
    const anchos = columnas.map((c) => c.ancho * ANCHO_UTIL);
    const alto = Math.max(...celdas.map((c, i) => this.altoDe(c, anchos[i] - 8, TAMANO_TEXTO, negrita)));
    this.espacio(alto + 8);
    const inicio = this.y - 4;
    let fin = inicio;
    let x = MARGEN;
    celdas.forEach((celda, i) => {
      this.y = inicio;
      const texto = textoImprimible(celda);
      const derecha = columnas[i].alinear === "derecha";
      const fuente = negrita ? this.negrita : this.fuente;
      const xTexto = derecha ? x + anchos[i] - 4 - fuente.widthOfTextAtSize(texto, TAMANO_TEXTO) : x + 4;
      this.escribir(texto, { x: Math.max(x + 4, xTexto), negrita, ancho: anchos[i] - 8 });
      fin = Math.min(fin, this.y);
      x += anchos[i];
    });
    this.y = fin - 4;
    this.pagina.drawLine({
      start: { x: MARGEN, y: this.y },
      end: { x: ANCHO_PAGINA - MARGEN, y: this.y },
      thickness: 0.5,
      color: COLOR_BORDE,
    });
  }

  tabla(b: BloqueTabla) {
    this.tituloBloque(b.titulo);
    this.filaTabla(
      b.columnas.map((c) => c.titulo),
      b.columnas,
      true,
    );
    if (!b.filas.length && b.vacio) this.escribir(b.vacio, { x: MARGEN + 4, color: COLOR_SECUNDARIO });
    for (const fila of b.filas) this.filaTabla(fila, b.columnas, false);
    this.y -= 14;
  }

  texto(b: BloqueTexto) {
    this.espacio(this.altoDe(b.texto, ANCHO_UTIL));
    this.escribir(b.texto, { x: MARGEN, color: COLOR_SECUNDARIO, ancho: ANCHO_UTIL });
    this.y -= 8;
  }

  marcaAgua(texto: string) {
    const limpio = textoImprimible(texto);
    const ancho = this.negrita.widthOfTextAtSize(limpio, TAMANO_MARCA_AGUA);
    // centrada en la página: el texto gira alrededor de su esquina inferior izquierda
    const lado = ancho / Math.SQRT2;
    for (const p of this.pdf.getPages()) {
      p.drawText(limpio, {
        x: (ANCHO_PAGINA - lado) / 2,
        y: (ALTO_PAGINA - lado) / 2,
        size: TAMANO_MARCA_AGUA,
        font: this.negrita,
        color: COLOR_MARCA_AGUA,
        opacity: OPACIDAD_MARCA_AGUA,
        rotate: degrees(ANGULO_MARCA_AGUA),
      });
    }
  }

  pies() {
    const paginas = this.pdf.getPages();
    paginas.forEach((p, i) => {
      const texto = textoImprimible(`${this.doc.pie ? `${this.doc.pie} · ` : ""}Página ${i + 1} de ${paginas.length}`);
      p.drawText(texto, { x: MARGEN, y: MARGEN - 20, size: 8, font: this.fuente, color: COLOR_SECUNDARIO });
    });
  }
}

/**
 * Genera el PDF del documento. Si algo falla, lanza un error con solo el nombre del documento y el tipo de falla
 * (nunca los datos que contenía), para que `ruta()` lo registre en log_error sin datos personales.
 */
export async function generarPdf(doc: DocumentoPdf): Promise<Uint8Array> {
  try {
    const pdf = await PDFDocument.create();
    pdf.setTitle(textoImprimible(doc.titulo));
    pdf.setProducer("Kubo");
    pdf.setCreator("Kubo");
    const fecha = doc.fechaDocumento ?? new Date();
    pdf.setCreationDate(fecha);
    pdf.setModificationDate(fecha);
    const lienzo = new Lienzo(
      pdf,
      await pdf.embedFont(StandardFonts.Helvetica),
      await pdf.embedFont(StandardFonts.HelveticaBold),
      doc,
    );
    lienzo.titulo();
    for (const b of doc.bloques) {
      if (b.tipo === "datos") lienzo.datos(b);
      else if (b.tipo === "tabla") lienzo.tabla(b);
      else lienzo.texto(b);
    }
    lienzo.pies();
    if (doc.marcaAgua) lienzo.marcaAgua(doc.marcaAgua);
    return await pdf.save();
  } catch (e) {
    throw new Error(`No se pudo generar el PDF «${doc.nombre}» (${(e as Error)?.name ?? "Error"})`);
  }
}
