// Pruebas de platform/archivos (US38; almacenamiento común): tipo real por los primeros bytes (PDF, JPG, PNG y Office
// como ZIP), archivo falsificado, 0 bytes, exactamente 5 MB y 5 MB + 1, nombre saneado, clave interna, cabecera
// Content-Disposition, lectura del formulario con límite de tamaño y el almacén en disco. Sin base de datos.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cabeceraDisposicion,
  claveDeArchivo,
  detectarTipo,
  disposicionDe,
  esClaveValida,
  HOLGURA_FORMULARIO,
  leerFormulario,
  reiniciarAlmacen,
  respuestaArchivo,
  sanearNombre,
  TAMANO_MAXIMO_ARCHIVO,
  validarArchivo,
  verificarAlmacen,
  almacenArchivos,
  type TipoArchivo,
} from "@/platform/archivos";

const MENSAJE = "Formato no permitido o archivo demasiado pesado (máx. 5 MB, formatos PDF/JPG)";
const SOLO_PDF_JPG: TipoArchivo[] = ["PDF", "JPG"];
const UUID = "3f1c2a4b-5d6e-4f70-8a9b-0c1d2e3f4a5b";

const bytes = (...valores: number[]) => new Uint8Array(valores);
const texto = (t: string) => new TextEncoder().encode(t);

/** Un archivo de `tamano` bytes que empieza con la firma dada (el resto, ceros). */
function conFirma(firma: Uint8Array, tamano: number) {
  const b = new Uint8Array(tamano);
  b.set(firma.subarray(0, Math.min(firma.length, tamano)));
  return b;
}

const PDF = texto("%PDF-1.7\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n%%EOF");
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d);

/** ZIP mínimo sin compresión con las entradas dadas (cabeceras locales, directorio central y registro final). */
function zip(nombres: string[]) {
  const locales: number[] = [];
  const central: number[] = [];
  const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
  const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
  for (const nombre of nombres) {
    const n = [...texto(nombre)];
    const desplazamiento = locales.length;
    locales.push(...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(0));
    locales.push(...u32(0), ...u16(n.length), ...u16(0), ...n);
    central.push(...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0));
    central.push(...u32(0), ...u32(0), ...u16(n.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0));
    central.push(...u32(desplazamiento), ...n);
  }
  const fin = [...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(nombres.length), ...u16(nombres.length)];
  fin.push(...u32(central.length), ...u32(locales.length), ...u16(0));
  return new Uint8Array([...locales, ...central, ...fin]);
}

const DOCX = zip(["[Content_Types].xml", "_rels/.rels", "word/document.xml"]);
const PPTX = zip(["[Content_Types].xml", "_rels/.rels", "ppt/presentation.xml"]);
const XLSX = zip(["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml"]);

function codigoDe(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    return { codigo: (e as { codigo?: string }).codigo, estado: (e as { estadoHttp?: number }).estadoHttp };
  }
  throw new Error("Se esperaba un error");
}

