const path = require('path')
const fs = require('fs')
const Koa = require('koa')
const Router = require('koa-router')
const send = require('koa-send')
const Pug = require('koa-pug')
const xvideos = require('@rodrigogs/xvideos')
const { v4: uuid } = require('uuid')
const axios = require('axios')
const downloadImage = require('./download-image')
const db = require('./db')

const app = new Koa()
const pug = new Pug({
  viewPath: path.resolve(__dirname, './views'),
  app,
})
pug.use(app)
const router = new Router()

const randomIntFromInterval = (min, max) => Math.floor(Math.random() * (max - min + 1) + min)

const getRandomVideo = async () => {
  const randomNumber = randomIntFromInterval(0, 5000)
  const freshVideos = await xvideos.videos.fresh({ page: randomNumber })
  const randomVideoIndex = randomIntFromInterval(0, freshVideos.videos.length - 1)
  const detail = await xvideos.videos.details({
    url: freshVideos.videos[randomVideoIndex].url,
    puppeteerConfig: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    },
  })
  const fileKey = `${randomNumber}_${randomVideoIndex}`
  return { fileKey, ...detail }
}

const metrify = () => async (ctx, next) => {
  const requestInfo = {
    origin: ctx.request.origin,
    headers: ctx.request.headers,
    method: ctx.request.method,
    url: ctx.request.url,
    originalUrl: ctx.request.originalUrl,
    href: ctx.request.href,
    path: ctx.request.path,
    querystring: ctx.request.querystring,
    search: ctx.request.search,
    host: ctx.request.host,
    hostname: ctx.request.hostname,
    type: ctx.request.type,
    ip: ctx.request.ip,
    ips: ctx.request.ips,
  }
  const requestId = uuid()
  await db.set(requestId, requestInfo)
  try {
    await next()
  } catch (err) {
    await db.set(requestId, { ...requestInfo, failed: err.message })
  }
}

router.get('/image', async (ctx) => {
  const randomVideo = await getRandomVideo()
  const fileName = `${randomVideo.fileKey}.jpg`
  await downloadImage(randomVideo.image, fileName)
  try {
    await send(ctx, fileName)
  } finally {
    await fs.promises.unlink(fileName)
  }
})

router.get('/video', async (ctx) => {
  const randomVideo = await getRandomVideo()
  await ctx.render('video', {
    posterImage: randomVideo.image,
    videoUrl: randomVideo.files.high,
  }, true)
})

app
  .use(metrify())
  .use(router.routes())
  .use(router.allowedMethods())

app.listen(process.env.PORT || 5200)
