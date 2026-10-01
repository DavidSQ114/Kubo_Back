# Kubo · Sistema de gestión escolar

Sistema web para la gestión integral de un colegio de secundaria: matrícula y pensiones, horarios y asistencia, evaluación por competencias, aula virtual y portal para docentes, apoderados y alumnos.

**Equipo Code&Coffee** · Ingeniería de Software · PUCP

| | |
|---|---|
| Tipo de aplicación | Web full-stack (frontend y backend en un solo proyecto) |
| Arquitectura | Monolito modular |
| Framework | Next.js (App Router + Route Handlers) · TypeScript |
| Interfaz | React + Tailwind CSS |
| Base de datos | PostgreSQL 16 (Docker en desarrollo, Amazon RDS en producción) |
| Acceso a datos | Prisma 7.10 |
| Autenticación | JWT con refresh token |
| Despliegue | AWS Academy: Amplify (aplicación) + RDS (base de datos) + S3 (archivos) |
| Documentos base | Requisitos v4.2 · Product Backlog v3.1 · Diagrama de clases v4.2 · Guía de arquitectura (C4) |

---

## Índice

1. [Cómo está organizado: frontend, backend y base de datos](#1-cómo-está-organizado-frontend-backend-y-base-de-datos)
2. [Mapa de carpetas](#2-mapa-de-carpetas)
3. [Frontend](#3-frontend)
4. [Backend](#4-backend)
5. [Base de datos](#5-base-de-datos)
6. [Módulos del sistema](#6-módulos-del-sistema)
7. [Puesta en marcha](#7-puesta-en-marcha)
8. [Scripts disponibles](#8-scripts-disponibles)
9. [Qué se sube al repositorio y qué no](#9-qué-se-sube-al-repositorio-y-qué-no)
10. [Flujo de trabajo con Git](#10-flujo-de-trabajo-con-git)
11. [Convenciones](#11-convenciones)
12. [Estándar de programación](#12-estándar-de-programación)

---

## 1. Cómo está organizado: frontend, backend y base de datos

Kubo es **una sola aplicación Next.js** que contiene las tres capas. No hay dos servidores ni dos repositorios: las pantallas y la API viven en el mismo proyecto y se despliegan juntas.

```
 Navegador (apoderado, alumno, docente, administrador)
        │
        ▼
 ┌──────────────────────────────────────────────────────────────┐
 │  FRONTEND   src/app/(portal)/  ·  src/components/            │
 │  Pantallas React + Tailwind. Solo muestran y piden datos.    │
 └──────────────────────────────┬───────────────────────────────┘
                                │ fetch('/api/v1/...')  (JSON)
                                ▼
 ┌──────────────────────────────────────────────────────────────┐
 │  BACKEND    src/app/api/v1/  ·  src/modules/  ·  src/platform/│
 │  Valida, aplica las reglas del negocio, controla permisos.   │
 └──────────────────────────────┬───────────────────────────────┘
                                │ Prisma
                                ▼
 ┌──────────────────────────────────────────────────────────────┐
 │  BASE DE DATOS   prisma/   →   PostgreSQL 16                 │
 │  50 tablas, restricciones, triggers y datos iniciales.       │
 └──────────────────────────────────────────────────────────────┘
```

**Regla de oro:** el frontend **nunca** importa Prisma ni accede a la base de datos. Todo pasa por la API.

---

## 2. Mapa de carpetas

Leyenda: 🟦 Frontend · 🟩 Backend · 🟨 Base de datos · ⚙️ Configuración · 🤖 Generado automáticamente (no editar, no se sube) · *(se crea al desarrollar)*

```
kubo/
├─ 🟨 prisma/
│  ├─ schema/                    Modelo de datos, un archivo por módulo
│  │  ├─ schema.prisma           Generador y conexión
│  │  ├─ enums.prisma            34 enumeraciones
│  │  ├─ identidad.prisma        Usuario, Sesion, TokenRecuperacion
│  │  ├─ platform.prisma         Notificacion, OutboxEvento, RegistroAuditoria, LogError
│  │  ├─ comunidad.prisma        Persona, Estudiante, Apoderado, Administrador, Docente, VinculoApoderado
│  │  ├─ academico.prisma        AnioAcademico, PeriodoEvaluacion, Grado, Seccion, Aula, AreaCurricular,
│  │  │                          Curso, Competencia, PlanEstudio, CompetenciaPlan, AsignacionDocente,
│  │  │                          ReglaConsolidacion, ParametroInstitucion
│  │  ├─ matricula.prisma        Matricula, HistorialSeccion, ConceptoCobro, OperacionPago, Pago, Comprobante
│  │  ├─ horarios.prisma         BloqueHorario, Horario, DetalleHorario, SesionClase,
│  │  │                          AsistenciaEstudiante, AsistenciaDocente
│  │  ├─ evaluacion.prisma       CierreCalificacion, Nota, ResultadoConsolidado,
│  │  │                          EvidenciaPedagogica, SolicitudRectificacion
│  │  └─ aula-virtual.prisma     UnidadDidactica, MaterialEstudio, EnlaceVirtual, Trabajo,
│  │                             TrabajoCompetencia, EntregaTrabajo, ArchivoEntrega
│  ├─ migrations/                Historial de cambios de la base (init + restricciones). SE SUBE
│  ├─ sql/
│  │  ├─ restricciones.sql       Índices parciales, CHECK y triggers (copia de referencia)
│  │  └─ pruebas.sql             17 pruebas de las reglas de la base
│  └─ seed.sql                   Datos iniciales (grados, áreas, competencias, cursos, parámetros, admin)
│
├─ src/
│  ├─ app/
│  │  ├─ 🟦 (portal)/            Pantallas por rol (los paréntesis no aparecen en la URL)  (se crea al desarrollar)
│  │  │  ├─ admin/               /admin/...     Administrador (AD-xx)
│  │  │  ├─ docente/             /docente/...   Docente (DO-xx)
│  │  │  ├─ apoderado/           /apoderado/... Apoderado (AP-xx)
│  │  │  └─ alumno/              /alumno/...    Alumno (AL-xx)
│  │  ├─ 🟦 login/               Ingreso, cambio de contraseña, selección de perfil (AC-xx)  (se crea al desarrollar)
│  │  ├─ 🟩 api/v1/              Endpoints REST, una carpeta por módulo  (se crea al desarrollar)
│  │  │  ├─ identidad/           /api/v1/identidad/...
│  │  │  ├─ matricula/           /api/v1/matricula/...
│  │  │  ├─ …                    (comunidad, academico, horarios, evaluacion, aula-virtual, portal)
│  │  │  └─ jobs/                Tareas programadas llamadas por EventBridge
│  │  ├─ 🟦 layout.tsx           Estructura común de todas las páginas
│  │  ├─ 🟦 page.tsx             Página inicial
│  │  └─ 🟦 globals.css          Estilos globales (Tailwind)
│  │
│  ├─ 🟦 components/             Componentes reutilizables: botones, tablas, formularios, modales  (se crea al desarrollar)
│  ├─ 🟦 lib/                    Utilidades del frontend: cliente de la API, formatos de fecha y moneda  (se crea al desarrollar)
│  │
│  ├─ 🟩 modules/                Lógica de negocio, un módulo por carpeta  (se crea al desarrollar)
│  │  └─ matricula/              (todos los módulos siguen esta misma estructura)
│  │     ├─ index.ts             Interfaz pública: lo ÚNICO que otros módulos pueden importar
│  │     ├─ application/         Casos de uso: registrarBorrador.ts, confirmarMatricula.ts…
│  │     ├─ domain/              Reglas puras, tipos y errores (sin Prisma)
│  │     ├─ infrastructure/      Repositorios: consultas Prisma del módulo
│  │     └─ schemas.ts           Validación de entrada y salida con Zod
│  │
│  ├─ 🟩 platform/               Servicios compartidos por todos los módulos
│  │  ├─ db/prisma.ts            Conexión única a la base de datos  ✅
│  │  ├─ auth/                   JWT, sesiones, permisos por rol  (se crea al desarrollar)
│  │  ├─ auditoria/              Registro en la bitácora  (se crea al desarrollar)
│  │  ├─ logger/                 Log de errores con rotación  (se crea al desarrollar)
│  │  ├─ notificaciones/         Notificaciones internas y correo  (se crea al desarrollar)
│  │  ├─ archivos/               Subida a S3 con URL firmada  (se crea al desarrollar)
│  │  ├─ pdf/                    Ficha de matrícula, libreta, horario  (se crea al desarrollar)
│  │  ├─ config/                 Lectura de ParametroInstitucion  (se crea al desarrollar)
│  │  └─ jobs/                   Tareas programadas y cola de eventos  (se crea al desarrollar)
│  │
│  ├─ 🟩 server/wiring.ts        Conecta los puertos entre módulos  (se crea al desarrollar)
│  └─ 🤖 generated/prisma/       Cliente Prisma generado por `npx prisma generate`
│
├─ 🟦 public/                    Imágenes y archivos estáticos (logo, íconos)
├─ docs/                         Requisitos, Backlog, diagrama de clases, guía de arquitectura
├─ tests/                        Pruebas, una carpeta por módulo  (se crea al desarrollar)
│
├─ ⚙️ docker-compose.yml         PostgreSQL 16 local en el puerto 5433
├─ ⚙️ prisma.config.ts           Ubicación del modelo, migraciones y conexión
├─ ⚙️ .env.example               Plantilla de variables (sin secretos). SE SUBE
├─ ⚙️ .env                       Variables reales. NO SE SUBE
├─ ⚙️ package.json               Dependencias y scripts
├─ ⚙️ package-lock.json          Versiones exactas instaladas. SE SUBE
├─ ⚙️ next.config.ts             Configuración de Next.js
├─ ⚙️ tsconfig.json              Configuración de TypeScript (alias @/* → src/*)
├─ ⚙️ eslint.config.mjs          Reglas de calidad de código
├─ ⚙️ postcss.config.mjs         Procesamiento de Tailwind
├─ ⚙️ .gitignore                 Lo que no se sube
├─ AGENTS.md · CLAUDE.md         Instrucciones para asistentes de IA
│
├─ 🤖 node_modules/              Librerías descargadas. NO SE SUBE
├─ 🤖 .next/                     Compilación de Next.js. NO SE SUBE
└─ 🤖 next-env.d.ts · *.tsbuildinfo   Archivos de TypeScript generados. NO SE SUBEN
```

---

## 3. Frontend

**Responsables:** equipo de Figma y front · **Carpetas:** `src/app/(portal)/`, `src/app/login/`, `src/components/`, `src/lib/`, `public/`

**Qué hace**
- Muestra las pantallas del prototipo Figma (AC-xx, AD-xx, DO-xx, AP-xx, AL-xx, M-xx).
- Pide y envía datos a la API con `fetch('/api/v1/...')`.
- Muestra los mensajes de error que devuelve la API (no inventa sus propias reglas de negocio).

**Reglas**
- Una carpeta por rol dentro de `(portal)`; el nombre de la carpeta es la URL: `src/app/(portal)/admin/matriculas/page.tsx` → `/admin/matriculas`.
- Los componentes que se repiten van en `src/components/` (por ejemplo `Tabla`, `Boton`, `Modal`, `Campo`).
- Estilos solo con Tailwind; colores y tipografía según la guía de corrección de Figma.
- **Prohibido** importar `@/generated/prisma`, `@/platform/*` o `@/modules/*` desde una pantalla.
- Textos y mensajes según la pestaña "Vocabulario y mensajes" de la guía de corrección de Figma.

**Cómo llamar a la API**

```ts
const res = await fetch("/api/v1/matricula/matriculas", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ estudianteId, modalidadPago: "MENSUAL" }),
});
const json = await res.json();
if (!res.ok) mostrarError(json.error.message); // { error: { code, message, details } }
else usar(json.data);                          // { data: ... }
```

---

## 4. Backend

**Responsables:** full stack / backend · **Carpetas:** `src/app/api/v1/`, `src/modules/`, `src/platform/`, `src/server/`

**Recorrido de una petición**

```
POST /api/v1/matricula/matriculas/{id}/confirmar
  │
  ├─ src/app/api/v1/matricula/.../route.ts      Route Handler: valida con Zod y exige rol
  ├─ src/modules/matricula/application/          Caso de uso: abre transacción, aplica reglas
  ├─ src/modules/matricula/domain/               Reglas puras (cronograma, estados)
  ├─ src/modules/matricula/infrastructure/       Consultas Prisma
  └─ src/platform/{auditoria, outbox}            Bitácora y eventos en la misma transacción
```

**Reglas del monolito modular**
- Cada módulo es dueño de sus tablas: solo su carpeta `infrastructure/` las consulta.
- Un módulo solo importa el `index.ts` de otro módulo, nunca sus carpetas internas.
- Las dependencias van hacia abajo (`portal` → … → `identidad` → `platform`). Cuando un módulo de abajo necesita algo de uno de arriba, se usa un puerto conectado en `src/server/wiring.ts`.
- `domain/` no importa Prisma ni Next.js: así se puede probar sin base de datos.

**Contrato de la API**
- Rutas: `/api/v1/<modulo>/<recurso>` en plural y minúsculas.
- Éxito: `{ "data": ... }` · Error: `{ "error": { "code": "SECCION_SIN_VACANTES", "message": "Sección sin vacantes disponibles", "details": {} } }`.
- Códigos HTTP: 200/201 éxito, 400 datos inválidos, 401 sin sesión, 403 sin permiso, 404 no existe, 409 conflicto, 422 regla de negocio, 500 error interno.

---

## 5. Base de datos

**Carpeta:** `prisma/` · Detalle completo en `docs/LEEME-BASE-DE-DATOS.md`

- **50 tablas, 34 enumeraciones, 93 relaciones**, según el diagrama de clases v4.2. En la base, tablas y columnas están en `snake_case` (`concepto_cobro.fecha_vencimiento`); en el código, en `camelCase` (`conceptoCobro.fechaVencimiento`).
- **Restricciones en la propia base:** 11 índices únicos parciales, 26 CHECK y 5 triggers (matrícula activa única, sección y responsable al confirmar, sin cruces de horario, auditoría inmutable, entre otras).
- **Migraciones:** cada cambio al modelo es una migración nueva en `prisma/migrations/`. Nunca se edita una migración ya aplicada.
- **Cambiar una tabla:** editar el `.prisma` del módulo **y** el diagrama de clases → `npx prisma migrate dev --name <descripcion>` → `npx prisma generate`.
- **Datos iniciales:** `npm run db:seed` carga grados, áreas y competencias del CNEB, cursos, parámetros y el administrador inicial (`admin@kubo.edu.pe`; la contraseña está en `docs/LEEME-BASE-DE-DATOS.md` y se cambia en el primer ingreso).

**Ver las tablas:** `npm run db:studio` (Prisma Studio en el navegador) o la extensión PostgreSQL de VS Code con `localhost`, puerto **5433**, usuario `kubo`, base `kubo_dev`.

---

## 6. Módulos del sistema

| Módulo | Qué resuelve | Tablas principales |
|---|---|---|
| `platform` | Servicios compartidos: conexión, auditoría, logs, notificaciones, cola de eventos | Notificacion, OutboxEvento, RegistroAuditoria, LogError |
| `identidad` | Login, sesiones, bloqueo por intentos, recuperación y cambio de contraseña | Usuario, Sesion, TokenRecuperacion |
| `comunidad` | Personas (un registro por DNI) y sus roles; vínculo apoderado–estudiante | Persona, Estudiante, Apoderado, Administrador, Docente, VinculoApoderado |
| `academico` | Año, bimestres, grados, secciones, aulas, currículo, plan de estudios, asignación docente, reglas y parámetros | AnioAcademico, Seccion, Curso, Competencia, PlanEstudio, AsignacionDocente… |
| `matricula` | Matrícula en dos pasos, traslados, retiros, cronograma de cobros, pagos y comprobantes | Matricula, ConceptoCobro, OperacionPago, Pago, Comprobante… |
| `horarios` | Horarios versionados sin cruces, sesiones de clase y asistencia de alumnos y docentes | Horario, DetalleHorario, SesionClase, AsistenciaEstudiante… |
| `evaluacion` | Notas por competencia, cierre, consolidación, publicación y rectificaciones | CierreCalificacion, Nota, ResultadoConsolidado… |
| `aula-virtual` | Unidades, materiales, enlaces de clase, trabajos y entregas | UnidadDidactica, MaterialEstudio, Trabajo, EntregaTrabajo… |
| `portal` | Paneles de inicio por rol (solo lectura, combina datos de los demás módulos) | — |

Orden de desarrollo sugerido: `platform` → `identidad` → `comunidad` → `academico` → `matricula` → `horarios` → `evaluacion` → `aula-virtual` → `portal`.

---

## 7. Puesta en marcha

**Requisitos:** Node.js LTS, Git, Docker Desktop abierto y VS Code.

```powershell
git clone <url-del-repositorio>
cd kubo
npm install
copy .env.example .env
npm run db:up                 # enciende PostgreSQL en el puerto 5433
npx prisma migrate dev        # crea las tablas y aplica las restricciones
npx prisma generate           # genera el cliente Prisma
npm run db:seed               # datos iniciales
npm run dev                   # abre http://localhost:3000
```

Si el puerto 5433 está ocupado, cámbialo en `docker-compose.yml` y en tu `.env`.

---

## 8. Scripts disponibles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Inicia la aplicación en modo desarrollo (http://localhost:3000) |
| `npm run build` / `npm start` | Compila y ejecuta la versión de producción |
| `npm run lint` | Revisa el código con ESLint |
| `npm run format` / `npm run format:check` | Formatea todo el proyecto con Prettier, o solo verifica el formato |
| `npm run typecheck` | Revisa los tipos con TypeScript |
| `npm test` | Ejecuta las pruebas con Vitest |
| `npm run check` | Formato, lint, tipos, pruebas y build: lo mismo que ejecuta el CI |
| `npm run db:up` / `npm run db:down` | Enciende o apaga PostgreSQL en Docker |
| `npm run db:migrate` | Crea o aplica migraciones (`prisma migrate dev`) |
| `npm run db:seed` | Carga los datos iniciales |
| `npm run db:studio` | Abre Prisma Studio para ver los datos |
| `npm run db:reset` | Borra la base, la recrea y vuelve a cargar los datos iniciales (solo en desarrollo) |
| `npm run db:deploy` | Aplica las migraciones pendientes a la base de `DATABASE_URL` sin borrar nada (base remota) |
| `npm run db:seed:remoto` | Carga los datos iniciales en la base de `DATABASE_URL` sin usar Docker (base remota) |

`npm install` ejecuta `prisma generate` automáticamente (`postinstall`). El despliegue está descrito en `docs/DESPLIEGUE.md`.

---

## 9. Qué se sube al repositorio y qué no

| Se sube ✅ | No se sube ❌ (lo controla `.gitignore`) |
|---|---|
| `src/` (excepto `src/generated/`), `public/`, `prisma/` completo (incluidas las migraciones), `docs/`, `tests/` | `node_modules/` (se reinstala con `npm install`) |
| `package.json` y `package-lock.json` | `.next/`, `out/`, `build/` (compilaciones) |
| Archivos de configuración (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `prisma.config.ts`, `docker-compose.yml`) | `.env` y cualquier `.env.*` con valores reales |
| `.env.example` (plantilla sin secretos) | `src/generated/prisma/` (se regenera con `npx prisma generate`) |
| `README.md`, `AGENTS.md`, `CLAUDE.md`, `.gitignore` | `next-env.d.ts`, `*.tsbuildinfo`, `coverage/`, `logs/`, `*.log` |
| `.vscode/settings.json` y `.vscode/extensions.json` (configuración compartida del equipo) | Archivos del sistema (`Thumbs.db`, `.DS_Store`) y del editor personal |

**Nunca subir:** contraseñas, claves de AWS, el `JWT_SECRET` ni copias de la base de datos con datos reales de alumnos (RNF14, protección de datos personales).

---

## 10. Flujo de trabajo con Git

```
main        ← versión entregable (solo se actualiza desde develop, con pull request)
 └ develop  ← integración del equipo
    ├ feature/identidad-login
    ├ feature/matricula-registro
    └ fix/horario-cruce-docente
```

1. Actualiza `develop`: `git checkout develop && git pull`.
2. Crea tu rama: `git checkout -b feature/<modulo>-<tarea>`.
3. Haz commits pequeños con mensajes claros: `feat(matricula): confirmar matrícula con validación de vacantes`.
4. Sube la rama y abre un **pull request hacia `develop`**; otro integrante lo revisa antes de unirlo.
5. Si cambiaste el modelo de datos, incluye la migración en el mismo pull request.

Prefijos de commit: `feat` (nueva función), `fix` (corrección), `docs`, `refactor`, `test`, `chore` (configuración).

---

## 11. Convenciones

- **Idioma:** nombres de dominio en español, igual que en el diagrama de clases (`Matricula`, `confirmarMatricula`, `ConceptoCobro`); palabras técnicas en inglés (`route.ts`, `page.tsx`, `schema`).
- **Nombres:** `PascalCase` para componentes y modelos, `camelCase` para variables y funciones, `kebab-case` para carpetas de rutas (`aula-virtual`), `UPPER_SNAKE_CASE` para códigos de error (`SECCION_SIN_VACANTES`).
- **Formato:** Prettier y ESLint antes de cada commit; sin `console.log` en el código final (usar el logger de `platform`).
- **Fuente de verdad:** si el código y un documento no coinciden, se corrige el que esté mal y se avisa al equipo. El orden es Requisitos v4.2 → diagrama de clases v4.2 → este repositorio.

---

## 12. Estándar de programación

Todo el código sigue el [estándar de programación del equipo](docs/ESTANDAR-PROGRAMACION.md): nombres, estructura de módulos, API, frontend, base de datos, pruebas y flujo de Git.

Antes de abrir un pull request debe pasar:

```powershell
npm run check                 # formato, lint, tipos, pruebas y build
```
