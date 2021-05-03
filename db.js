const formatDate = require('date-fns/format')
const { v4: uuid } = require('uuid')
const dontpad = require('dontpad-api')
const zlib = require('zlib')
const xvideos = require('@rodrigogs/xvideos')

const DB_ROOT = process.env.DB_ROOT || 'db'

const join = (...args) => args.join('/')

const readDir = async (path) => {
  const content = await dontpad.readContent(path)
  if (!content) return []
  return content.split('\n')
}

const indexPartition = async (base, partition, dbRoot = DB_ROOT) => {
  const basePath = join(dbRoot, base)
  const basePartition = await readDir(basePath)
  if (!basePartition.includes(partition)) {
    await dontpad.writeContent(basePath, [...basePartition, partition].join('\n'))
  }
  return join(base, partition)
}

const indexDocument = async (partition, id, dbRoot = DB_ROOT) => {
  const basePath = join(dbRoot, partition)
  const basePartition = await readDir(basePath)
  if (!basePartition.includes(id)) {
    await dontpad.writeContent(basePath, [...basePartition, id].join('\n'))
  }
  return join(partition, id)
}

const getCurrentPartition = async (dbRoot = DB_ROOT) => {
  const [day, month, year, hour] = formatDate(new Date(), 'dd-MM-yyyy-HH').split('-')
  let partition = ''
  partition = await indexPartition(partition, `year=${year}`, dbRoot)
  partition = await indexPartition(partition, `month=${month}`, dbRoot)
  partition = await indexPartition(partition, `day=${day}`, dbRoot)
  partition = await indexPartition(partition, `hour=${hour}`, dbRoot)
  return partition
}

const readJson = async (path) => {
  const content = await dontpad.readContent(path)
  try {
    const normalized = content.replace(/§/g, '\+').replace(/\[/g, '/')
    const inflated = zlib.inflateSync(Buffer.from(normalized, 'base64')).toString()
    return JSON.parse(inflated)
  } catch (err) {
    return undefined
  }
}

const writeJson = async (path, object) => {
  const string = JSON.stringify(object)
  const deflatedBase64 = await zlib.deflateSync(string).toString('base64')
  const normalized = deflatedBase64.replace(/\+/g, '§').replace(/\//g, '[')
  return dontpad.writeContent(path, normalized)
}

const randomIntFromInterval = (min, max) => Math.floor(Math.random() * (max - min + 1) + min)

const getRandomPartition = async (dbRoot = DB_ROOT) => {
  const years = await readDir(dbRoot)
  const randomYear = years[randomIntFromInterval(0, years.length - 1)]
  const months = await readDir(join(dbRoot, randomYear))
  const randomMonth = months[randomIntFromInterval(0, months.length - 1)]
  const days = await readDir(join(dbRoot, randomYear, randomMonth))
  const randomDay = days[randomIntFromInterval(0, days.length - 1)]
  const hours = await readDir(join(dbRoot, randomYear, randomMonth, randomDay))
  const randomHour = hours[randomIntFromInterval(0, hours.length - 1)]
  return `${randomYear}/${randomMonth}/${randomDay}/${randomHour}`
}

const getRandomDocument = async (partition, dbRoot = DB_ROOT) => {
  const documents = await readDir(join(dbRoot, partition))
  return documents[randomIntFromInterval(0, documents.length - 1)]
}

let warmingUp = false
const warmup = (self) => async (dbRoot = DB_ROOT, max = 10) => {
  if (warmingUp) return
  warmingUp = true
  const FIVE_MINUTES = 1000 * 60 * 5
  const candidates = (await readJson(join(dbRoot, 'candidates')) || []).filter((candidate) => {
    console.log('candidate', JSON.stringify(candidate))
    console.log('candidate.updatedAt + FIVE_MINUTES', candidate.updatedAt + FIVE_MINUTES)
    console.log('now', Date.now())
    if (!candidate.updatedAt) return false
    return candidate.updatedAt + FIVE_MINUTES > Date.now()
  })
  do {
    try {
      const partition = await getRandomPartition(dbRoot)
      const document = await getRandomDocument(partition, dbRoot)
      if (!document) continue
      let candidate = await readJson(join(dbRoot, `${partition}/${document}`))
      if (!candidate) continue
      if (candidates.includes(candidate)) continue
      candidate = await self.refresh(candidate.id)
      if (!candidate) continue
      candidates.push({ id: candidate.__id, updatedAt: Date.now() })
      candidates.sort(() => Math.random() - 0.5)
      await writeJson(join(dbRoot, 'candidates'), candidates)
      console.log(`${candidates.length} videos in line`)
    } catch (err) {
      console.error(err)
    }
  } while(candidates.length < max)
  warmingUp = false
}

module.exports = {
  warmup(dbRoot = DB_ROOT, max = 10) {
    return warmup(this)(dbRoot = DB_ROOT, max = 10)
  },
  async getRandom(dbRoot = DB_ROOT) {
    warmup(this)(dbRoot)
    const candidateIds = await readJson(join(dbRoot, 'candidates')) || []
    const candidates = await Promise.all(candidateIds.map(async (id) => {
      const [partition, uid] = id.split('-§§-')
      const filePath = join(dbRoot, partition, uid)
      return await readJson(filePath)
    }))
    const winner = candidates.reduce((winner, candidate) => {
      if (!winner || candidate.weight > winner.weight) return candidate
      return winner
    }, undefined)
    const winnerIndex = candidateIds.findIndex((id) => id === winner.__id)
    candidateIds.splice(winnerIndex, 1)
    await writeJson(join(dbRoot, 'candidates'), candidateIds)
    return winner
  },
  async count(dbRoot = DB_ROOT) {
    let total = 0
    const years = await readDir(join(dbRoot))
    for (const year of years) {
      const months = await readDir(join(dbRoot, year))
      for (const month of months) {
        const days = await readDir(join(dbRoot, year, month))
        for (const day of days) {
          const hours = await readDir(join(dbRoot, year, month, day))
          for (const hour of hours) {
            const documents = await readDir(join(dbRoot, year, month, day, hour))
            total += documents.length
          }
        }
      }
    }
    return total
  },
  async refresh(video, dbRoot = DB_ROOT) {
    try {
      const detail = await xvideos.videos.details({
        url: video.url,
        puppeteerConfig: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
          ],
        },
      })
      const [partition, uid] = video.__id.split('-§§-')
      const updatedVideo = { ...video, ...detail }
      await this.update(partition, uid, updatedVideo, dbRoot)
      return updatedVideo
    } catch (err) {
      return undefined
    }
  },
  async get(id, dbRoot = DB_ROOT) {
    const [partition, uid] = id.split('-§§-')
    const filePath = join(dbRoot, partition, uid)
    return readJson(filePath)
  },
  async set(object, dbRoot = DB_ROOT) {
    const partition = await getCurrentPartition(dbRoot)
    const uid = uuid()
    const documentPath = join(dbRoot, partition, uid)
    await writeJson(documentPath, {
      __id: `${partition}-§§-${uid}`,
      ...object,
    })
    await indexDocument(partition, uid, dbRoot)
  },
  async update(partition, id, object, dbRoot = DB_ROOT) {
    const documentPath = join(dbRoot, partition, id)
    await writeJson(documentPath, {
      __id: `${partition}-§§-${id}`,
      ...object,
    })
    await indexDocument(partition, id, dbRoot)
  },
}
