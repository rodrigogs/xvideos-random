const db = require('./db')

module.exports = () => async (ctx, next) => {
  const requestInfo = {
    origin: JSON.stringify(ctx.request.origin),
    headers: JSON.stringify(ctx.request.headers),
    method: JSON.stringify(ctx.request.method),
    url: JSON.stringify(ctx.request.url),
    originalUrl: JSON.stringify(ctx.request.originalUrl),
    href: JSON.stringify(ctx.request.href),
    path: JSON.stringify(ctx.request.path),
    querystring: JSON.stringify(ctx.request.querystring),
    search: JSON.stringify(ctx.request.search),
    host: JSON.stringify(ctx.request.host),
    hostname: JSON.stringify(ctx.request.hostname),
    type: JSON.stringify(ctx.request.type),
    ip: JSON.stringify(ctx.request.ip),
    ips: JSON.stringify(ctx.request.ips),
  }
  const requestId = uuid()
  await db.set(requestId, requestInfo)
  try {
    await next()
  } catch (err) {
    await db.set(requestId, { ...requestInfo, failed: err.message })
  }
}
