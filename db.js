const dontpad = require('dontpad-api')
const { v4: uuid } = require('uuid')

const INDEX_ID = process.env.INDEX_ID

const serialize = (obj) => Object.keys(obj).reduce((serialized, key) => {
  const value = obj[key]
  return `${serialized}${key}:${value}\n`
}, '')

const deserialize = (str) => str.split('\n').reduce((obj, line) => {
  if (!line.length) return obj
  const [key, value] = line.split(':')
  return { ...obj, [key]: value }
}, {})

const readOrCreateIndex = async () => {
  const indexContent = await dontpad.readContent(process.env.INDEX_ID)
  if (!indexContent.length) {
    const initial = serialize({ version: 0 })
    await dontpad.writeContent(INDEX_ID, initial)
    return deserialize(initial)
  }
  return deserialize(indexContent)
}

module.exports = {
  async get(id) {
    const index = await readOrCreateIndex()
    return deserialize(dontpad.readContent(index[id]))
  },
  async set(id, value) {
    const index = await readOrCreateIndex()
    const ref = uuid()
    await dontpad.writeContent(ref, serialize(value))
    const updatedIndex = await readOrCreateIndex()
    if (index.version !== updatedIndex.version) {
      throw new Error('Conflict error. The index was updated.')
    }
    await dontpad.writeContent(INDEX_ID, serialize({
      ...updatedIndex,
      [id]: ref,
      version: Number(updatedIndex.version) + 1,
    }))
  },
}
