const axios = require('axios')
const fs = require('fs')

async function downloadImage (url, path) {  
  const writer = fs.createWriteStream(path)

  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  })

  response.data.pipe(writer)

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve)
    writer.on('error', reject)
  })
}

module.exports = (url, path) => downloadImage(url, path)
