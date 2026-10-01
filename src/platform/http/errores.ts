// platform/http: error de negocio con código estable para el frontend.
// El mensaje se muestra tal cual al usuario (RNF09: español claro, no técnico).

export class ErrorApp extends Error {
  constructor(
    public readonly codigo: string,
    mensaje: string,
    public readonly estadoHttp: number = 400,
    public readonly detalles?: Record<string, unknown>,
  ) {
    super(mensaje);
    this.name = "ErrorApp";
  }
}

export const errores = {
  noAutenticado: () =>
    new ErrorApp("NO_AUTENTICADO", "Tu sesión expiró. Vuelve a iniciar sesión.", 401),
  accesoDenegado: () =>
    new ErrorApp("ACCESO_DENEGADO", "No tiene permisos para acceder a este recurso.", 403),
  noEncontrado: (que: string) => new ErrorApp("NO_ENCONTRADO", `${que} no existe.`, 404),
  datosInvalidos: (detalles: Record<string, unknown>) =>
    new ErrorApp("DATOS_INVALIDOS", "Revisa los datos ingresados.", 400, detalles),
};
