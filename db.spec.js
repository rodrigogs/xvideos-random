const db = require('./db')

describe('foo', () => {
  it('bat', async () => {
    await db.set({ n: 1 })
    await db.set({ n: 2 })
    await db.set({ n: 3 })
    const random = await db.getRandom()
    console.log(random)
  }, 300000)
})
