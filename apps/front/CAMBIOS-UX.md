# Rediseño del sitio público — HotelSync

Referencias: Aman y Belmond (calma, foto a sangre, marca centrada), Ace, The Hoxton y
Standard (tipografía con carácter, destinos con frase propia, voz cálida) y 1 Hotels
(pilares de la casa, tono sereno).

## Instalar
Se agregaron dos dependencias (fuentes autoalojadas, sin Google Fonts):
`@fontsource/gilda-display` y `@fontsource-variable/jost`. Correr `npm install` en la raíz
del monorepo. `framer-motion` ya estaba en `package.json`; ahora se usa.

## Sistema visual
- `tailwind.config.js`: paleta refinada (papel de piedra, carbón con sesgo verde, latón).
  Se conservan los nombres `brand.navy / gold / cream`, así el panel admin hereda todo sin tocarlo.
  Las clases `blue-*`/`indigo-*` que quedaban en admin se renderizan en la gama carbón.
  Radios más rectos, sombras suaves, escala de opacidad ampliada (`/8`, `/12`…; antes no se generaban).
- `globals.css`: botones rectos en versalitas (`btn-primary`, `btn-outline`, `btn-light`, `link-line`),
  `eyebrow`, `shell`, sistema de revelado al hacer scroll (`data-reveal`), tema del calendario.
- Tipografía: Gilda Display (titulares) + Jost (texto). Sin negritas falsas.

## Movimiento
- Hero con cortina de entrada, titular que sube línea a línea, parallax y zoom lento (framer-motion).
- Revelado al hacer scroll con un único IntersectionObserver (`RevealObserver`); sin JS todo queda visible.
- Índice de destinos con foto que sigue al cursor; fotos que aparecen suaves al cargar.
- Header transparente sobre la foto, sólido al bajar y que se esconde/aparece según el scroll.
- Transición suave entre páginas (`app/template.tsx`). Todo respeta `prefers-reduced-motion`.

## Páginas
- **Inicio**: hero inmersivo + barra de reserva anclada, introducción con cifras reales del catálogo,
  colección en dos columnas escalonadas, pilares (mesa, descanso, encuentro), índice de destinos
  agrupado por país, "¿Por qué reservar directo?" y cierre con foto.
- **Hotel**: hero con hora local real (zona horaria del hotel), sub-navegación fija, comodidades con
  íconos de línea, galería en mosaico, habitaciones en filas editoriales alternadas, políticas,
  barra de reserva fija en móvil.
- **Buscar**: encabezado editorial, chips de filtro, orden en texto, resumen de noches/huéspedes.
- **Disponibilidad**: habitación elegida fija al costado + lista de habitaciones + calendario.
- **Reserva**: pasos a la izquierda y resumen de la estancia (fechas, noches, total) fijo a la derecha.
- **Mis reservas, Entrar, Crear cuenta**: mismos códigos visuales; panel fotográfico en las de cuenta.
- **Footer** nuevo con destinos reales del catálogo.

## Correcciones de UX que venían del código anterior
- El calendario perdía todos sus estilos (`classNames.root` pisaba `rdp-root`): días amontonados.
- El nombre de la habitación elegida en Disponibilidad era blanco sobre blanco.
- Se quitaron datos inventados: calificaciones pseudo-aleatorias, "★ 4.8 · Selección Exclusiva",
  "10K+ huéspedes", "4.8★", y el "Cancelación flexible" fijo en cada habitación.
- Emojis reemplazados por íconos de línea; etiquetas de comodidades en español.
- Selector de huéspedes con +/–; al elegir llegada se abre la salida; se muestra la cantidad de noches.
- Los desplegables se abren hacia arriba si no entran debajo.

## Fotografía
`src/lib/imagery.ts` elige fotos de respaldo (Unsplash) cuando un hotel o habitación no tiene
`image_url`. Reemplazar por fotografía propia cuando exista. Las frases por ciudad están en
`src/lib/destinations.ts`.

## Verificado
`tsc` sin errores, `next build` OK, 52/52 tests de Jest. Revisado en escritorio y móvil, claro y oscuro.
