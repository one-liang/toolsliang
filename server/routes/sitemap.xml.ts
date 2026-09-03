import { renderToolSitemap } from '../../app/features/tools/sitemap'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return renderToolSitemap('https://toolsliang.com')
})
