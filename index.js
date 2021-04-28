const path = require('path')
const Koa = require('koa')
const bodyParser = require('koa-bodyparser')
const Router = require('koa-router')
const Pug = require('koa-pug')
const metrify = require('./metrify')
const db = require('./db')

require('./cache')

const app = new Koa()
const pug = new Pug({
  viewPath: path.resolve(__dirname, './views'),
  app,
})
pug.use(app)
const router = new Router()

router.get('/', async (ctx) => {
  await db.warmup('db', 1)
  await ctx.render('index', {
    videoIndexCount: await db.count(),
    requestsCount: await db.count('db/requests'),
  }, true)
})

router.get('/image', async (ctx, next) => {
  const randomVideo = await db.getRandom()
  await ctx.render('image', {
    videoTitle: randomVideo.title,
    posterImage: randomVideo.image,
  }, true)
})

router.get('/video', async (ctx, next) => {
  const randomVideo = await db.getRandom()
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
  await db.update(partition, uid, { video, weight })
  ctx.status = 201
})

router.post('/dislike', async (ctx) => {
  const { id } = ctx.request.body
  const video = await db.get(id)
  if (!video) throw new Error('Not found')
  const [partition, uid] = id.split('-§§-')
  const weight = (isNaN(video.weight) ? 0 : video.weight) - 1
  await db.update(partition, uid, { video, weight })
  ctx.status = 201
})

app
  .use(metrify())
  .use(bodyParser())
  .use(router.routes())
  .use(router.allowedMethods())

app.listen(process.env.PORT || 5200)
