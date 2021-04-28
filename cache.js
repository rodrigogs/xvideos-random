const xvideos = require('@rodrigogs/xvideos')
const wait = require('./wait')
const db = require('./db')

const ONE_MINUTE = 1000 * 60

const randomIntFromInterval = (min, max) => Math.floor(Math.random() * (max - min + 1) + min)

const getRandomVideo = async () => {
  const randomPage = randomIntFromInterval(1, 19999)
  const freshVideos = await xvideos.videos.fresh({ page: randomPage })
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
  return { page: randomPage, videoIndex: randomVideoIndex, ...detail }
}

const incrementCache = async (times = 1) => {
  let i = 0
  do {
    const randomVideo = await getRandomVideo()
    console.log('Storing random video...')
    await db.set(randomVideo)
  } while (i < times)
}

;(async () => {
  let shuttingDown = false
  process.on('SIGTERM', () => shuttingDown = true)
  do {
    try {
      await incrementCache(3)
    } catch (err) {
      console.error(err)
    } finally {
      await wait(randomIntFromInterval(ONE_MINUTE, ONE_MINUTE * 60))
    }
  } while (!shuttingDown)
})()
