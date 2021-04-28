const path = require('path')
const formatDate = require('date-fns/format')
const { v4: uuid } = require('uuid')
const dontpad = require('dontpad-api')
const zlib = require('zlib')

const DB_ROOT = process.env.DB_ROOT || 'db'

const readDir = async (path) => {
  const content = await dontpad.readContent(path)
  if (!content) return []
  return content.split('\n')
}

const indexPartition = async (base, partition, dbRoot = DB_ROOT) => {
  const basePath = path.join(dbRoot, base)
  const basePartition = await readDir(basePath)
  if (!basePartition.includes(partition)) {
    await dontpad.writeContent(basePath, [...basePartition, partition].join('\n'))
  }
  return path.join(base, partition)
}

const indexDocument = async (partition, id, dbRoot = DB_ROOT) => {
  const basePath = path.join(dbRoot, partition)
  const basePartition = await readDir(basePath)
  if (!basePartition.includes(id)) {
    await dontpad.writeContent(basePath, [...basePartition, id].join('\n'))
  }
  return path.join(partition, id)
}

const getCurrentPartition = async (dbRoot = DB_ROOT) => {
  const [day, month, year, hour] = formatDate(new Date(), 'dd-MM-yyyy-hh').split('-')
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
  const months = await readDir(path.join(dbRoot, randomYear))
  const randomMonth = months[randomIntFromInterval(0, months.length - 1)]
  const days = await readDir(path.join(dbRoot, randomYear, randomMonth))
  const randomDay = days[randomIntFromInterval(0, days.length - 1)]
  const hours = await readDir(path.join(dbRoot, randomYear, randomMonth, randomDay))
  const randomHour = hours[randomIntFromInterval(0, hours.length - 1)]
  return `${randomYear}/${randomMonth}/${randomDay}/${randomHour}`
}

const getRandomDocument = async (partition, dbRoot = DB_ROOT) => {
  const documents = await readDir(path.join(dbRoot, partition))
  return documents[randomIntFromInterval(0, documents.length - 1)]
}

const randomQueue = []

const warmup = async (self, dbRoot) => {
  for (; randomQueue.length < 20;) {
    const partition = await getRandomPartition(dbRoot)
    const document = await getRandomDocument(partition, dbRoot)
    if (!document) continue
    const candidate = await readJson(path.join(dbRoot, `${partition}/${document}`))
    if (!candidate) continue
    randomQueue.push(candidate)
  }
}

module.exports = {
  async getRandom(dbRoot = DB_ROOT) {
    const winner = randomQueue.reduce((winner, candidate) => {
      if (!winner || candidate.weight > winner.weight) return candidate
      return winner
    }, undefined)
    const winnerIndex = randomQueue.findIndex((item) => item.__id === winner.__id)
    randomQueue.splice(winnerIndex, 1)
    warmup(this, dbRoot)
    return winner
  },
  async count(dbRoot = DB_ROOT) {
    let total = 0
    const years = await readDir(path.join(dbRoot))
    for (const year of years) {
      const months = await readDir(path.join(dbRoot, year))
      for (const month of months) {
        const days = await readDir(path.join(dbRoot, year, month))
        for (const day of days) {
          const hours = await readDir(path.join(dbRoot, year, month, day))
          for (const hour of hours) {
            const documents = await readDir(path.join(dbRoot, year, month, day, hour))
            total += documents.length
          }
        }
      }
    }
    return total
  },
  async get(id, dbRoot = DB_ROOT) {
    const [partition, uid] = id.split('-§§-')
    const filePath = path.join(dbRoot, partition, uid)
    return readJson(filePath)
  },
  async set(object, dbRoot = DB_ROOT) {
    const partition = await getCurrentPartition(dbRoot)
    const uid = uuid()
    const documentPath = path.join(dbRoot, partition, uid)
    await writeJson(documentPath, {
      __id: `${partition}-§§-${uid}`,
      ...object,
    })
    await indexDocument(partition, uid, dbRoot)
  },
  async update(partition, id, object, dbRoot = DB_ROOT) {
    const documentPath = path.join(dbRoot, partition, id)
    await writeJson(documentPath, {
      __id: `${partition}-§§-${id}`,
      ...object,
    })
    await indexDocument(partition, id, dbRoot)
  },
}
