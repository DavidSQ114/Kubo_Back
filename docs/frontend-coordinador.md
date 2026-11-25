# Frontend · Portal del Coordinador académico y cambios del Administrador (bloque M1)

Bloque M1 (sprint 4): separación entre el **Administrador** y el **Coordinador académico**, también en el servidor ([ACCESOS.md](ACCESOS.md)). API: [api/comunidad.md](api/comunidad.md), [api/identidad.md](api/identidad.md) y [api/academico.md](api/academico.md#parámetros-del-sistema-bloque-m1). Casos de prueba: [pruebas/casos-sprint4-coordinador.md](pruebas/casos-sprint4-coordinador.md).

## Archivos

```
src/components/admin/PortalAdmin.tsx                PortalGestion: guardia, barra lateral y superior de los dos portales de gestión;
                                                    menú del Administrador y DestinosPortal (a dónde enlazan las piezas compartidas)
src/components/coordinador/PortalCoordinador.tsx    menú y destinos del Coordinador académico
src/app/(portal)/coordinador/layout.tsx             guardia de /coordinador
src/app/(portal)/coordinador/page.tsx               inicio del coordinador
src/app/(portal)/admin/page.tsx                     inicio del administrador (sin «Próximamente»)
src/components/admin/inicio.tsx                     InicioGestion: saludo y una tarjeta por pantalla
src/app/(portal)/coordinador/{anio,grados,cursos,reglas,matricula,pagos,morosidad,horarios,asistencia,notas}
                                                    pantallas movidas desde /admin con git mv (mismo código)
next.config.ts                                      redirecciones temporales /admin/<pantalla> → /coordinador/<pantalla>
src/app/(portal)/coordinador/asignaciones/page.tsx  «Asignaciones docentes» (US14), antes dentro de AD-07
src/app/(portal)/coordinador/alumnos-apoderados/page.tsx  alumnos y apoderados: detalle, vínculos y edición
src/app/(portal)/coordinador/bitacora-notas/page.tsx      bitácora de notas (US03), antes pestaña de AD-16
src/components/admin/registroEstudiante.tsx         AD-09 compartido; páginas finas en los dos portales
src/components/admin/registroApoderado.tsx          AD-08 compartido; páginas finas en los dos portales
src/app/(portal)/admin/espacios/page.tsx            «Espacios»: aulas (antes bloque «Aulas físicas» de AD-03)
src/components/admin/espacios.tsx                   tabla y formulario de aulas
src/app/(portal)/admin/parametros/page.tsx          «Parámetros del sistema»
src/components/admin/operacionesAuditadas.tsx       AD-16, pestaña «Operaciones auditadas»
src/components/admin/usuarios.tsx                   «Registrar coordinador», insignia «Bloqueada por intentos» y modal «Desbloquear»
src/components/admin/personas.tsx                   el coordinador no ve «Eliminar» y solo edita a alumnos y apoderados
src/app/perfil/page.tsx                             «Mi perfil» (todos los roles)
```

## Menús

- **Administrador:** Inicio · COMUNIDAD: Usuarios · INSTITUCIÓN: Espacios, Parámetros del sistema · PERSONAL: Asistencia docente · SEGURIDAD: Auditoría y errores.
- **Coordinador académico:** Inicio · CONFIGURACIÓN: Año y bimestres, Grados y secciones, Cursos y competencias, Reglas de evaluación, Asignaciones docentes · MATRÍCULA Y PAGOS: Matrícula, Alumnos y apoderados, Pensiones y pagos, Morosidad · ACADÉMICO: Horarios, Asistencia de alumnos, Notas y rectificaciones, Bitácora de notas.
- La tarjeta del usuario dice «Administrador» o «Coordinador académico» y ofrece «Mi perfil», «Cambiar contraseña», el cambio de perfil (si tiene varios) y «Cerrar sesión».
- Quien entra por URL a un portal ajeno vuelve al inicio de su propio portal (`inicioPorRol`), en todos los portales. Antes iba a AC-07 «Acceso denegado».
- Las rutas viejas (`/admin/anio`, `/admin/pagos?estudiante=…`, etc.) redirigen a `/coordinador/…` con su consulta. Si quien llega es el administrador, la guardia del portal lo devuelve a `/admin`.

## Diferencias con el Figma

- El Figma «Kubo – Prototipo» no tiene página ni frames del Coordinador académico (sus pantallas usan los prefijos AC, AD, DO, AP, AL y M). El portal del coordinador usa **el mismo diseño del administrador** (barra lateral azul de AD-06) con «Coordinador académico» en la tarjeta del usuario. Las pantallas AD-02 a AD-05, AD-07 (carga académica), AD-09 a AD-13, AD-15 y la pestaña «Cambios de notas» de AD-16 se ven igual que en el Figma, pero dentro de `/coordinador`.
- AD-03 pasa a llamarse «Grados y secciones»: las aulas se administran en «Espacios» del administrador, con la misma tabla y el mismo formulario del Figma. El coordinador solo las elige al armar una sección.
- AD-07 «Registrar docente» del administrador ya no muestra la carga académica: está en «Asignaciones docentes» del coordinador, con el mismo componente.
- AD-14 pierde las pestañas «Asistencia docente | Asistencia de alumnos»: cada pantalla quedó en un portal distinto.
- AD-16 «Auditoría» del administrador cambia «Cambios de notas» por «Operaciones auditadas» (bitácora de operaciones críticas); «Errores del sistema» sigue igual.
- Pantallas no diseñadas en el Figma, hechas con el lenguaje visual de AD-06: inicio de cada portal (tarjetas de acceso), «Alumnos y apoderados», «Asignaciones docentes», «Espacios», «Parámetros del sistema», «Operaciones auditadas», el modal «Registrar coordinador» (el de administrador con otros textos), «Desbloquear» (el de reactivar con otros textos) y «Mi perfil» (página propia con la barra azul y «Volver a mi portal», para que funcione igual en los cinco portales).
- La barra superior del coordinador no tiene el buscador de usuarios (es de «Usuarios», que solo ve el administrador).
- Los portales de gestión siguen sin ser responsivos a 390 px (como antes del bloque); «Mi perfil» sí lo es.
