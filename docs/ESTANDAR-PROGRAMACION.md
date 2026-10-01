# Kubo · Estándar de programación

> Versión 1.0 · 2 de octubre de 2026 · Equipo Code&Coffee · Ingeniería de Software – PUCP  
> Este archivo es la versión del estándar dentro del repositorio. Los cambios se proponen por pull request (sección 1.4).

## Resumen: las diez reglas esenciales

1. Todo cambio entra a `main` por pull request, con una aprobación de otro integrante y el CI en verde.
2. `npm run check` pasa en local antes de abrir el pull request.
3. El dominio se escribe en español, sin tildes en los identificadores, con los nombres de la tabla 2.2.
4. Un módulo se importa desde fuera solo por su `index.ts`.
5. Un `route.ts` solo autentica (`requerirSesion`), valida (Zod) y delega en el caso de uso.
6. Los errores se lanzan con `ErrorApp`: código estable y mensaje claro en español.
7. Varias escrituras van en una transacción y las operaciones críticas registran auditoría.
8. La base de datos solo cambia por migraciones, y nunca se edita una ya aplicada.
9. En el repositorio no hay secretos, datos reales ni `console.log`.
10. Toda regla de negocio tiene pruebas.

## 1. Propósito, alcance y aplicación

### 1.1 Propósito

Este estándar define cómo escribe, organiza, prueba y publica código el equipo Code&Coffee en Kubo. Su objetivo es que el código de los cinco integrantes se lea como si lo hubiera escrito una sola persona, que la arquitectura de monolito modular se respete al crecer el sistema y que cada cambio llegue a producción revisado y probado.

Las reglas no son genéricas: salen del código que ya está en el repositorio (módulos `identidad` y `comunidad`). Los ejemplos de este documento son fragmentos de Kubo, a veces resumidos (con «…») o partidos en varias líneas para que entren en la página.

### 1.2 Alcance

| Tecnología | Versión | Secciones |
|---|---|---|
| TypeScript (modo strict) | 5 | 2, 4 |
| Next.js – App Router y Route Handlers | 16.3 | 3, 5, 6 |
| React | 19.2 | 6 |
| Tailwind CSS | 4 | 6 |
| Prisma ORM + PostgreSQL | 7.10 / 16 | 7 |
| Zod (validación) | 4 | 5 |
| Vitest (pruebas) | 5 | 9 |
| Git + GitHub | — | 10 |

### 1.3 Cómo se hace cumplir

Cada regla que una herramienta puede verificar está automatizada; el resto se revisa con el checklist de la sección 12. Un cambio no llega a `main` si alguna verificación falla.

| Mecanismo | Qué verifica | Cuándo |
|---|---|---|
| **Prettier + EditorConfig** | Formato (sangría, comillas, largo de línea, fin de línea) | Al guardar en VS Code y en cada commit |
| **ESLint** | Reglas de código y de arquitectura (sección 11.3) | En cada commit y en el CI |
| **TypeScript strict** | Tipos (`tsc --noEmit`) | En el CI y con `npm run check` |
| **Vitest** | Reglas de negocio | En el CI y con `npm run check` |
| **Hook commit-msg** | Formato del mensaje de commit (sección 10.2) | En cada commit |
| **GitHub Actions (CI)** | Formato, lint, tipos, pruebas y build | En cada pull request y push a main |
| **Plantilla de PR + revisión** | Lo que no se automatiza (checklist sección 12) | En cada pull request |
| **Protección de la rama main** | Sin PR aprobado y CI en verde no se puede unir | Siempre |

### 1.4 Lenguaje de las reglas

- **DEBE / NO DEBE:** obligatorio. Incumplirlo bloquea el pull request.
- **SE RECOMIENDA:** buena práctica. El revisor puede pedirla, pero no bloquea.
- **Excepciones:** se permiten solo con un comentario que explique el motivo, en la misma línea o la anterior. Si es una regla de ESLint, con `// eslint-disable-next-line <regla>` y el motivo. Ejemplo real en `platform/http/ruta.ts`, donde Next.js entrega `params` sin tipo.
- **Cambios al estándar:** se proponen por pull request sobre `docs/ESTANDAR-PROGRAMACION.md`, los aprueba el equipo y se registran en el control de versiones.

## 2. Idioma y nomenclatura

### 2.1 Idioma

- El dominio se escribe en **español**: variables, funciones, tipos, tablas, comentarios, mensajes de commit y documentación (`suspenderUsuario`, `Matricula`, `anio_academico`).
- Se usa **inglés** solo en lo que impone la tecnología o es un término técnico establecido: `route.ts`, `page.tsx`, `schema`, `token`, `requestId`, `props`.
- Los identificadores **NO DEBEN** llevar tildes ni ñ: se escribe `anio`, `tamano`, `PESTANAS`, `anioAcademicoId`. Los textos que ve el usuario sí van con ortografía completa.
- Los mensajes al usuario se escriben en español claro y no técnico (RNF09): «Tu sesión expiró. Vuelve a iniciar sesión.», nunca «401 Unauthorized».

### 2.2 Convenciones de nombres

