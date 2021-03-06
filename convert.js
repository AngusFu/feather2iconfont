const fs = require('fs')
const path = require('path')
const { exec, execSync } = require('child_process')
const mkdirp = require('mkdirp')

const { SVGPathData } = require('svg-pathdata')
const convertpath = require('convertpath')
const { DOMParser, XMLSerializer } = require('xmldom')
const parser = new DOMParser()
const serializer = new XMLSerializer()

const svg2ttf = require('svg2ttf')
const ttf2woff = require('ttf2woff')

const sourceDir = './node_modules/feather-icons/dist/icons/'

runTasks().catch(e => console.log(e))

async function runTasks () {
  const icons = fs.readdirSync(sourceDir)

  mkdirp('svg')

  const tasks = Array.from(icons)
    .map(file =>
      process(path.join(sourceDir, file), file)
    )

  // while (tasks.length) {
  //   await tasks.shift()()
  //   await sleep(6)
  // }

  writeHTML(icons)

  const glyphs = icons.map(basename => {
    const file = `./svg/${basename}`
    const Document = parseSVG(file)
    const SVG = Document.documentElement
    const children = Array.from(SVG.childNodes)

    const d = children.reduce((acc, path) => {
      if (path.tagName.toLowerCase() === 'path') {
        acc += ' ' + (path.getAttribute('d') || '').replace(/z$/, '')
      }

      SVG.removeChild(path)

      return acc
    }, '').trim()

    const glyphPath = new SVGPathData(d)
    glyphPath.scale(520 / 24)
    const name = basename.replace('.svg', '')
    return `<glyph unicode="${name}" glyph-name="${name.replace(/\d/g, '&#x3$&')}" d="${glyphPath.encode()}" />`
  })

  const template = fs.readFileSync('./template.xml').toString()
  const xml = template.replace('____PLACEHOLDER_____', glyphs.join('\n'))

  fs.writeFileSync('./dest/feather.svg', xml)

  const ttf = svg2ttf(xml, {
    ts: +new Date(),
    version: '1.0'
  }).buffer
  fs.writeFileSync('./dest/feather.ttf', Buffer.from(ttf))

  const woff = ttf2woff(new Uint8Array(ttf))
  fs.writeFileSync('./dest/feather.woff', Buffer.from(woff.buffer))
}

function process (file, basename) {
  const Document = parseSVG(file)
  const Svg = Document.documentElement

  Svg.setAttribute('viewBox', '0 0 24 24')
  Svg.setAttribute('enable-background', 'new 0 0 24 24')
  Svg.setAttribute('fill', 'rgba(0,0,0,0)')

  // merge all path elements
  const pathElem = Document.createElement('path')
  const attrs = ['stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']

  attrs.forEach(key => {
    pathElem.setAttribute(key, key === 'stroke' ? '#000' : Svg.getAttribute(key))
    Svg.removeAttribute(key)
  })

  const d = Array.from(Svg.childNodes)
    .map(node => {
      Svg.removeChild(node)
      return node.getAttribute('d')
    })
    .join(' ')

  pathElem.setAttribute('d', d)
  Svg.appendChild(pathElem)

  fs.writeFileSync(`./svg/${basename}`, serializer.serializeToString(Document))

  return _ => inkscapeEdit(basename)
}

function parseSVG (file) {
  convertpath.parse(file)
  return parser.parseFromString(
    convertpath.toSimpleSvg(),
    'application/xml'
  )
}

function inkscapeEdit (basename) {
  const file = `./svg/${basename}`
  // SEE:
  // 1. https://github.com/mtgibbs/inkscape-stroke-to-path/
  // 2. http://scruss.com/blog/2016/05/11/scripting-inkscape-kinda/
  const command = `
    inkscape
      --file ${file}
      --verb EditSelectAll
      --verb StrokeToPath
      --verb FileSave
      --verb FileClose
      --verb FileQuit
    `
    .replace(/\n\s*/g, ' ')
    .trim()

  return new Promise((resolve, reject) => {
    console.log(`>> Processing: ${basename}`)
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`>> Error: ${error}`)
        resolve(error)
      } else {
        console.log(`>> Processsing done: ${basename}`)
        execSync(`npm run svgo ${file}`)
        console.log(`>> Optimized by svgo: ${basename}`)
        resolve(basename)
      }
    })
  })
}

function writeHTML (files) {
  const content = `<table align="center" style="text-align: center;">
  <tr><th>original</th><th>converted</th></tr>${
    files.reduce((acc, name) =>
      `${acc}
      <tr>
        <td><img src="${path.join(sourceDir, name)}"></td>
        <td><img src="svg/${name}"></td>
      </tr>`
    , '')
  }</table>`
  fs.writeFileSync('./preview/compare.html', content)
  fs.writeFileSync(
    './preview/index.html',
    `<link rel=stylesheet href="./icon.css">` +
      files.map(n => `<i class="feather">${n.replace('.svg', '')}</i>`).join('<br>')
  )
}

function sleep (t) {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(), t * 1000)
  })
}
