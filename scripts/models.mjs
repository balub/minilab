import { access, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(scriptDir, '..')
const defaultMount = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  reference: 'front-center-bottom',
}

export function slugify(filename) {
  return filename
    .replace(/\.step$/i, '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function exists(file) {
  try {
    await access(file, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function buildCatalog({ sourceDir, overrides, hasConvertedModel }) {
  const filenames = (await readdir(sourceDir))
    .filter((filename) => /\.step$/i.test(filename))
    .sort((left, right) => left.localeCompare(right, 'en'))
  const sourceStats = await Promise.all(filenames.map((filename) => stat(path.join(sourceDir, filename))))
  const generatedAt = new Date(Math.max(...sourceStats.map((entry) => entry.mtimeMs))).toISOString()

  const modules = await Promise.all(
    filenames.map(async (source) => {
      const override = overrides.models?.[source] ?? {}
      const id = slugify(source)
      const converted = await hasConvertedModel(id)
      const heightU = Number.isInteger(override.heightU) && override.heightU > 0 ? override.heightU : null
      const role = override.role ?? 'module'
      const needsReview = role === 'module' && heightU === null
      return {
        id,
        name: override.name ?? source.replace(/\.step$/i, ''),
        source,
        role,
        heightU,
        ...(/laser[ _-]*cut/i.test(source) ? { manufacturingMethod: 'laser-cut' } : {}),
        model: converted ? `/models/${id}.glb` : null,
        status: needsReview ? 'needs-review' : converted ? 'ready' : 'not-converted',
        mount: { ...defaultMount, ...override.mount },
        ...(override.preview ? { preview: override.preview } : {}),
      }
    }),
  )

  return {
    generatedAt,
    rack: overrides.rack,
    modules,
  }
}

function run(command, args, { env = {}, input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: [input ? 'pipe' : 'inherit', 'inherit', 'inherit'],
      env: { ...process.env, ...env },
    })
    child.on('error', reject)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`))))
    if (input) child.stdin.end(input)
  })
}

async function findFreeCad() {
  const candidates = [
    process.env.FREECAD_CMD,
    'FreeCADCmd',
    'freecadcmd',
    '/Applications/FreeCAD.app/Contents/Resources/bin/FreeCADCmd',
    '/Applications/FreeCAD.app/Contents/MacOS/FreeCADCmd',
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (candidate.includes(path.sep)) {
      if (await exists(candidate)) return candidate
      continue
    }
    try {
      await run('/usr/bin/env', ['which', candidate])
      return candidate
    } catch {
      // Try the next supported command name.
    }
  }
  return null
}

async function needsConversion(source, target) {
  if (!(await exists(target))) return true
  const header = await readFile(target).then((buffer) => buffer.subarray(0, 4).toString('ascii'))
  if (header !== 'glTF') return true
  const [sourceStat, targetStat] = await Promise.all([stat(source), stat(target)])
  return sourceStat.mtimeMs > targetStat.mtimeMs
}

async function convertModel(freeCad, source, id, outputDir, workDir) {
  const objPath = path.join(workDir, `${id}.obj`)
  const targetPath = path.join(outputDir, `${id}.glb`)
  const temporaryTarget = path.join(outputDir, `.${id}.tmp.glb`)
  const converterScript = path.join(scriptDir, 'freecad', 'step-to-obj.py')
  await run(freeCad, ['--console'], {
    env: {
      MINILAB_STEP_SOURCE: source,
      MINILAB_OBJ_OUTPUT: objPath,
    },
    input: `exec(open(${JSON.stringify(converterScript)}).read())\nexit()\n`,
  })

  const { default: obj2gltf } = await import('obj2gltf')
  const glb = await obj2gltf(objPath, { binary: true })
  await writeFile(temporaryTarget, glb)

  const { NodeIO } = await import('@gltf-transform/core')
  const { dedup, prune, weld } = await import('@gltf-transform/functions')
  const io = new NodeIO()
  const document = await io.read(temporaryTarget)
  await document.transform(dedup(), weld(), prune())
  await io.write(temporaryTarget, document)
  await rename(temporaryTarget, targetPath)
  const staleSidecar = `${targetPath}.bin`
  if (await exists(staleSidecar)) await unlink(staleSidecar)
}

export async function generateModels({ strict = process.env.MINILAB_MODELS_STRICT === '1' } = {}) {
  const sourceDir = path.join(rootDir, 'models')
  const outputDir = path.join(rootDir, 'configurator', 'public', 'models')
  const workDir = path.join(outputDir, '.work')
  const overrides = JSON.parse(await readFile(path.join(sourceDir, 'modules.json'), 'utf8'))
  await mkdir(workDir, { recursive: true })

  const freeCad = await findFreeCad()
  if (!freeCad) {
    const message = 'FreeCADCmd was not found; refreshed metadata and kept procedural previews. Install FreeCAD or set FREECAD_CMD to generate GLBs.'
    if (strict) throw new Error(message)
    console.warn(message)
  } else {
    const sources = (await readdir(sourceDir)).filter((filename) => /\.step$/i.test(filename)).sort()
    for (const sourceName of sources) {
      const source = path.join(sourceDir, sourceName)
      const id = slugify(sourceName)
      const target = path.join(outputDir, `${id}.glb`)
      if (await needsConversion(source, target)) {
        console.log(`Converting ${sourceName}`)
        await convertModel(freeCad, source, id, outputDir, workDir)
      }
    }
  }

  const catalog = await buildCatalog({
    sourceDir,
    overrides,
    hasConvertedModel: (id) => exists(path.join(outputDir, `${id}.glb`)),
  })
  await writeFile(path.join(outputDir, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`)
  console.log(`Cataloged ${catalog.modules.length} STEP sources in ${path.relative(rootDir, outputDir)}`)
  return catalog
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  generateModels().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