| Elemento | Convención | Ejemplo real de Kubo |
|---|---|---|
| **Variables y funciones** | camelCase; funciones con verbo | `suspenderUsuario`, `normalizarEmail`, `usuarioId` |
| **Booleanos** | camelCase con es/puede/debe/tiene | `esRol`, `puedeIniciarSesion`, `debeCambiarPassword` |
| **Constantes de módulo** | MAYUSCULAS_CON_GUION | `LARGO_MINIMO_PASSWORD`, `ROLES`, `TAMANO` |
| **Tipos e interfaces** | PascalCase, sin prefijo I | `UsuarioListado`, `MetaSolicitud`, `Rol` |
| **Componentes React** | PascalCase | `CampoPassword`, `ModalSuspender`, `PortalAdmin` |
| **Hooks de React** | use + PascalCase | `useSesion` |
| **Esquemas Zod** | PascalCase + Schema | `SuspensionSchema`, `LoginSchema` |
| **Códigos de error** | MAYUSCULAS_CON_GUION | `CUENTA_BLOQUEADA`, `EMAIL_EN_USO` |
| **Valores de enumeración** | MAYUSCULAS_CON_GUION | `PENDIENTE_ACTIVACION`, `DADO_DE_BAJA` |
| **Acciones de auditoría** | VERBO_ENTIDAD | `SUSPENDER_USUARIO` |
| **Modelos Prisma** | PascalCase, singular | `AnioAcademico`, `PeriodoEvaluacion` |
| **Campos Prisma** | camelCase + @map a snake_case | `fechaInicio @map("fecha_inicio")` |
| **Tablas y columnas SQL** | snake_case, singular | `anio_academico`, `fecha_inicio` |
| **Objetos SQL** | uq_ / ck_ / fn_ / tg_ + tabla + regla | `uq_matricula_activa_por_anio`, `ck_aula_aforo`, `tg_seccion_aforo_aula` |
| **Endpoints** | /api/v1/<modulo>/<recurso-plural>/{id}/<accion> | `/api/v1/identidad/usuarios/{id}/suspender` |
| **Rutas de páginas y carpetas** | minúsculas con guion (kebab-case) | `/cambiar-password`, `aula-virtual` |
| **Archivos .ts** | camelCase | `perfilesProvider.ts`, `repositorio.ts` |
| **Archivos de componentes** | PascalCase.tsx si es uno; si agrupa varios, el área en minúscula o index.tsx | `PortalAdmin.tsx`, `admin/usuarios.tsx`, `ui/index.tsx` |
| **Pruebas** | <archivo>.test.ts en tests/<modulo>/ | `tests/identidad/reglas.test.ts` |
| **Variables de entorno** | MAYUSCULAS_CON_GUION | `DATABASE_URL`, `JWT_SECRET`, `SMTP_HOST` |
| **Ramas de Git** | tipo/descripcion-corta | `feature/frontend-acceso`, `chore/despliegue-vercel` |

### 2.3 Nombres descriptivos

- Un nombre DEBE decir qué es o qué hace sin leer el código: `minutosRestantes`, no `m` ni `tmp`.
- NO DEBEN usarse abreviaturas inventadas. Se aceptan las conocidas: `id`, `dni`, `url`, `tx` (transacción), `req`, `e` (error en un catch).
- Las colecciones van en plural (`perfiles`, `sesiones`) y los elementos en singular (`perfil`).
- Las funciones que devuelven un valor sin efectos se nombran por lo que devuelven (`expiracionSesion`); las que cambian algo, por la acción (`revocarTodas`).

## 3. Estructura del proyecto

Kubo es un **monolito modular**: una sola aplicación Next.js que contiene el frontend y la API, con la lógica de negocio separada en módulos independientes. La estructura de carpetas DEBE respetarse.

### 3.1 Carpetas del repositorio

```text
kubo/
├─ prisma/
│  ├─ schema/            Modelo dividido por módulo (identidad.prisma…)
│  ├─ migrations/        Migraciones (no se editan una vez aplicadas)
│  └─ seed.sql           Datos iniciales idempotentes
├─ src/
│  ├─ app/
│  │  ├─ api/v1/<modulo>/…/route.ts   Endpoints (delgados)
│  │  └─ <pantalla>/page.tsx         Pantallas
│  ├─ components/        ui/ (piezas base) y <area>/ (por portal)
│  ├─ lib/               Cliente de la API y utilidades del navegador
│  ├─ modules/<modulo>/  Lógica de negocio
│  ├─ platform/          Servicios comunes: db, http, auth, logger, correo, auditoría
│  └─ server/wiring.ts   Conecta los puertos entre módulos
├─ tests/<modulo>/       Pruebas con Vitest
└─ docs/                 API, despliegue, estándar y capturas del Figma
```

### 3.2 Capas de un módulo

```text
src/modules/identidad/
├─ domain/          reglas.ts, errores.ts       Puro: sin Prisma ni Next.js
├─ application/     sesion.ts, password.ts…     Casos de uso
├─ infrastructure/  repositorio.ts              Único lugar con consultas Prisma
├─ schemas.ts       Validación de entradas (Zod)
├─ puertos.ts       Lo que el módulo necesita de módulos superiores
└─ index.ts         Interfaz pública: lo único que se importa desde fuera
```

