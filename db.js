const path = require('path')
const fs = require('fs-extra')
const formatDate = require('date-fns/format')
const { v4: uuid } = require('uuid')

const ensurePartition = (partition) => fs.ensureDirSync(partition)

const getCurrentPartition = async () => {
  const currentHour = formatDate(new Date(), 'dd-MM-yyyy-hh')
  const [day, month, year, hour] = currentHour.split('-')
  const partition = `year=${year}/month=${month}/day=${day}/hour=${hour}`
  await ensurePartition(path.resolve(__dirname, 'db', partition))
  return partition
}

const randomIntFromInterval = (min, max) => Math.floor(Math.random() * (max - min + 1) + min)

const getRandomPartition = async () => {
  const years = await fs.readdir(path.resolve(__dirname, 'db'))
  const randomYear = years[randomIntFromInterval(0, years.length - 1)]
  const months = await fs.readdir(path.resolve(__dirname, 'db', randomYear))
  const randomMonth = months[randomIntFromInterval(0, months.length - 1)]
  const days = await fs.readdir(path.resolve(__dirname, 'db', randomYear, randomMonth))
  const randomDay = days[randomIntFromInterval(0, days.length - 1)]
  const hours = await fs.readdir(path.resolve(__dirname, 'db', randomYear, randomMonth, randomDay))
  const randomHour = hours[randomIntFromInterval(0, hours.length - 1)]
  return `${randomYear}/${randomMonth}/${randomDay}/${randomHour}`
}

const getRandomDocument = async (partition) => {
  const documents = await fs.readdir(path.resolve(__dirname, 'db', partition))
  return documents[randomIntFromInterval(0, documents.length - 1)]
}

module.exports = {
  async getRandom() {
    const partition = await getRandomPartition()
    const document = await getRandomDocument(partition)
    return fs.readJson(path.resolve(__dirname, 'db', `${partition}/${document}`))
  },
  async get(id) {
    const [partition, uid] = id.split('-§§-')
    const filePath = path.resolve(__dirname, 'db', partition, uid)
    if (await fs.pathExists(filePath)) return fs.readJson(filePath)
    return undefined
  },
  async set(object) {
    const partition = await getCurrentPartition()
    const uid = uuid()
    const documentPath = path.resolve(__dirname, 'db', partition, uid)
    await fs.writeJson(documentPath, {
      ...object,
      __id: `${partition}-§§-${uid}`,
    })
  },
}
