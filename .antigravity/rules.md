# Reglas del proyecto — MechHub Taller

## Qué es este proyecto
Sistema de gestión de talleres mecánicos multi-tenant. Cada taller tiene su propio SQLite (`db.sqlite`). Hay una base global `super.db` para metadatos, usuarios superadmin, cadenas y cola de sincronización.

---

## Estructura general

```
backend/
  server.js           ← Entry point, monta rutas y arranca workers
  superDb.js          ← Conexión y schema de super.db (talleres, cadenas, sync_queue)
  tenantManager.js    ← Gestión de DBs por taller (getDb, createTenant, etc.)
  migrate.js          ← Migraciones incrementales de tenant DBs
  routes/
    super.js          ← API del superadmin (/api/super/...)
    chain.js          ← API de vista de cadena (/api/chain/...)
    chainSync.js      ← Lógica de sincronización entre talleres
    clients.js        ← CRUD de clientes y vehículos por taller
    orders.js         ← CRUD de órdenes
    auth.js           ← Login por taller
    ...
  middleware/
    tenant.js         ← Inyecta req.db y req.slug para rutas /api/:slug/
    auth.js           ← JWT auth para usuarios de taller
frontend/
  app/[slug]/...      ← Páginas por taller
  app/chain/...       ← Portal de cadena (multi-taller)
  app/superadmin/...  ← Panel superadmin
  lib/api.ts          ← Axios con baseURL dinámica por slug
```

---

## Reglas críticas de arquitectura

### Bases de datos
- **Nunca mezcles `superDb` con `getDb(slug)`**. Son dos SQLite distintos.
  - `superDb` = `backend/super.db` → workshops, tenant_chains, chain_members, sync_queue, chain_users
  - `getDb(slug)` = `backend/tenants/{slug}/db.sqlite` → clients, vehicles, orders, etc.
- **`getDb(slug)` usa caché en memoria** (`dbCache`). No crear nuevas conexiones manualmente.
- Las migraciones de tenant van en `tenantManager.js` usando `addColumn()`. Nunca usar `ALTER TABLE` directamente fuera de ese patrón.
- Las migraciones de super.db van en `superDb.js` con el mismo patrón `addColumn()`.

### Rutas y middleware
- Todas las rutas de taller viven bajo `/api/:slug/` y pasan por `tenantMiddleware`.
- El middleware inyecta `req.db` (DB del taller) y `req.slug` (string del taller).
- **Nunca hardcodear slugs**. Siempre usar `req.slug`.
- Las rutas de superadmin (`/api/super/`) usan `superAuth` definido en `routes/super.js`.
- Las rutas de cadena (`/api/chain/`) usan `chainAuth` definido en `routes/chain.js`.

### Sincronización entre talleres (cadenas)
- La sincronización en tiempo real usa `enqueueSyncToChain(slug, operation, payload)` de `chainSync.js`.
- Esto inserta jobs en `sync_queue` de `super.db` y los procesa un worker cada 30 segundos.
- La sincronización masiva (resync manual) usa `mergeTenantsOnCouple()` en `super.js`.
- Operaciones soportadas: `upsert_client`, `upsert_vehicle`.
- **Para que sync funcione**, el taller debe estar en `chain_members`. Si no está, `enqueueSyncToChain` retorna silenciosamente.
- Todos los clientes y vehículos tienen columnas `uuid` (TEXT) y `source_tenant` (TEXT) para deduplicación cross-taller.

### Frontend
- `api.ts` exporta una instancia Axios por defecto que detecta el slug desde la URL (`window.location.pathname`).
- Para el superadmin usar `superApi`. Para el portal de cadena usar `chainApi`. Para clientes del portal usar `clientApi`.
- **No usar `localStorage` directamente** en lógica de negocio — ya está encapsulado en los interceptores de `api.ts`.

---

## Convenciones de código

- **Node.js + CommonJS** (`require`/`module.exports`). No usar ES modules en el backend.
- **better-sqlite3** es síncrono. No usar `.then()` ni `async/await` en queries SQLite.
- Los errores de sync **nunca deben ser silenciados** con `catch(e) {}` vacío. Siempre loguear: `catch(e) { console.warn('[contexto]', e.message); }`.
- Los `setImmediate()` se usan para diferir trabajo pesado después de responder al cliente. El trabajo dentro no tiene acceso al objeto `res`.
- Frontend en **Next.js 14 App Router** con TypeScript.

---

## Lo que NO hacer

- No crear nuevas tablas en tenant DBs sin agregarlas en `tenantManager.js` con `CREATE TABLE IF NOT EXISTS`.
- No modificar `super.db` schema sin agregarlo en `superDb.js`.
- No usar `db.exec()` con múltiples statements para migraciones en producción — usar `addColumn()` que maneja errores de columna duplicada.
- No asumir que un cliente tiene `uuid` — puede ser NULL en datos viejos. Siempre hacer backfill antes de operar sobre UUIDs.
- No filtrar clientes por `source_tenant` en el frontend — ese campo es solo para lógica de sync del backend.
- No agregar lógica de negocio en `middleware/tenant.js` — solo carga de DB y validación de estado del taller.

---

## Endpoints clave de referencia

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/:slug/auth/login` | Login de usuario de taller |
| GET | `/api/:slug/clients` | Lista paginada de clientes |
| POST | `/api/:slug/clients` | Crear cliente (dispara chain sync) |
| GET | `/api/super/chains` | Lista de cadenas (superadmin) |
| POST | `/api/super/chains/:id/resync` | Resync masivo de cadena |
| POST | `/api/super/chains/:id/resync-debug` | Resync con reporte detallado para diagnóstico |
| GET | `/api/super/chains/:id/sync-status` | Estado de sync_queue de la cadena |
| GET | `/api/chain/clients` | Clientes unificados de toda la cadena (portal cadena) |