| Capa | Contiene | Puede importar | NO puede importar |
|---|---|---|---|
| **domain/** | Reglas puras, constantes, tipos y errores del módulo | Otros archivos de domain/ y `@/platform/http/errores` | Prisma, Next.js, `@/platform/db`, fetch, correo |
| **application/** | Casos de uso: orquestan reglas, transacciones, auditoría y correo | domain/, infrastructure/ del mismo módulo, `@/platform/*`, el index.ts de otros módulos | Archivos internos de otros módulos; `next/server` |
| **infrastructure/** | Repositorios (consultas Prisma) e implementaciones de puertos | domain/, `@/platform/db`, `@/generated/prisma/*`, el index.ts de otros módulos | application/; archivos internos de otros módulos |
| **schemas.ts** | Esquemas Zod de las entradas de la API | zod, domain/ y el index.ts de otros módulos | Prisma, application/ |
| **index.ts** | Exportaciones públicas y la guardia `requerirSesion` | Su propio módulo, platform y tipos de `next/server` | — |

### 3.3 Reglas entre módulos

1. Desde fuera, un módulo se importa SOLO por su `index.ts`: `import { suspenderUsuario } from "@/modules/identidad"`. NO DEBE importarse `@/modules/identidad/application/cuentas`. Dentro del módulo se usan rutas relativas (`../domain/reglas`).
2. Las dependencias van en un solo sentido. Si un módulo de abajo (identidad) necesita algo de uno de arriba (comunidad), declara una interfaz en `puertos.ts`, el de arriba la implementa y `src/server/wiring.ts` las conecta.
3. Cada tabla tiene un único módulo dueño, que es el único que escribe en ella. Los demás piden los datos por el index.ts del dueño. Si por rendimiento un módulo necesita leer una tabla ajena en un listado, la excepción se documenta en el encabezado de su repositorio y se aprueba en el PR (caso actual: `comunidad` lee `usuario` para listar cuentas).
4. El cliente generado de Prisma (`@/generated/prisma/client`) solo se usa en `infrastructure/` y en `platform/db`. La capa application solo abre transacciones con `prisma.$transaction` y llama a los repositorios.
5. `platform/` no conoce a ningún módulo: ofrece servicios comunes (base de datos, HTTP, autenticación, logger, correo, auditoría).

### 3.4 Módulos previstos y dueño de cada esquema

| Módulo | Archivo de esquema | Responsabilidad | Estado |
|---|---|---|---|
| **identidad** | identidad.prisma | Cuentas, sesiones, contraseñas, bloqueo | Implementado |
| **comunidad** | comunidad.prisma | Personas, perfiles (administrador, docente, apoderado, alumno) | Implementado |
| **academico** | academico.prisma | Año, periodos, grados, secciones, aulas, currículo | Siguiente |
| **matricula** | matricula.prisma | Matrícula, pensiones y pagos | Pendiente |
| **horarios** | horarios.prisma | Bloques, horarios y asistencia | Pendiente |
| **evaluacion** | evaluacion.prisma | Notas por competencia, cierres, rectificaciones | Pendiente |
| **aula-virtual** | aula-virtual.prisma | Material de estudio y trabajos | Pendiente |

### 3.5 Cómo crear un módulo nuevo

1. Crear `src/modules/<modulo>/` con `domain/`, `application/`, `infrastructure/`, `schemas.ts` e `index.ts`.
2. Poner las reglas puras en `domain/reglas.ts` y los errores en `domain/errores.ts`, con sus pruebas en `tests/<modulo>/`.
3. Crear el repositorio en `infrastructure/repositorio.ts` con las consultas de las tablas que le pertenecen.
4. Escribir los casos de uso en `application/` y exportar lo público en `index.ts`.
5. Crear los endpoints en `src/app/api/v1/<modulo>/` siguiendo la sección 5.1.
6. Documentar los endpoints en `docs/api/<modulo>.md` y agregar ejemplos en `docs/api/<modulo>.http`.

## 4. TypeScript y estilo general

### 4.1 Tipos

- El modo `strict` de TypeScript DEBE estar activo y el código DEBE compilar sin errores (`npm run typecheck`).
- NO DEBE usarse `any`. Si el tipo es desconocido, se usa `unknown` y se valida (Zod o comprobaciones). Las excepciones siguen la sección 1.4.
- Los tipos se importan con `import type` (o `type` dentro de las llaves). ESLint lo corrige solo.
- Los tipos de las entradas se derivan de los esquemas Zod y los de los valores fijos, de constantes `as const`:

```ts
export const ROLES = ["ADMINISTRADOR", "DOCENTE", "APODERADO", "ALUMNO"] as const;
export type Rol = (typeof ROLES)[number];
```

### 4.2 Formato

El formato lo aplica **Prettier** automáticamente, así que no se discute en las revisiones. La configuración del proyecto es:

| Aspecto | Valor |
|---|---|
| **Sangría** | 2 espacios (sin tabulaciones) |
| **Largo máximo de línea** | 120 caracteres |
| **Comillas** | Dobles |
| **Punto y coma** | Siempre |
| **Coma final en listas de varias líneas** | Siempre |
| **Fin de línea** | LF (también en Windows, gracias a .gitattributes) |
| **Codificación** | UTF-8, con salto de línea al final del archivo |

### 4.3 Buenas prácticas de código

- Se usa `const` por defecto, `let` solo si el valor cambia y nunca `var`.
- Las comparaciones DEBEN usar `===` y `!==`. La única excepción es `== null`, para comparar a la vez con null y undefined.
- En el código asíncrono se usa `async/await` con `try/catch`, no cadenas de `.then()`. Toda promesa se espera con `await` o se maneja explícitamente.
- Si una función recibe más de tres parámetros, se pasa un objeto con nombre (`datos: { motivo, detalle, notificar }`).
- NO DEBE haber números mágicos: se usa una constante con nombre y, si hace falta, un comentario del porqué (`LARGO_MAXIMO_PASSWORD = 72 // límite de bcrypt`).
- Los valores que el colegio puede cambiar (montos, intentos de login, minutos de bloqueo) se leen de `ParametroInstitucion` y NO DEBEN estar fijos en el código.
- Las funciones se mantienen cortas y con una sola responsabilidad. SE RECOMIENDA que no pasen de 50 líneas.
- NO DEBE subirse código comentado ni `console.log` de depuración.

### 4.4 Orden de imports

Los imports van en este orden: módulos de Node y paquetes externos, luego los alias `@/` y al final las rutas relativas, sin líneas en blanco entre grupos. Los imports de efecto (`import "@/server/wiring"`) van siempre primero. ESLint (`import/order`) los ordena solo:

```ts
import { randomInt } from "node:crypto";
import { prisma } from "@/platform/db/prisma";
import { registrarAuditoria } from "@/platform/auditoria";
import { erroresIdentidad as E } from "../domain/errores";
```

### 4.5 Comentarios

- Cada archivo DEBE empezar con un comentario de una o dos líneas que diga qué contiene y a qué requisito o pantalla responde (`// AD-06 · Usuarios (RF05, RF46)`).
- Las funciones exportadas cuyo uso no es obvio llevan JSDoc (`/** … */`) con su propósito y, si aplica, un ejemplo.
- Un comentario explica el **porqué**, no repite el qué: `// cierra de inmediato todas sus sesiones (RF05)`.
- Las referencias a requisitos usan los códigos del documento de requisitos v4.2 (RF, RNF) y a pantallas, los del Figma (AC-01, AD-06, M-04).

