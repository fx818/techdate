import sharp from 'sharp'
import fs from 'fs'

fs.mkdirSync('resources', { recursive: true })

const cream = '#f4f2ea'
const clay = '#cc7a57'
const ink = '#2a2722'
const serif = "Georgia, 'Times New Roman', 'DejaVu Serif', serif"

function mark({ size, bg, glyph, dot, fontSize, text = 'A', withDot = true }) {
  const bgRect = bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''
  const period = withDot ? `<tspan fill="${dot}">.</tspan>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${bgRect}
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
      font-family="${serif}" font-weight="600" font-size="${fontSize}" fill="${glyph}">${text}${period}</text>
  </svg>`
}

const render = async (svg, out) => {
  await sharp(Buffer.from(svg)).png().toFile(`resources/${out}`)
  console.log('wrote resources/' + out)
}

// Adaptive icon foreground — clay "A." only (transparent), kept inside the safe zone
await render(mark({ size: 1024, bg: null, glyph: clay, dot: clay, fontSize: 430 }), 'icon-foreground.png')
// Adaptive icon background — solid cream
await render(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${cream}"/></svg>`, 'icon-background.png')
// Full-bleed icon (legacy / non-adaptive / iOS) — cream bg + clay "A."
await render(mark({ size: 1024, bg: cream, glyph: clay, dot: clay, fontSize: 560 }), 'icon-only.png')
// Native splash — cream bg + "Await." (ink word, clay period)
await render(mark({ size: 2732, bg: cream, glyph: ink, dot: clay, fontSize: 300, text: 'Await' }), 'splash.png')
await render(mark({ size: 2732, bg: cream, glyph: ink, dot: clay, fontSize: 300, text: 'Await' }), 'splash-dark.png')

// --- Notification small icon (white "A" silhouette on transparent) ---
// Android tints the status-bar icon using its alpha only, so it MUST be a
// solid white glyph on a transparent background. Written straight into the
// Android res tree at each density.
const white = '#ffffff'
const statSizes = [
  ['mdpi', 24],
  ['hdpi', 36],
  ['xhdpi', 48],
  ['xxhdpi', 72],
  ['xxxhdpi', 96],
]
const statDir = 'android/app/src/main/res'
for (const [dpi, px] of statSizes) {
  const svg = mark({ size: px, bg: null, glyph: white, dot: white, fontSize: Math.round(px * 0.78), withDot: false })
  const dir = `${statDir}/drawable-${dpi}`
  fs.mkdirSync(dir, { recursive: true })
  await sharp(Buffer.from(svg)).png().toFile(`${dir}/ic_stat_await.png`)
  console.log(`wrote ${dir}/ic_stat_await.png`)
}

console.log('done')
