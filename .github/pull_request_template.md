## Qué cambia

<!-- Resumen corto de lo que hace este pull request. -->

## Por qué

<!-- Requisito (RF/RNF), pantalla del Figma o problema que resuelve. -->

## Cómo probarlo

<!-- Pasos para que el revisor lo compruebe: comandos, pantallas, bloques de docs/api/*.http. -->

## Capturas (si toca la UI)

<!-- Antes y después, o la pantalla junto a su referencia del Figma. -->

## Checklist (estándar de programación, sección 12)

Un punto sin marcar se justifica aquí o bloquea la aprobación.

- [ ] 1. El título sigue el formato de commit y la rama, el formato tipo/descripcion (sección 10)
- [ ] 2. `npm run check` pasa en local y el CI está en verde (11.2)
- [ ] 3. Los nombres siguen las convenciones, en español y sin abreviaturas inventadas (2)
- [ ] 4. La lógica de negocio está en `modules/`, no en `route.ts` ni en componentes (3, 5.1)
- [ ] 5. Ningún import se salta el index.ts de otro módulo (3.3)
- [ ] 6. Toda entrada se valida con Zod y cada ruta protegida usa `requerirSesion` con sus roles (5.5, 8)
- [ ] 7. Los errores usan `ErrorApp` con un código estable y un mensaje claro en español (5.4)
- [ ] 8. Las escrituras múltiples usan transacción y las operaciones críticas registran auditoría (5.6)
- [ ] 9. La interfaz usa `components/ui` y los tokens del tema, y resuelve carga, error y vacío (6)
- [ ] 10. Hay pruebas para las reglas nuevas o para el bug corregido (9)
- [ ] 11. Si cambia el modelo: migración nueva, diagrama actualizado y `db:deploy` en Neon antes de unir (7)
- [ ] 12. No hay secretos, datos reales ni `console.log`; `.env.example` está actualizado (8)
- [ ] 13. `docs/api` y el README reflejan el cambio (5.8)