## 5. Backend y API

### 5.1 Route Handlers

Un `route.ts` DEBE ser delgado: autentica, valida y delega en el caso de uso. NO DEBE contener lógica de negocio ni consultas a la base de datos. Ejemplo real:

```ts
// POST /api/v1/identidad/usuarios/{id}/suspender
// Suspender acceso (RF05, M-04) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { esquemasIdentidad, requerirSesion, suspenderUsuario } from "@/modules/identidad";

export const POST = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const usuarioId = esquemasIdentidad.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasIdentidad.SuspensionSchema);
  return ok(await suspenderUsuario(admin, usuarioId, datos, meta));
});
```

1. Comentario de cabecera con método, ruta, nombre, requisitos, pantalla y rol.
2. `import "@/server/wiring"` como primera línea.
3. El manejador envuelto en `ruta()`, que asigna el requestId, da formato a los errores y registra el log.
4. `requerirSesion` con los roles permitidos en toda ruta que no sea pública.
5. Validación de `params`, query y cuerpo con los esquemas del módulo.
6. Respuesta con `ok(datos)` u `ok(datos, 201)`.

### 5.2 Diseño de endpoints

| Regla | Ejemplo |
|---|---|
| Prefijo versionado: /api/v1 | `/api/v1/comunidad/usuarios` |
| Recursos en plural y en español | `/usuarios`, `/secciones`, `/matriculas` |
| GET lee, POST crea, PUT reemplaza, PATCH modifica en parte, DELETE elimina | `GET /comunidad/usuarios` |
| Acciones de negocio como subrecurso con POST | `POST /identidad/usuarios/{id}/reactivar` |
| Filtros y paginación por query en español | `?pagina=1&tamano=10&rol=DOCENTE&q=rosa` |
| Listas paginadas con items y paginacion | `{ items: […], paginacion: { pagina, tamano, total, paginas } }` |

### 5.3 Formato de respuesta

Todas las respuestas son JSON con una de estas dos formas, y el frontend depende de ellas:

```jsonc
// Éxito
{ "data": { "usuarioId": "3f1c…", "estado": "SUSPENDIDO" } }

// Error
{ "error": { "code": "USUARIO_YA_SUSPENDIDO",
             "message": "El usuario ya tiene el acceso suspendido.",
             "details": {} } }
```

### 5.4 Errores

