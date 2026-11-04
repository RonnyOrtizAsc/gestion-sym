# Gestión SYM

App de gestión de la empresa, pensada para usarse desde el celular en la obra.

## Secciones

- **Obra**: plano en vivo. Cada trabajador aparece en el área de trabajo o en la zona de receso, con su tiempo y las herramientas que tiene.
- **Recesos**: iniciar receso, tocar a cada persona (naranja = receso, verde = trabajando), resumen y registro del día.
- **Herramientas**: prestar (persona → herramienta → cantidad), ver quién tiene qué, marcar devuelta o perdida, inventario de bodega.
- **Más**: planificador de obra, lista de trabajadores con puesto y habilidades, usuarios de la app (solo administrador) y cuenta.

## Cómo está hecha

- Página estática (HTML, CSS y JavaScript sin compilación), publicada con GitHub Pages.
- Datos en **Supabase** (proyecto `gestion-sym`), con seguridad RLS: solo usuarios aprobados ven y editan datos.
- Los cambios se ven al instante en todos los celulares (tiempo real de Supabase).
- Se instala como app desde el navegador del celular (PWA).

## Usuarios

- La primera persona que crea cuenta queda como **administrador**.
- Las demás (encargados) crean su cuenta y esperan a que el administrador les dé acceso en **Más → Usuarios de la app**.

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | Estructura de la app |
| `css/app.css` | Estilos |
| `js/config.js` | Conexión con Supabase |
| `js/datos.js` | Carga de datos y acciones que guardan en la base |
| `js/app.js` | Ingreso, navegación y tiempo real |
| `js/vistas/*.js` | Una sección por archivo |
| `sw.js`, `manifest.webmanifest`, `icons/` | Lo que permite instalarla como app |
