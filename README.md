# 🎬 Cine con Amigos

Página independiente estilo Rave para ver contenido con amigos.

## Incluye
- Crear y unirse a salas mediante código.
- Enlace de invitación.
- Usuarios dentro de la sala.
- Chat.
- YouTube (enlaces normales, Shorts, Live y enlaces de inserción).
- Códigos HTML `<iframe>`: extrae y procesa el atributo `src` automáticamente.
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

Para YouTube se usa el reproductor oficial incrustado. Si el propietario del video desactiva la inserción, YouTube no permitirá reproducirlo dentro de la sala. El anfitrión controla la reproducción y el cliente intenta sincronizar el tiempo; el navegador puede exigir que cada participante toque una vez el reproductor para permitir audio/autoplay.

## Publicación

El proyecto está preparado para servidores Node.js que expongan `process.env.PORT`, por ejemplo Render.

En Render:
- Runtime: Node
- Build command: dejar vacío
- Start command: `node server.js`

La versión actual guarda las salas en memoria. Si el servidor se reinicia, las salas desaparecen. Para una versión de producción conviene agregar una base de datos y WebSockets.


## Pantalla completa y orientación
- El reproductor original se mueve a pantalla completa sin crear una copia, para conservar el tiempo de reproducción y evitar reiniciar el video.
- Se solicita orientación horizontal cuando el navegador móvil lo permite; si el navegador lo bloquea, se mantiene pantalla completa.
- El video usa `object-fit: contain` para conservar la imagen completa sin recortar los bordes.
- La reproducción fluida depende también de la velocidad de conexión, del servidor del video y de si el sitio externo permite inserción.