- Los errores de negocio se lanzan con `ErrorApp(codigo, mensaje, estadoHttp, detalles?)`, definidos en el catálogo del módulo (`domain/errores.ts`).
- El `code` es estable: el frontend decide según él, así que NO DEBE cambiar una vez publicado. El `message` se muestra tal cual al usuario.
- Los errores no controlados los captura `ruta()`: responde 500 con el requestId, guarda el detalle en `log_error` y NUNCA envía al cliente el stack ni el SQL.

```ts
export const erroresIdentidad = {
  noSuspendido: () =>
    new ErrorApp("USUARIO_NO_SUSPENDIDO", "El usuario no está suspendido.", 409),
  emailEnUso: () =>
    new ErrorApp("EMAIL_EN_USO", "Ese correo ya está registrado en otra cuenta.", 409),
};
```

| Estado HTTP | Cuándo se usa | Código de ejemplo |
|---|---|---|
| **400** | Datos inválidos o formato incorrecto | `DATOS_INVALIDOS`, `PASSWORD_DEBIL` |
| **401** | Sin sesión o sesión vencida | `NO_AUTENTICADO`, `CREDENCIALES_INVALIDAS` |
| **403** | Con sesión pero sin permiso | `ACCESO_DENEGADO`, `CUENTA_SUSPENDIDA` |
| **404** | El recurso no existe | `NO_ENCONTRADO` |
| **409** | Conflicto con el estado actual | `EMAIL_EN_USO`, `USUARIO_YA_SUSPENDIDO` |
| **410** | Recurso que ya expiró | `ENLACE_EXPIRADO` |
| **422** | Regla de negocio incumplida | `AFORO_EXCEDE_AULA`, `OPERACION_NO_PERMITIDA` |
| **423** | Recurso bloqueado temporalmente | `CUENTA_BLOQUEADA` |
| **500** | Error no controlado | `ERROR_INTERNO` |

### 5.5 Validación de entradas

- Toda entrada externa (cuerpo, params y query) DEBE validarse con Zod en `schemas.ts` antes de llegar al caso de uso (RNF16). El frontend también valida, pero el backend nunca confía en él.
- Los mensajes de validación van en español y los esquemas limitan el largo de los textos (`.max(200, "Motivo demasiado largo")`).

### 5.6 Transacciones, auditoría y correo

- Una operación que escribe en más de una tabla DEBE ir dentro de `prisma.$transaction`.
- Antes de cambiar un estado se bloquea la fila (`bloquearFila`) para evitar condiciones de carrera.
- Los eventos críticos (RF03) se registran con `registrarAuditoria` dentro de la **misma** transacción, con el valor anterior, el nuevo y el motivo.
- Los correos se envían **después** de confirmar la transacción y su falla nunca revierte la operación.

```ts
const u = await prisma.$transaction(async (tx) => {
  await usuarios.bloquearFila(tx, usuarioId);
  const actual = await usuarios.porId(usuarioId, tx);
  if (actual.estado === "SUSPENDIDO") throw E.yaSuspendido();
  await usuarios.actualizar(usuarioId, { estado: "SUSPENDIDO", … }, tx);
  await sesiones.revocarTodas(usuarioId, null, tx);
  await registrarAuditoria(tx, { accion: "SUSPENDER_USUARIO", … }, meta);
  return actual;
});
if (datos.notificar) await enviarCorreo({ para: u.email, … });
```

### 5.7 Logs

- Se registra con `logger.info / warn / error(mensaje, datos)` y siempre se incluye el `requestId`. NO DEBE usarse `console.log`; las únicas excepciones son el propio logger y el correo en modo desarrollo.
- NUNCA se registran contraseñas, tokens, DNI ni datos personales. El logger oculta los campos con esos nombres, pero no se debe depender de eso.
- Los rechazos esperados (4xx) van como INFO y los errores no controlados, como ERROR.

### 5.8 Documentación de la API

Cada endpoint nuevo DEBE agregarse a `docs/api/<modulo>.md` (método, ruta, quién puede usarlo, cuerpo, respuesta y errores) y a `docs/api/<modulo>.http` para probarlo con REST Client.

## 6. Frontend

### 6.1 Pantallas y componentes

- Cada pantalla vive en `src/app/<ruta>/page.tsx` y empieza con el código del Figma que implementa (`// AC-06 · Restablecer contraseña`).
- `"use client"` se usa solo cuando la pantalla tiene estado, efectos o eventos.
- Antes de crear un componente se DEBE revisar `components/ui` (Boton, Campo, CampoPassword, Casilla, Alerta, Badge, Modal, Tarjeta, Spinner, Icono). Las piezas de un portal van en `components/<area>/`.
- Las props se tipan con una interfaz o un tipo en línea y tienen valores por defecto en la desestructuración (`variante = "primario"`).

### 6.2 Estilos

- Los estilos se escriben con clases de Tailwind usando los **tokens del tema** de `globals.css` (`bg-kubo-azul`, `text-texto-2`, `border-borde`, `shadow-tarjeta`).
- NO DEBEN usarse colores hexadecimales sueltos en `className` ni estilos en línea, salvo valores calculados en tiempo de ejecución.
- Los textos, colores y medidas siguen el Figma. Cualquier diferencia se documenta en `docs/` con su motivo.

