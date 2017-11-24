const fs = require('fs')
const path = require('path')
const { exec, execSync } = require('child_process')
const mkdirp = require('mkdirp')

const sourceDir = './node_modules/feather-icons/dist/icons/'
runTasks().catch(e => console.log(e))

async function runTasks () {
  const icons = fs.readdirSync(sourceDir)

  mkdirp('svg')
  writeHTML(icons)

  const tasks = Array.from(icons)
    .map(file =>
      process(path.join(sourceDir, file), file)
    )

  while (tasks.length) {
    await tasks.shift()()
    await sleep(6)
  }
}

function process (file, basename) {
  const convertpath = require('convertpath')
  const { DOMParser, XMLSerializer } = require('xmldom')

  const parser = new DOMParser()
  const serializer = new XMLSerializer()

  convertpath.parse(file)

  const Document = parser.parseFromString(
    convertpath.toSimpleSvg(),
    'application/xml'
  )

  const Svg = Document.documentElement

  Svg.setAttribute('viewBox', '0 0 24 24')
  Svg.setAttribute('enable-background', 'new 0 0 24 24')
  Svg.setAttribute('fill', 'rgba(0,0,0,0)')

  const stroke = {}
  const attrs = ['stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']

  attrs.forEach(key => {
    stroke[key] = key === 'stroke' ? '#000' : Svg.getAttribute(key)
    Svg.removeAttribute(key)
  })

  Array.from(Svg.childNodes).forEach(node =>
    attrs.forEach(key => node.setAttribute(key, stroke[key]))
  )

  fs.writeFileSync(`./svg/${basename}`, serializer.serializeToString(Document))

  return _ => inkscapeEdit(basename)
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
  fs.writeFileSync('./compare.html', content)
}

function sleep (t) {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(), t * 1000)
  })
}
