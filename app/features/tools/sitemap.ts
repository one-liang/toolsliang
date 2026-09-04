import { getPublicPageRoutes, getPublicToolRoutes } from '@/features/tools/catalog'

export function renderToolSitemap(baseUrl: string) {
  const origin = baseUrl.replace(/\/$/, '')
  const urls = [...getPublicPageRoutes(), ...getPublicToolRoutes()]
    .map(path => `  <url><loc>${origin}${path}</loc></url>`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}