```tsx
// Sí: tokens del tema
<button className="bg-kubo-azul text-white hover:bg-kubo-azul-oscuro">Guardar</button>
// No: color suelto
<button className="bg-[#1b4d89] text-white">Guardar</button>
```

### 6.3 Llamadas a la API

- Todas las llamadas pasan por `api<T>()` de `src/lib/api.ts`, que renueva la sesión sola y convierte los errores en `ApiError`. NO DEBE usarse `fetch` directo en los componentes.
- Las decisiones se toman con el `codigo` del error, nunca comparando el texto del mensaje.
- NUNCA se guardan tokens en `localStorage` ni en `sessionStorage`: la sesión viaja en cookies httpOnly.

```ts
try {
  const cuerpo = { token, nueva, confirmacion };
  await api("/identidad/password/restablecer", { method: "POST", body: cuerpo });
  setEstado({ fase: "listo" });
} catch (err) {
  if (err instanceof ApiError && err.codigo === "ENLACE_EXPIRADO") {
    setEstado({ fase: "expirado" });
  } else {
    setError((err as Error).message);
  }
}
```

### 6.4 Estados de una pantalla

Toda pantalla que carga datos DEBE resolver los cuatro estados:

| Estado | Qué se muestra |
|---|---|
| **Cargando** | `Spinner` o esqueleto; los botones de envío usan `cargando` para evitar el doble clic |
| **Error** | `Alerta` con el mensaje del backend y, si aplica, una forma de reintentar |
| **Vacío** | Un mensaje que explica que no hay datos y qué hacer |
| **Con datos** | El contenido, fiel al Figma |

### 6.5 Hooks y estado

- Se deriva el estado en lugar de duplicarlo, y NO se llama a `setState` dentro de `useEffect` si el valor se puede calcular (regla `react-hooks` de React 19).
- Para reiniciar un componente cuando cambia un dato se usa la prop `key`, no efectos que limpien el estado.
- Las listas usan `key` estables (el id), nunca el índice.

### 6.6 Seguridad y accesibilidad en la interfaz

- El frontend oculta lo que el rol no puede ver, pero la protección real está en el backend (RNF01).
- Todo campo tiene su etiqueta visible (`Campo` la incluye), las imágenes decorativas llevan `alt=""` y los botones con solo un ícono, `aria-label`.
- Las fechas se guardan en UTC y se muestran en la hora de Lima con las funciones de `src/lib/formato.ts`.

## 7. Base de datos

### 7.1 Modelo

- El esquema de Prisma se divide por módulo en `prisma/schema/<modulo>.prisma` y sigue los nombres de la sección 2.2.
- Toda tabla DEBE tener `id` UUID (`gen_random_uuid()`) y `created_at`; las que se modifican, también `updated_at`, ambos `timestamptz(3)`. Las bitácoras inmutables (`registro_auditoria`, `log_error`) solo tienen `created_at`.
- Los montos de dinero usan `Decimal(10, 2)`, nunca `Float`. Las fechas sin hora usan `@db.Date` y los instantes, `timestamptz` en UTC.
- El diagrama de clases y el `.prisma` se actualizan en el mismo pull request: el modelo y el diagrama no pueden diferir.

### 7.2 Migraciones

1. Toda modificación de la base se hace con una migración: `npx prisma migrate dev --name <descripcion_en_snake_case>`.
2. NUNCA se edita una migración ya aplicada ni se cambia la base a mano, ni en local ni en Neon o AWS. Para corregir algo se crea otra migración.
3. Las restricciones que Prisma no expresa (índices únicos parciales, CHECK, triggers) van en SQL dentro de una migración creada con `--create-only`, con nombres `uq_`, `ck_`, `fn_` y `tg_`.
4. Los triggers devuelven mensajes que empiezan con un código (`AFORO_EXCEDE_AULA`) para que `ruta()` los convierta en un error 422 legible.
5. Si un pull request trae una migración, se aplica en Neon con `npm run db:deploy` **antes** de unirlo a `main`.

### 7.3 Datos iniciales y de prueba

- `prisma/seed.sql` DEBE ser idempotente (`ON CONFLICT DO NOTHING`): ejecutarlo dos veces no duplica nada.
- En cualquier ambiente se usan solo datos ficticios (RNF14). NO DEBEN cargarse datos reales de alumnos, apoderados ni docentes.
- NUNCA se ejecuta `npm run db:reset` ni `db:migrate` con la URL de Neon en `DATABASE_URL`.

## 8. Seguridad