describe("tipo real por los primeros bytes, no por la extensión (US38)", () => {
  it("reconoce PDF, JPG y PNG por su firma", () => {
    expect(detectarTipo(PDF)).toBe("PDF");
    expect(detectarTipo(JPG)).toBe("JPG");
    expect(detectarTipo(PNG)).toBe("PNG");
  });

  it("reconoce DOCX, PPTX y XLSX como ZIP con la estructura de Office", () => {
    expect(detectarTipo(DOCX)).toBe("DOCX");
    expect(detectarTipo(PPTX)).toBe("PPTX");
    expect(detectarTipo(XLSX)).toBe("XLSX");
  });

  it("un ZIP cualquiera, uno sin [Content_Types].xml o uno con macros no es un documento de Office", () => {
    expect(detectarTipo(zip(["foto.jpg", "notas.txt"]))).toBeNull();
    expect(detectarTipo(zip(["word/document.xml"]))).toBeNull();
    expect(detectarTipo(zip(["[Content_Types].xml", "word/document.xml", "word/vbaProject.bin"]))).toBeNull();
  });

  it("un archivo falsificado (HTML, ejecutable o texto con extensión .pdf) no es de ningún tipo admitido", () => {
    expect(detectarTipo(texto("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(detectarTipo(bytes(0x4d, 0x5a, 0x90, 0x00))).toBeNull(); // MZ: ejecutable de Windows
    expect(detectarTipo(texto("solo texto"))).toBeNull();
    // la firma ZIP sola, sin directorio central
    expect(detectarTipo(bytes(0x50, 0x4b, 0x03, 0x04, 0x00))).toBeNull();
  });
});

describe("validarArchivo: tamaño y formato (US38, criterio 2)", () => {
  const reglas = { permitidos: SOLO_PDF_JPG, mensaje: MENSAJE };

  it("acepta un PDF y un JPG y devuelve su tipo real, su MIME y el nombre saneado", () => {
    const pdf = validarArchivo({ nombre: "Informe.PDF", bytes: PDF }, reglas);
    expect(pdf).toMatchObject({ tipo: "PDF", mime: "application/pdf", nombre: "Informe.pdf", tamanoBytes: PDF.length });
    const jpg = validarArchivo({ nombre: "foto.jpeg", bytes: JPG }, reglas);
    expect(jpg).toMatchObject({ tipo: "JPG", mime: "image/jpeg", nombre: "foto.jpg" });
  });

  it("rechaza un archivo de 0 bytes", () => {
    expect(codigoDe(() => validarArchivo({ nombre: "vacio.pdf", bytes: new Uint8Array() }, reglas))).toEqual({
      codigo: "ARCHIVO_VACIO",
      estado: 400,
    });
  });

  it("acepta exactamente 5 MB y rechaza 5 MB + 1 byte con el mensaje del backlog", () => {
    const justo = conFirma(PDF, TAMANO_MAXIMO_ARCHIVO);
    expect(validarArchivo({ nombre: "a.pdf", bytes: justo }, reglas).tamanoBytes).toBe(5_242_880);
    try {
      validarArchivo({ nombre: "a.pdf", bytes: conFirma(PDF, TAMANO_MAXIMO_ARCHIVO + 1) }, reglas);
      throw new Error("Se esperaba un error");
    } catch (e) {
      expect(e).toMatchObject({ codigo: "ARCHIVO_DEMASIADO_GRANDE", estadoHttp: 413, message: MENSAJE });
    }
  });

  it("rechaza un tipo admitido por el almacén pero no por el caso de uso (PNG o DOCX en una evidencia)", () => {
    expect(codigoDe(() => validarArchivo({ nombre: "a.png", bytes: PNG }, reglas)).codigo).toBe("ARCHIVO_NO_PERMITIDO");
    expect(codigoDe(() => validarArchivo({ nombre: "a.docx", bytes: DOCX }, reglas)).codigo).toBe(
      "ARCHIVO_NO_PERMITIDO",
    );
  });

  it("rechaza un archivo falsificado aunque su nombre diga .pdf o .jpg", () => {
    for (const nombre of ["tarea.pdf", "foto.jpg"]) {
      try {
        validarArchivo({ nombre, bytes: texto("<html>no soy un PDF</html>") }, reglas);
        throw new Error("Se esperaba un error");
      } catch (e) {
        expect(e).toMatchObject({ codigo: "ARCHIVO_NO_PERMITIDO", estadoHttp: 400, message: MENSAJE });
      }
    }
  });

  it("un JPG renombrado como .pdf se guarda como JPG", () => {
    expect(validarArchivo({ nombre: "trabajo.pdf", bytes: JPG }, reglas)).toMatchObject({
      tipo: "JPG",
      nombre: "trabajo.pdf.jpg",
    });
  });
});

describe("nombre original saneado", () => {
  it("quita carpetas, caracteres de control y reservados, y pone la extensión del tipo real", () => {
    expect(sanearNombre("C:\\fakepath\\Evaluación final.PDF", "PDF")).toBe("Evaluación final.pdf");
    expect(sanearNombre("../../etc/passwd", "PDF")).toBe("passwd.pdf");
    expect(sanearNombre('ta<r>e:a"|?*\u0000\u001f.jpg', "JPG")).toBe("tarea.jpg");
    expect(sanearNombre("virus.exe", "PDF")).toBe("virus.exe.pdf");
  });

  it("un nombre vacío o de solo puntos queda como «archivo»", () => {
    expect(sanearNombre("", "PDF")).toBe("archivo.pdf");
    expect(sanearNombre("...", "JPG")).toBe("archivo.jpg");
    expect(sanearNombre(".pdf", "PDF")).toBe("archivo.pdf");
  });

  it("recorta un nombre demasiado largo sin perder la extensión", () => {
    const nombre = sanearNombre(`${"á".repeat(300)}.pdf`, "PDF");
    expect([...nombre].length).toBe(120);
    expect(nombre.endsWith(".pdf")).toBe(true);
  });
});

describe("clave interna <area>/<uuid>", () => {
  it("arma la clave con el área y un uuid", () => {
    expect(claveDeArchivo("evidencias", UUID)).toBe(`evidencias/${UUID}`);
    expect(esClaveValida(`evidencias/${UUID}`)).toBe(true);
  });

  it("no acepta rutas con «..», mayúsculas ni algo que no sea un uuid", () => {
    expect(() => claveDeArchivo("../evidencias", UUID)).toThrow();
    expect(() => claveDeArchivo("Evidencias", UUID)).toThrow();
    expect(esClaveValida(`evidencias/../${UUID}`)).toBe(false);
    expect(esClaveValida("evidencias/informe.pdf")).toBe(false);
  });
});

describe("Content-Disposition de la descarga", () => {
  it("inline para JPG y PDF, attachment para el resto", () => {
    expect(disposicionDe("JPG")).toBe("inline");
    expect(disposicionDe("PDF")).toBe("inline");
    expect(disposicionDe("PNG")).toBe("attachment");
    expect(disposicionDe("DOCX")).toBe("attachment");
    expect(disposicionDe(null)).toBe("attachment");
  });

  it("lleva el nombre en ASCII y completo en UTF-8", () => {
    expect(cabeceraDisposicion("PDF", "Evaluación (1).pdf")).toBe(
      "inline; filename=\"Evaluacion (1).pdf\"; filename*=UTF-8''Evaluaci%C3%B3n%20%281%29.pdf",
    );
  });

  it("la respuesta no se guarda en caché y el navegador no adivina el tipo", () => {
    const r = respuestaArchivo(new Blob([PDF]).stream(), { mime: "application/pdf", nombre: "a.pdf", tamanoBytes: 9 });
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("content-length")).toBe("9");
    const rara = respuestaArchivo(new Blob([PDF]).stream(), { mime: "text/html", nombre: "a.html", tamanoBytes: null });
    expect(rara.headers.get("content-type")).toBe("application/octet-stream");
    expect(rara.headers.get("content-disposition")?.startsWith("attachment")).toBe(true);
  });
});

describe("leerFormulario: límite de 5 MB antes de leer todo el cuerpo", () => {
  const limite = TAMANO_MAXIMO_ARCHIVO + HOLGURA_FORMULARIO;

  /** Un cuerpo que falla si alguien intenta leerlo. */
  function cuerpoQueNoSeLee() {
    return new ReadableStream<Uint8Array>({
      pull() {
        throw new Error("El cuerpo no debía leerse");
      },
    });
  }

  it("con un Content-Length mayor al límite, rechaza sin leer el cuerpo", async () => {
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=x", "content-length": String(limite + 1) },
      body: cuerpoQueNoSeLee(),
      duplex: "half",
    } as RequestInit);
    await expect(leerFormulario(req, { mensaje: MENSAJE })).rejects.toMatchObject({
      codigo: "ARCHIVO_DEMASIADO_GRANDE",
      message: MENSAJE,
    });
  });

  it("sin Content-Length, corta en cuanto el cuerpo se pasa del límite", async () => {
    const trozo = new Uint8Array(1024 * 1024);
    let enviados = 0;
    const flujo = new ReadableStream<Uint8Array>({
      pull(c) {
        enviados += 1;
        c.enqueue(trozo);
        if (enviados > 50) c.close();
      },
    });
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=x" },
      body: flujo,
      duplex: "half",
    } as RequestInit);
    await expect(leerFormulario(req, { mensaje: MENSAJE })).rejects.toMatchObject({
      codigo: "ARCHIVO_DEMASIADO_GRANDE",
    });
    expect(enviados).toBeLessThan(10);
  });

  it("rechaza un cuerpo que no es multipart/form-data", async () => {
    const req = new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ a: 1 }) });
    await expect(leerFormulario(req, { mensaje: MENSAJE })).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
  });

  it("lee un formulario válido con su archivo", async () => {
    const form = new FormData();
    form.set("comentario", "Buen trabajo");
    form.set("archivo", new File([PDF], "a.pdf", { type: "application/pdf" }));
    const req = new Request("http://localhost/x", { method: "POST", body: form });
    const leido = await leerFormulario(req, { mensaje: MENSAJE });
    expect(leido.get("comentario")).toBe("Buen trabajo");
    expect((leido.get("archivo") as File).size).toBe(PDF.length);
  });
});

