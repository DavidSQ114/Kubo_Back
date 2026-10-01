# Frontend · Acceso y administración de usuarios (Fase 1)

Pantallas construidas a partir del Figma **Kubo – Prototipo** y conectadas a la API de identidad.
Las capturas de referencia del Figma están en `docs/figma/`.

## Pantallas y rutas

| Figma | Ruta | Qué hace |
|---|---|---|
| AC-01 · Iniciar sesión | `/login` | Login con correo y contraseña, «Recordarme», enlace a recuperar |
| AC-02 · Credenciales incorrectas | `/login` | Alerta roja al fallar el login |
| AC-03 · Cuenta bloqueada | `/login` | Alerta ámbar y botón con contador «Esperar mm:ss min» |
| AC-08 · Elección de perfil *(por diseñar)* | `/login` | Si la cuenta tiene más de un perfil, elige con cuál ingresar |
| AC-04 · Recuperar contraseña | `/recuperar` | Envía el enlace y muestra «Solicitud enviada» |
| AC-06 · Restablecer contraseña | `/restablecer?token=…` | Enlace válido (con minutos restantes) o expirado; requisitos en vivo |
| AC-09 · Cambiar contraseña *(por diseñar)* | `/cambiar-password` | Obligatorio en el primer ingreso; también voluntario desde el menú |
| AC-07 · Acceso denegado | `/acceso-denegado` | Página 403 con «Volver a mi inicio» |
| AD-01 · Inicio administrador | `/admin` | Bienvenida y acceso a Usuarios (los indicadores llegan con los otros módulos) |
| AD-06 · Usuarios | `/admin/usuarios` | KPIs, pestañas por rol, búsqueda, filtro de estado, tabla paginada |
| M-04 · Suspender acceso | modal en AD-06 | Motivo, detalle, notificar por correo |
| Reactivar acceso *(por diseñar)* | modal en AD-06 | Motivo opcional |
| Registrar administrador *(por diseñar)* | modal en AD-06 | Crea persona, perfil y cuenta; muestra la contraseña temporal una vez |
| — | `/inicio` | Inicio temporal para Docente, Apoderado y Alumno |

## Archivos

```
src/app/globals.css                  Tokens de color, sombras y fuente (Tailwind v4)
src/app/layout.tsx                   Fuente IBM Plex Sans, idioma es
src/app/page.tsx                     / → /login
src/app/login/page.tsx               AC-01, AC-02, AC-03, AC-08
src/app/recuperar/page.tsx           AC-04
src/app/restablecer/page.tsx         AC-06
src/app/cambiar-password/page.tsx    AC-09
src/app/acceso-denegado/page.tsx     AC-07
src/app/inicio/page.tsx              Inicio temporal de otros perfiles
src/app/(portal)/admin/layout.tsx    Portal del administrador (guardia + barra lateral + barra superior)
src/app/(portal)/admin/page.tsx      AD-01
src/app/(portal)/admin/usuarios/page.tsx   AD-06
src/components/ui/index.tsx          Icono, Logo, Alerta, Campo, CampoPassword, Casilla, Boton, Badge, Tarjeta, Modal, ChecklistPassword
src/components/acceso/index.tsx      Panel de marca del login y página centrada con tarjeta
src/components/admin/PortalAdmin.tsx Barra lateral (minimizable), barra superior, contexto de sesión
src/components/admin/usuarios.tsx    Badges, avatar y modales de AD-06
src/lib/api.ts                       Cliente de la API (renueva la sesión sola), tipos y rutas por rol
src/lib/formato.ts                   «Hoy, 07:41», «Ayer, 20:15», cuenta regresiva
public/figma/*.svg                   Íconos, logos y decoración exportados del Figma (65 archivos)
scripts/descargar-assets-figma.mjs   Descarga esos SVG desde el Figma
```

## Cómo protege las páginas

- Las páginas `/admin/*` piden `GET /api/v1/identidad/sesion` al cargar:
  - Sin sesión → `/login`.
  - Debe cambiar contraseña → `/cambiar-password`.
  - Otro perfil → `/acceso-denegado`.
- La seguridad real está en el backend: cada endpoint vuelve a validar el rol (RNF01). El frontend solo evita mostrar pantallas que no corresponden.
- Si el token de acceso vence (15 min), `src/lib/api.ts` renueva la sesión una vez y repite la solicitud sin que el usuario lo note.

## Diferencias con el Figma (y por qué)

| En el Figma | En el código | Motivo |
|---|---|---|
| Botones «PROTOTIPO · INGRESAR COMO» en AC-01 | No se incluyen | Son navegación del prototipo; en el sistema real saltarían el login |
| Botón «Exportar» en AD-06 | No se incluye | Decisión D7: las exportaciones CSV están fuera de alcance |
| Insignia «Año 2026 · Bimestre III en curso» | No se muestra | Depende del módulo académico; no se muestran datos inventados |
| Notas de los KPI («26 con carga asignada», «Último: 30/07/2026») | «Con perfil activo» | Esos datos dependen de módulos que aún no existen |
| «Registrar apoderado» y «Registrar docente» | Visibles pero deshabilitados; se agregó «Registrar administrador» | Los registros de docente y apoderado son de la fase del módulo comunidad |
| Acciones «Ver» y «Editar» de la tabla | Deshabilitadas | Pantallas de detalle y edición pendientes |
| Opciones del motivo de suspensión | Lista propuesta (el Figma solo muestra una) | Validar la lista con el equipo de Figma |
| Texto de la alerta «Suspensión de accesos» | Usa el mensaje real del backend | Que lo que ve el usuario coincida con lo que dice la alerta |
| Menú lateral: módulos no construidos | Se ven atenuados y no navegan | Se habilitan a medida que se construyan |
| AC-07 dentro del portal del usuario (barra lateral y superior) | Página centrada con el logo | Los portales de docente, apoderado y alumno aún no existen |

## Requisitos

- Next.js con **Tailwind CSS v4**, que es lo que instala `create-next-app`. Si el proyecto usara Tailwind v3, hay que mover los tokens de `@theme` a `tailwind.config`.
- La fuente IBM Plex Sans se descarga de Google Fonts la primera vez que se compila, así que necesita internet.
