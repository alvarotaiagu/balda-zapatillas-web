# Balda · zapatillas en la pared (plantilla)

> **Sitio de demostración.** Balda es una tienda ficticia; los precios y las tallas son de ejemplo y la bolsa no cobra nada. Lleva `noindex` en todas las páginas.

Segundo intento del estilo de los reels del 2026-10-31 (`biblioteca-movimiento/referencias/reels-2026-10-31/`, LASTDEPT), después de que `varal-lugo-web/` no llegara. Esta vez es **una sola pantalla con una escena 3D** y nada debajo.

## Qué es

- **Una pared** gris oscura con dos filas de cinco baldas de metacrilato y una zapatilla en cada una. Todas con la misma luz: HDRI de estudio suave, un foco cálido desde arriba y delante que deja sombras blandas detrás de cada zapatilla, y un rebote cálido desde abajo.
- **Pasar el ratón**: la balda se enciende en naranja (canto, cristal y reflejo en la pared) y debajo sale el nombre con el precio.
- **Pulsar**: la cámara se acerca por la pared hasta esa zapatilla, que queda en la mitad de la pantalla con las vecinas cortadas en los bordes. Arriba a la derecha aparece una tarjeta pequeña: serie, precio, marca y modelo, color, tallas (con agotadas) y «Añadir a la bolsa». Con el ratón, la zapatilla gira un poco hacia donde lo mueves.
- **Flechas** (las de pantalla o las del teclado): la cámara recorre la pared hasta la siguiente, separándose un poco a mitad de camino. **Esc** vuelve a la pared.
- **Enlace directo**: `index.html#pegasus-trail` abre esa zapatilla.
- **Móvil**: se ven unas dos columnas; se arrastra la pared con inercia y se toca para acercar. En el zoom, deslizar pasa a la siguiente y la tarjeta va abajo.
- **Plan B sin WebGL** (o si falla la escena): la imagen fija de la misma pared con los mismos botones encima, la misma tarjeta, flechas y Esc. El zoom es la imagen escalada hasta ese hueco.
- **Interfaz**: logo y título pequeños arriba a la izquierda, «Bolsa (0)» arriba a la derecha, créditos y aviso legal abajo. Sin secciones, sin marquesina, sin letra a letra, sin serif ni crema, sin cursor propio y sin cortina: la entrada es la pared encendiéndose a medida que llegan las zapatillas.

## Cómo está hecho

Sin build. `index.html` + `css/balda.css` + `js/app.js` (interfaz, las dos vistas) + `js/escena.js` (Three.js 0.160 desde jsDelivr con importmap) + `js/datos.js` (productos y créditos).

- **Botones encima de la escena**: diez `<button class="zona">` que siguen en pantalla el hueco de cada balda (escena.js manda sus rectángulos cada vez que pinta). Así el ratón, el teclado y el lector de pantalla van por el DOM, y el plan B usa los mismos botones colocados en %.
- **Solo pinta si algo cambia** (cámara, luz de balda, giro). Las sombras se recalculan solo cuando se mueve algo.
- **Dos tamaños por zapatilla**: `modelos/<slug>-pared.glb` (unas 25k caras, texturas de 1024; 4,5 MB los diez) y `modelos/<slug>.glb` para el zoom (hasta 90k caras, color a 2048; 0,8–2,1 MB cada uno). En el ordenador las de zoom se bajan después, de una en una; en el móvil, solo la que abres.
- **Resplandor del canto sin posproceso**: un plano con degradado (halo) delante del filo, en suma aditiva y sin tono de imagen, así el naranja sale naranja. Igual en el ordenador y en el móvil.
- **Calidad automática**: tras cargar, si los fotogramas seguidos pasan de 24 ms baja la nitidez a 1 y luego a 0,8. `?fps` enseña el contador. La sombra de la zapatilla que gira en el zoom se recalcula una de cada cuatro veces.
- **Baratas a propósito**: metacrilato sin `transmission` (pintaba la escena dos veces), sin luces rectangulares, sombra VSM de 1024 que solo se recalcula si algo se mueve, materiales compilados con `compileAsync` antes de enseñarlos y texturas subidas de una en una.
- **Movimiento reducido**: la cámara salta sin viaje y la zapatilla no gira.

### Mando de dos versiones (solo con `?revision`)

«Escaparate» (naranja con halo, la cámara sigue al ratón) y «Sobria» (luz blanca y tenue al señalar, cámara quieta). **No viaja al cliente**: para borrarlo, quitar `#mando` del HTML, el bloque `poner` de `app.js` y el `<script>` del `<head>` que lee `balda-densidad`.

### Imagen del plan B

`img/pared.webp` + `img/pared.json` (rectángulos de cada hueco en %). La de ahora es la segunda captura de Álvaro (2026-11-01), con las baldas de metacrilato ya ajustadas; repetirla si cambia la luz de la pared. Si no hay captura, `scripts/4-lamina-provisional.py` hace una provisional con puntos. Para capturar:

1. Abrir `index.html?captura` en Chrome (con tarjeta gráfica).
2. Pulsar «Descargar imagen del plan B» cuando la pared esté encendida. Baja `pared.png` (4000×2000) y `pared.json`.
3. Convertir a WebP y copiar los dos a `img/`.

## Modelos: de Sketchfab a la web

Los zip glTF de Sketchfab traen las texturas originales; el GLB que da Sketchfab las baja a 1024. Cadena en `scripts/` (necesita `@gltf-transform/core|extensions|functions@4`, `meshoptimizer` y `sharp`):

1. `1-preparar.mjs <carpeta zips descomprimidos> <trabajo>`: especular-brillo → metal-rugosidad, sin jerarquía, simplificado a 90k caras, WebP 2048 y nube de puntos coloreada.
2. `2-orientar.py <trabajo>`: rotación de cada una (punta a +X, arriba +Y) → `rot.json`, y una hoja con la vista de la pared para comprobarlo. `vistas.py` saca las seis vistas de cada modelo.
3. `3-exportar.mjs <trabajo> modelos`: orienta, escala a 30 cm, apoya la suela en y=0 y saca las dos versiones con compresión meshopt. Escribe `modelos/medidas.json`.

## Comprobación

`node verificar.mjs` (puerto 8941). Lanza un solo Chromium **sin WebGL**: comprueba la interfaz y el plan B en escritorio y en móvil, el `noindex`, los créditos, la bolsa, el aviso de cookies y el mando. **El 3D no se prueba con Playwright** (regla de WEBS NEGOCIOS/CLAUDE.md): del 3D solo comprueba que el lienzo existe, que `escena.js` es JavaScript válido y que las URL del importmap responden. La escena la mira Álvaro en su Chrome.
