const path = require('path')
const Koa = require('koa')
const bodyParser = require('koa-bodyparser')
const Router = require('koa-router')
const Pug = require('koa-pug')
const metrify = require('./metrify')
const db = require('./db')

require('./cache')

db.warmup()

const app = new Koa()
const pug = new Pug({
  viewPath: path.resolve(__dirname, './views'),
  app,
})
pug.use(app)
const router = new Router()

router.get('/', async (ctx) => {
  const summary = await db.getSummary()
  const candidates = await Promise.all((await db.getCandidates()).map((candidate) => {
    return db.get(candidate.id)
  }))
  candidates.sort(() => Math.random() - 0.5)
  await ctx.render('index', { summary, videos: candidates }, true)
})

router.get('/image', async (ctx) => {
  const randomVideo = await db.getRandom()
  await ctx.render('image', {
    videoTitle: randomVideo.title,
    posterImage: randomVideo.image,
  }, true)
})

router.get('/video', async (ctx) => {
  let randomVideo = await db.getRandom()
  if (randomVideo.video) { //FIXME remover um dia
    const [partition, uid] = randomVideo.__id.split('-§§-')
    await db.update(partition, uid, { ...randomVideo, ...randomVideo.video, video: undefined })
    randomVideo = await db.get(uid)
  }
  await ctx.render('video', {
    videoTitle: randomVideo.title,
    posterImage: randomVideo.image,
    videoUrl: randomVideo.files.high,
    videoId: randomVideo.__id,
  }, true)
})

router.post('/like', async (ctx) => {
  const { id } = ctx.request.body
  const video = await db.get(id)
  if (!video) throw new Error('Not found')
  const [partition, uid] = id.split('-§§-')
  const weight = (isNaN(video.weight) ? 0 : video.weight) + 1
  await db.update(partition, uid, { ...video, weight })
  ctx.status = 201
})

router.post('/dislike', async (ctx) => {
  const { id } = ctx.request.body
  const video = await db.get(id)
  if (!video) throw new Error('Not found')
  const [partition, uid] = id.split('-§§-')
  const weight = (isNaN(video.weight) ? 0 : video.weight) - 1
  await db.update(partition, uid, { ...video, weight })
  ctx.status = 201
})

app
  .use(metrify())
  .use(bodyParser())
  .use(router.routes())
  .use(router.allowedMethods())

app.listen(process.env.PORT || 5200)
