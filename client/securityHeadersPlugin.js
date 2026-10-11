import policy from '../shared/securityPolicy.cjs'

export function securityHeadersPlugin(env, development) {
  const configure = server => {
    server.middlewares.use((req, res, next) => {
      const protocol = req.socket.encrypted ? 'https' : 'http'
      const documentOrigin = new URL(`${protocol}://${req.headers.host || 'localhost'}`).origin
      const headers = policy.createFrontendHeaders(env, { development, documentOrigin })
      for (const [name, value] of Object.entries(headers)) res.setHeader(name, value)
      next()
    })
  }
  return {
    name: 'cosmoscraft-security-headers',
    configureServer: configure,
    configurePreviewServer: configure,
    // Static HTML retains the tested baseline even when served outside Vite.
    // frame-ancestors and report-only policies require actual response headers.
    transformIndexHtml() {
      return [
        { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy.documentMetaBaseline }, injectTo: 'head-prepend' },
        { tag: 'meta', attrs: { name: 'referrer', content: policy.referrerPolicy }, injectTo: 'head-prepend' },
      ]
    },
  }
}