| Tema | Regla |
|---|---|
| **Secretos** | Solo en `.env` (local) y en las variables de entorno de Vercel o AWS. `.env` NUNCA se sube; `.env.example` lleva valores de ejemplo y se actualiza con cada variable nueva. |
| **Contraseñas** | Se guardan con bcrypt (costo 10). Los tokens de refresco y de recuperación se guardan solo como hash SHA-256. |
| **Autorización** | Cada ruta protegida llama a `requerirSesion` con sus roles. Ocultar un botón en el frontend no es control de acceso. |
| **Entradas** | Todo se valida con Zod. Las consultas usan Prisma (parametrizado); NO DEBE usarse `$queryRawUnsafe` con datos del usuario. |
| **Sesión** | Cookies httpOnly: los tokens nunca quedan accesibles a JavaScript. El token de acceso dura 15 minutos y la sesión, la del navegador o 7 días con «Recordarme». |
| **Mensajes** | No revelan información sensible: «Correo o contraseña incorrectos» sin decir cuál falló, y la recuperación responde igual exista o no el correo. |
| **Datos personales** | Solo datos de prueba. No se comparten capturas, logs ni prompts con contraseñas, tokens, URLs de base de datos o datos personales. |
| **Dependencias** | Antes de agregar un paquete se revisa su mantenimiento y se justifica en el PR. `npm audit` se revisa antes de cada entrega. |

## 9. Pruebas

- Las pruebas usan Vitest y viven en `tests/<modulo>/<archivo>.test.ts`. Se ejecutan con `npm test`.
- Toda regla de `domain/` DEBE tener pruebas con al menos un caso válido y uno inválido. Todo bug corregido agrega una prueba que lo reproduce.
- `describe` e `it` se escriben en español, describen el comportamiento e incluyen el requisito.
- Las pruebas de dominio no usan la base de datos y emplean fechas fijas para ser repetibles.
- Cada prueba sigue el patrón Preparar – Ejecutar – Verificar.

```ts
describe("bloqueo por intentos fallidos (RF01, AC-03)", () => {
  const ahora = new Date("2026-10-01T10:00:00Z");
  it("bloquea al llegar al máximo y reinicia el contador", () => {
    const r = registrarIntentoFallido(4, 5, 15, ahora);
    expect(r.intentosFallidos).toBe(0);
    expect(r.bloqueadoHasta?.toISOString()).toBe("2026-10-01T10:15:00.000Z");
  });
});
```

- Los endpoints se prueban a mano con `docs/api/<modulo>.http` y las pantallas, contra el Figma, antes de pedir revisión.

## 10. Git y flujo de trabajo

### 10.1 Ramas

- `main` siempre está lista para desplegarse: Vercel publica automáticamente cada cambio que llega a ella. NADIE hace push directo a `main`.
- Cada tarea se trabaja en una rama `tipo/descripcion-corta` creada desde `main` actualizada, que dura pocos días y se borra al unirse.

