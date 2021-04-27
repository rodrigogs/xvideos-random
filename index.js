const path = require('path')
const Koa = require('koa')
const Router = require('koa-router')
const Pug = require('koa-pug')
// const metrify = require('./metrify')
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
  await ctx.render('index', {}, true)
})

router.get('/image', async (ctx) => {
  const randomVideo = await db.getRandom()
  await ctx.render('image', {
    videoTitle: randomVideo.title,
    posterImage: randomVideo.image,
  }, true)
})

router.get('/video', async (ctx) => {
  const randomVideo = await db.getRandom()
  await ctx.render('video', {
    videoTitle: randomVideo.title,
    posterImage: randomVideo.image,
    videoUrl: randomVideo.files.high,
  }, true)
})

app
  // .use(metrify())
  .use(router.routes())
  .use(router.allowedMethods())

app.listen(process.env.PORT || 5200)
