const path = require('path')
const fs = require('fs-extra')
const formatDate = require('date-fns/format')
const { v4: uuid } = require('uuid')

const ensurePartition = (partition) => fs.ensureDirSync(partition)

const getCurrentPartition = async (seed = 'db') => {
  const currentHour = formatDate(new Date(), 'dd-MM-yyyy-hh')
  const [day, month, year, hour] = currentHour.split('-')
  const partition = `year=${year}/month=${month}/day=${day}/hour=${hour}`
  await ensurePartition(path.resolve(__dirname, seed, partition))
  return partition
}

const randomIntFromInterval = (min, max) => Math.floor(Math.random() * (max - min + 1) + min)

const getRandomPartition = async (seed = 'db') => {
  const years = await fs.readdir(path.resolve(__dirname, seed))
  const randomYear = years[randomIntFromInterval(0, years.length - 1)]
  const months = await fs.readdir(path.resolve(__dirname, seed, randomYear))
  const randomMonth = months[randomIntFromInterval(0, months.length - 1)]
  const days = await fs.readdir(path.resolve(__dirname, seed, randomYear, randomMonth))
  const randomDay = days[randomIntFromInterval(0, days.length - 1)]
  const hours = await fs.readdir(path.resolve(__dirname, seed, randomYear, randomMonth, randomDay))
  const randomHour = hours[randomIntFromInterval(0, hours.length - 1)]
  return `${randomYear}/${randomMonth}/${randomDay}/${randomHour}`
}

const getRandomDocument = async (partition, seed = 'db') => {
  const documents = await fs.readdir(path.resolve(__dirname, seed, partition))
  return documents[randomIntFromInterval(0, documents.length - 1)]
}

module.exports = {
  async getRandom(seed = 'db') {
    const candidates = []
    for (let i = 0; i < 5; i++) {
      const partition = await getRandomPartition(seed)
      const document = await getRandomDocument(partition, seed)
      const candidate = await fs.readJson(path.resolve(__dirname, seed, `${partition}/${document}`))
      candidates.push(candidate)
    }
    const initial = candidates.pop()
    return candidates.reduce((winner, candidate) => {
      if (candidate.weight > winner.weight) return candidate
      return winner
    }, initial)
  },
  async count(seed = 'db') {
    let total = 0
    const years = await fs.readdir(path.resolve(__dirname, seed))
    for (const year of years) {
      const months = await fs.readdir(path.resolve(__dirname, seed, year))
      for (const month of months) {
        const days = await fs.readdir(path.resolve(__dirname, seed, year, month))
        for (const day of days) {
          const hours = await fs.readdir(path.resolve(__dirname, seed, year, month, day))
          for (const hour of hours) {
            const documents = await fs.readdir(path.resolve(__dirname, seed, year, month, day, hour))
            total += documents.length
          }
        }
      }
    }
    return total
  },
  async get(id, seed = 'db') {
    const [partition, uid] = id.split('-§§-')
    const filePath = path.resolve(__dirname, seed, partition, uid)
    if (await fs.pathExists(filePath)) return fs.readJson(filePath)
    return undefined
  },
  async set(object, seed = 'db') {
    const partition = await getCurrentPartition(seed)
    const uid = uuid()
    const documentPath = path.resolve(__dirname, seed, partition, uid)
    await fs.writeJson(documentPath, {
      __id: `${partition}-§§-${uid}`,
      ...object,
    })
  },
  async update(partition, id, object, seed = 'db') {
    const documentPath = path.resolve(__dirname, seed, partition, id)
    await fs.writeJson(documentPath, {
      __id: `${partition}-§§-${id}`,
      ...object,
    })
  },
}
