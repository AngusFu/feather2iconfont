const fs = require('fs')
const path = require('path')
const { exec, execSync } = require('child_process')
const mkdirp = require('mkdirp')

const sourceDir = './node_modules/feather-icons/dist/icons/'
runTasks().catch(e => console.log(e));

async function runTasks () {
  const icons = fs.readdirSync(sourceDir)

  mkdirp('svg')
  writeHTML(icons)

  const tasks = Array.from(icons)
    .map(file =>
      process(path.join(sourceDir, file), file)
    )

  while (tasks.length > 200) {
    await tasks.shift()()
  }

  execSync('npm run svgo')
}

function process (file, basename) {
  const convertpath = require('convertpath')
  const { DOMParser, XMLSerializer } = require("xmldom")

  const parser = new DOMParser()
  const serializer = new XMLSerializer()

  convertpath.parse(file)

  const Document = parser.parseFromString(
    convertpath.toSimpleSvg(),
    'application/xml'
  )

  const Svg = Document.documentElement

  Svg.setAttribute("viewBox", "0 0 24 24")
  Svg.setAttribute("enable-background", "new 0 0 24 24")
  Svg.setAttribute('fill', '#fff')

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

  return function () {
    inkscapeEdit(file, basename)
  }
}


function inkscapeEdit (file, basename) {
  // SEE:
  // 1. https://github.com/mtgibbs/inkscape-stroke-to-path/
  // 2. http://scruss.com/blog/2016/05/11/scripting-inkscape-kinda/
  const command = `
    inkscape
      --file ./svg/${basename}
      --verb EditSelectAll
      --verb StrokeToPath
      --verb FileSave
      --verb FileClose
      --verb FileQuit
    `
    .replace(/\n\s*/g, ' ')
    .trim()

  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`error: ${error}`)
        resolve(error)
      } else {
        console.log(`file: ${basename}`)
        resolve(basename)
      }
    })
  })
}

function writeHTML (files) {
  const content = `<table>
  <tr><th>original</th<th>converted</th></tr>${
    files.reduce((acc, name) =>
      `${acc}
      <tr>
        <td><img src="${path.join(sourceDir, name)}"></td>
        <td><img src="svg/${name}"></td>
      </tr>`
    )
  }</table>`
  fs.writeFileSync('./compare.html', content)
}