describe("almacén en disco (ARCHIVOS_DRIVER=disco)", () => {
  let carpeta: string;
  const anterior = { driver: process.env.ARCHIVOS_DRIVER, dir: process.env.ARCHIVOS_DIR };

  beforeAll(async () => {
    carpeta = await fs.mkdtemp(path.join(os.tmpdir(), "kubo-archivos-"));
    process.env.ARCHIVOS_DRIVER = "disco";
    process.env.ARCHIVOS_DIR = carpeta;
    reiniciarAlmacen();
  });

  afterAll(async () => {
    process.env.ARCHIVOS_DRIVER = anterior.driver;
    process.env.ARCHIVOS_DIR = anterior.dir;
    reiniciarAlmacen();
    await fs.rm(carpeta, { recursive: true, force: true });
  });

  it("guarda, lee y borra; una clave que no existe se lee como null", async () => {
    const almacen = almacenArchivos();
    const clave = claveDeArchivo("evidencias", UUID);
    await almacen.guardar(clave, PDF, "application/pdf");
    const flujo = await almacen.leer(clave);
    expect(new Uint8Array(await new Response(flujo).arrayBuffer())).toEqual(PDF);
    await almacen.eliminar(clave);
    expect(await almacen.leer(clave)).toBeNull();
    // borrar dos veces no es un error
    await expect(almacen.eliminar(clave)).resolves.toBeUndefined();
  });

  it("no acepta una clave que saldría de la carpeta del almacén", async () => {
    await expect(almacenArchivos().guardar("../fuera", PDF, "application/pdf")).rejects.toThrow();
  });

  it("la verificación (npm run archivos:verificar) pasa sus cuatro pasos y no deja nada", async () => {
    const r = await verificarAlmacen();
    expect(r.ok).toBe(true);
    expect(r.pasos.map((p) => p.paso)).toEqual(["guardar", "leer", "eliminar", "confirmar borrado"]);
    const quedan = await fs.readdir(path.join(carpeta, "verificacion")).catch(() => []);
    expect(quedan).toEqual([]);
  });

  it("en producción sin ARCHIVOS_DRIVER no hay almacén: 503 ALMACEN_NO_CONFIGURADO", () => {
    const entorno = process.env as Record<string, string | undefined>;
    const nodeEnv = entorno.NODE_ENV;
    entorno.NODE_ENV = "production";
    delete process.env.ARCHIVOS_DRIVER;
    reiniciarAlmacen();
    try {
      expect(codigoDe(() => almacenArchivos())).toEqual({ codigo: "ALMACEN_NO_CONFIGURADO", estado: 503 });
    } finally {
      entorno.NODE_ENV = nodeEnv;
      process.env.ARCHIVOS_DRIVER = "disco";
      reiniciarAlmacen();
    }
  });
});
