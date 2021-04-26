const fs = require('fs')
const path = require('path')
const Koa = require('koa')
const Router = require('koa-router')
const send = require('koa-send')
const xvideos = require('@rodrigogs/xvideos')
const downloadImage = require('./download-image')

const app = new Koa()
const router = new Router()

const randomIntFromInterval = (min, max) => Math.floor(Math.random() * (max - min + 1) + min)

const getRandomVideo = async () => {
  const randomNumber = randomIntFromInterval(0, 5000)
  const freshVideos = await xvideos.videos.fresh({ page: randomNumber })
  const randomVideoIndex = randomIntFromInterval(0, freshVideos.videos.length - 1)
  const detail = await xvideos.videos.details(freshVideos.videos[randomVideoIndex])
  const fileKey = `${randomNumber}_${randomVideoIndex}`
  return { fileKey, ...detail }
}

router.get('/image', async (ctx) => {
  const randomVideo = await getRandomVideo()
  const fileName = `${randomVideo.fileKey}.jpg`
  await downloadImage(randomVideo.image, fileName)
  await send(ctx, fileName)
  await fs.promises.unlink(fileName)
})

router.get('/video', async (ctx) => {
  const randomVideo = await getRandomVideo()
  ctx.redirect(randomVideo.files.high)
})

app
  .use(router.routes())
  .use(router.allowedMethods())

app.listen(5200)
