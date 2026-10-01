// identidad/domain: errores del módulo. Los textos siguen las pantallas AC-02, AC-03, AC-06 y AC-07.
import { ErrorApp } from "@/platform/http/errores";

export const erroresIdentidad = {
  credencialesInvalidas: () =>
    new ErrorApp("CREDENCIALES_INVALIDAS", "Correo o contraseña incorrectos. Verifica tus datos e inténtalo nuevamente.", 401),
  cuentaBloqueada: (minutos: number, hasta: Date) =>
    new ErrorApp(
      "CUENTA_BLOQUEADA",
      `Cuenta bloqueada temporalmente por seguridad. Intente nuevamente en ${minutos} minuto${minutos === 1 ? "" : "s"}.`,
      423,
      { minutosRestantes: minutos, bloqueadoHasta: hasta.toISOString() },
    ),
  cuentaSuspendida: () =>
    new ErrorApp("CUENTA_SUSPENDIDA", "Tu acceso está suspendido. Comunícate con la administración del colegio.", 403),
  sinPerfil: () =>
    new ErrorApp("SIN_PERFIL", "Tu cuenta no tiene un perfil activo. Comunícate con la administración del colegio.", 403),
  perfilNoDisponible: () => new ErrorApp("PERFIL_NO_DISPONIBLE", "No tienes ese perfil en tu cuenta.", 403),
  seleccionExpirada: () =>
    new ErrorApp("SELECCION_EXPIRADA", "Pasó demasiado tiempo. Vuelve a iniciar sesión.", 401),
  sesionInvalida: () => new ErrorApp("SESION_INVALIDA", "Tu sesión ya no es válida. Vuelve a iniciar sesión.", 401),
  cambioPasswordRequerido: () =>
    new ErrorApp("CAMBIO_PASSWORD_REQUERIDO", "Debes cambiar tu contraseña antes de continuar.", 403),
  passwordActualIncorrecta: () =>
    new ErrorApp("PASSWORD_ACTUAL_INCORRECTA", "La contraseña actual no es correcta.", 400),
  passwordDebil: (fallas: string[]) =>
    new ErrorApp("PASSWORD_DEBIL", "La nueva contraseña no cumple los requisitos.", 400, { requisitos: fallas }),
  passwordRepetida: () =>
    new ErrorApp("PASSWORD_REPETIDA", "La nueva contraseña debe ser distinta de la actual.", 400),
  enlaceExpirado: () =>
    new ErrorApp("ENLACE_EXPIRADO", "El enlace ha expirado. Solicita uno nuevo.", 410),
  noPuedeSuspenderse: () =>
    new ErrorApp("OPERACION_NO_PERMITIDA", "No puedes suspender tu propia cuenta.", 422),
  yaSuspendido: () => new ErrorApp("USUARIO_YA_SUSPENDIDO", "El usuario ya tiene el acceso suspendido.", 409),
  noSuspendido: () => new ErrorApp("USUARIO_NO_SUSPENDIDO", "El usuario no está suspendido.", 409),
  emailEnUso: () => new ErrorApp("EMAIL_EN_USO", "Ese correo ya está registrado en otra cuenta.", 409),
};
