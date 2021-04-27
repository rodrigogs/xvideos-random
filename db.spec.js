const db = require('./db')

describe('foo', () => {
  it('bat', async () => {
    await db.set('1', { n: 1 })
    await db.set('2', { n: 2 })
    await db.set('3', { n: 3 })
    const random = await db.getRandom()
    console.log(random)
  })
})