| Prefijo | Uso | Ejemplo |
|---|---|---|
| **feature/** | Funcionalidad nueva | `feature/academico-secciones` |
| **fix/** | Corrección de un error | `fix/zona-horaria` |
| **chore/** | Configuración, dependencias, despliegue | `chore/despliegue-vercel` |
| **docs/** | Solo documentación | `docs/estandar-programacion` |
| **refactor/** | Mejora interna sin cambiar el comportamiento | `refactor/repositorio-comunidad` |

### 10.2 Mensajes de commit

Se usa **Conventional Commits** en español: `tipo(alcance): descripción`. La descripción va en imperativo, en minúscula, sin punto final y con un máximo de 72 caracteres. El alcance es el módulo o área (`identidad`, `comunidad`, `ui`, `db`, `api`). El hook `commit-msg` rechaza los mensajes que no cumplen.

| Tipo | Cuándo | Ejemplo |
|---|---|---|
| **feat** | Funcionalidad nueva | `feat(identidad): login con bloqueo por intentos` |
| **fix** | Corrección | `fix(db): usar UTC en la conexión y en la base` |
| **docs** | Documentación | `docs: guía de despliegue en Vercel + Neon` |
| **style** | Formato sin cambio de lógica | `style: aplicar prettier a todo el proyecto` |
| **refactor** | Reestructura sin cambio de comportamiento | `refactor(comunidad): extraer repositorio de personas` |
| **test** | Pruebas | `test(identidad): casos de contraseña temporal` |
| **chore / build / ci** | Configuración, dependencias, CI | `chore: scripts postinstall, db:deploy y db:seed:remoto` |

- Cada commit es pequeño y hace una sola cosa. Un PR puede tener varios commits, cada uno con sentido propio.

### 10.3 Pull requests

1. Todo cambio llega a `main` por pull request, cuyo título sigue el formato de commit.
2. La descripción llena la plantilla: qué cambia, por qué, cómo probarlo, capturas si toca la interfaz y el checklist de la sección 12.
3. Necesita **una aprobación** de otro integrante y el CI en verde. El autor no aprueba su propio PR.
4. El revisor comenta con respeto y en concreto, citando la regla del estándar cuando aplica.
5. Se une con «Merge pull request» y se borra la rama.

### 10.4 Flujo diario

```bash
git switch main && git pull                   # partir de main actualizado
git switch -c feature/academico-secciones     # una rama por tarea
# … programar, con commits pequeños …
npm run check                                 # formato, lint, tipos, pruebas y build
git push -u origin feature/academico-secciones
# abrir el pull request en GitHub y pedir revisión
```

### 10.5 Entregas

SE RECOMIENDA marcar con una etiqueta el commit de cada entrega del curso (`git tag entrega-1 && git push --tags`) para poder volver exactamente a lo que se presentó.

## 11. Herramientas y automatización

### 11.1 Archivos de configuración

| Archivo | Para qué sirve |
|---|---|
| `.editorconfig` | Sangría, codificación y fin de línea en cualquier editor |
| `.prettierrc.json` / `.prettierignore` | Reglas de formato (sección 4.2) y archivos que se excluyen |
| `.gitattributes` | Fuerza LF en el repositorio para que Windows y Linux no generen diferencias |
| `eslint.config.mjs` | Reglas de Next.js más las reglas de Kubo (sección 11.3) |
| `.husky/pre-commit` | Formatea y revisa con ESLint los archivos del commit (lint-staged) |
| `.husky/commit-msg` | Valida el formato del mensaje (sección 10.2) |
| `.github/workflows/ci.yml` | Ejecuta `npm run check` en cada PR y en cada push a main |
| `.github/pull_request_template.md` | Plantilla con el checklist de la sección 12 |
| `.vscode/settings.json` / `extensions.json` | Formatear al guardar y extensiones recomendadas |
| `docs/ESTANDAR-PROGRAMACION.md` | Este estándar dentro del repositorio |
| `CLAUDE.md` | Indica a los asistentes de IA que sigan este estándar |

### 11.2 Comandos

| Comando | Qué hace |
|---|---|
| `npm run format` | Formatea todo el proyecto con Prettier |
| `npm run format:check` | Verifica el formato sin cambiar archivos |
| `npm run lint` | Ejecuta ESLint |
| `npm run typecheck` | Revisa los tipos con TypeScript |
| `npm test` | Ejecuta las pruebas |
| `npm run check` | Todo lo anterior y además el build. DEBE pasar antes de abrir un PR |

### 11.3 Reglas de ESLint propias de Kubo

| Regla | Qué evita | Dónde aplica |
|---|---|---|
| `@typescript-eslint/no-explicit-any` | Usar `any` | Todo el código |
| `@typescript-eslint/consistent-type-imports` | Importar tipos como valores | Todo el código |
| `eqeqeq` (permite `== null`) | Comparaciones con `==` | Todo el código |
| `no-console` | Logs fuera del logger | Todo, menos `platform/logger` y `platform/correo` |
| `no-restricted-imports`: `@/modules/*/*` | Saltarse el index.ts de un módulo | Todo, menos tests/ |
| `no-restricted-imports`: Prisma, Next.js y `@/platform/db` | Contaminar el dominio | `modules/*/domain/` |
| `no-restricted-imports`: `@/generated/prisma/*` | Consultas fuera del repositorio | Todo, menos `infrastructure/` y `platform/db` |
| `import/order` | Imports desordenados | Todo el código |
| `react-hooks/*` (de Next.js) | Errores en el uso de hooks | Componentes |

### 11.4 Editor

Al abrir el proyecto, VS Code recomienda las extensiones Prettier, ESLint, Prisma y Tailwind CSS IntelliSense, y formatea al guardar. Así, la mayoría de las reglas se cumplen sin esfuerzo.

### 11.5 Uso de asistentes de IA

- El código generado con asistentes (por ejemplo, Claude Code) sigue exactamente este estándar y pasa por el mismo PR, la misma revisión y el mismo CI. `CLAUDE.md` le indica al asistente que lea este documento.
- El autor del PR es responsable de todo el código que sube, lo haya escrito él o un asistente: debe entenderlo y poder explicarlo.
- NUNCA se pegan en un prompt secretos, URLs de base de datos, contraseñas ni datos personales.

## 12. Checklist de revisión de pull requests

El autor marca cada punto en la descripción del PR y el revisor lo verifica. Un punto sin marcar se justifica o bloquea la aprobación.

| # | Verificación | Sección |
|---|---|---|
| 1 | El título sigue el formato de commit y la rama, el formato tipo/descripcion | 10 |
| 2 | `npm run check` pasa en local y el CI está en verde | 11.2 |
| 3 | Los nombres siguen las convenciones, en español y sin abreviaturas inventadas | 2 |
| 4 | La lógica de negocio está en `modules/`, no en `route.ts` ni en componentes | 3, 5.1 |
| 5 | Ningún import se salta el index.ts de otro módulo | 3.3 |
| 6 | Toda entrada se valida con Zod y cada ruta protegida usa `requerirSesion` con sus roles | 5.5, 8 |
| 7 | Los errores usan `ErrorApp` con un código estable y un mensaje claro en español | 5.4 |
| 8 | Las escrituras múltiples usan transacción y las operaciones críticas registran auditoría | 5.6 |
| 9 | La interfaz usa `components/ui` y los tokens del tema, y resuelve carga, error y vacío | 6 |
| 10 | Hay pruebas para las reglas nuevas o para el bug corregido | 9 |
| 11 | Si cambia el modelo: migración nueva, diagrama actualizado y `db:deploy` en Neon antes de unir | 7 |
| 12 | No hay secretos, datos reales ni `console.log`; `.env.example` está actualizado | 8 |
| 13 | `docs/api` y el README reflejan el cambio | 5.8 |
