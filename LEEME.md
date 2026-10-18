# TikToff

Cámara con filtros para el móvil. No tiene cuentas, ni feed, ni subidas: todo se procesa en el propio teléfono y solo se guarda lo que ella decida guardar o enviar.

## Publicarla (GitHub Pages)

1. En GitHub → Settings → Pages → *Build and deployment*: Source **Deploy from a branch**, rama **main**, carpeta **/ (root)**.
2. A los pocos minutos queda en `https://ghontanar.github.io/Tiktoff/`.
3. Ábrela en Chrome del Android → menú ⋮ → **Instalar aplicación**.

## Publicarla (Cloudflare Pages)

1. Cloudflare → Workers & Pages → Crear → Pages → **Subir recursos**.
2. Arrastra esta carpeta entera (no hace falta compilar nada).
3. Abre la dirección `https://….pages.dev` en Chrome del Android. La cámara solo funciona con https.
4. Menú ⋮ → **Instalar aplicación** (o "Añadir a pantalla de inicio").

## Qué incluye

- **Color**: Normal, Bruma, Peli 98, Noir, Chicle, Térmica, Purpurina.
- **Arte**: Neón, Cómic, Píxel, Glitch, VHS, Espejo, Caleido, Ondas, Lluvia de estrellas.
- **Caras**: Ojos XXL, Burbuja, Gatito, Gafas estrella, Corona de flores, Corazones, Alien, Elegante.
- **Juegos**: Boca mágica (abre la boca y salen corazones y estrellas), Ruleta (¿qué animal eres hoy?…), Imita.
- **Música**: cuatro ritmos propios que la app genera al momento, o una canción guardada en el móvil. Opción de grabar también la voz, y con una canción del móvil se elige en qué segundo empieza.
- **Lo que suena en TikTok**: lista de canciones en tendencia (solo título y artista, sin audio) con un botón para buscarlas en YouTube. Se actualiza sola cada lunes con la tarea de GitHub `.github/workflows/trending.yml`, que lee el TikTok Creative Center y guarda `trending.json`. Si TikTok cambia su web y la tarea falla, la app sigue mostrando la última lista buena; también se puede lanzar a mano desde la pestaña Actions → «Tendencias de TikTok» → Run workflow.
- **Gestos**: deslizar a los lados cambia de filtro y doble toque gira la cámara. En modo Foto, tocar hace una foto y mantener pulsado graba. En modo Vídeo, tocar empieza y para (60 s como máximo). También tiene cuenta atrás de 3 s.
- **Guardar** deja el archivo en la carpeta Descargas del móvil, que aparece en la galería. **Enviar** abre el menú de compartir de Android.

## Detalles técnicos

- Los filtros de imagen son shaders WebGL (`index.html`).
- El seguimiento de la cara usa MediaPipe Face Landmarker (Apache 2.0), incluido en `vendor/mediapipe`. El modelo (unos 3,6 MB) se descarga de Google la primera vez que se usa un filtro de cara y queda guardado en el móvil. Las imágenes de la cámara nunca salen del teléfono.
- `sw.js` guarda la app en caché para que abra rápido y funcione sin conexión.
- Si cambias archivos, sube la versión de `CACHE` en `sw.js` para que el móvil descargue la nueva.
