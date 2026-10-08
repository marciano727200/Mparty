# 🎬 Cine con Amigos

Página independiente estilo Rave para ver contenido con amigos.

## Incluye
- Crear y unirse a salas mediante código.
- Enlace de invitación.
- Usuarios dentro de la sala.
- Chat.
- YouTube.
- Enlaces directos `.mp4`, `.webm`, `.ogg`, etc.
- Intento de reproducción mediante iframe para otras páginas compatibles.
- Controles del anfitrión.
- Estado de reproducción compartido entre usuarios.
- Pantalla completa.
- Diseño responsive con estética neón.

## Requisito
Node.js 18 o superior.

## Probar en tu computadora

1. Abre una terminal dentro de esta carpeta.
2. Ejecuta:

   node server.js

3. Abre:

   http://localhost:3000

Para probar con dos dispositivos en la misma red Wi‑Fi, usa la IP local de la computadora, por ejemplo:

   http://192.168.1.20:3000

## Importante sobre enlaces externos

No todos los sitios permiten que su contenido se coloque dentro de un iframe. Si una página utiliza políticas como `X-Frame-Options` o `Content-Security-Policy`, el navegador impedirá mostrarla dentro de Cine con Amigos. Eso no se puede solucionar desde JavaScript del navegador.

Para YouTube se usa el reproductor oficial incrustado.

## Publicación

El proyecto está preparado para servidores Node.js que expongan `process.env.PORT`, por ejemplo Render.

En Render:
- Runtime: Node
- Build command: dejar vacío
- Start command: `node server.js`

La versión actual guarda las salas en memoria. Si el servidor se reinicia, las salas desaparecen. Para una versión de producción conviene agregar una base de datos y WebSockets.
