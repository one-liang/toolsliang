import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LicencesPage from '@/pages/[locale]/licenses.vue'
import {
  licenceName,
  openSourceComponents,
  openSourceComponentsFor,
  openSourceLicenceRoutes,
} from '@/features/shell/open-source-licences'
import { getPublicPageRoutes, getTool, publishedTools, supportedLocales } from '@/features/tools/catalog'
import { setTestRoute } from './support/nuxt-stubs'

const packageManifest = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as { dependencies: Record<string, string> }

describe('open-source licences', () => {
  it('credits what the tools actually ship, at the versions they ship', () => {
    expect(openSourceComponents.find(component => component.id === 'pdfjs')!.version).toBe(packageManifest.dependencies['pdfjs-dist'])
    expect(openSourceComponents.find(component => component.id === 'pdf-lib')!.version).toBe(packageManifest.dependencies['@cantoo/pdf-lib'])
    expect(openSourceComponents.find(component => component.id === 'onnxruntime-web')!.version).toBe(packageManifest.dependencies['onnxruntime-web'])
  })

  it('names a licence, a project page and a plain role for every component, in both locales', () => {
    for (const component of openSourceComponents) {
      expect(['Apache License 2.0', 'MIT License']).toContain(licenceName(component.licence))
      expect(component.licenceUrl).toMatch(/^https:\/\//)
      expect(component.projectUrl).toMatch(/^https:\/\//)
      for (const locale of supportedLocales) expect(component.role[locale].trim()).not.toBe('')
      if (component.licence === 'MIT') expect(component.notice, `${component.id} 的 MIT 授權要求保留版權聲明`).toMatch(/Copyright/)
    }
  })

  it('points only at published tools, and every tool that ships one links to the page', () => {
    for (const component of openSourceComponents) {
      for (const slug of component.tools) expect(getTool(slug), slug).toBeDefined()
    }
    expect(publishedTools.filter(tool => openSourceComponentsFor(tool.slug).length).map(tool => tool.slug).sort())
      .toEqual(['image-background-remover', 'pdf-signature', 'product-image-workbench'])
  })

  it('is prerendered in both locales but kept out of the sitemap', () => {
    expect(openSourceLicenceRoutes()).toEqual(supportedLocales.map(locale => `/${locale}/licenses/`))
    for (const route of openSourceLicenceRoutes()) expect(getPublicPageRoutes()).not.toContain(route)
  })

  it.each(supportedLocales)('lists every component with its licence on the %s page', (locale) => {
    setTestRoute({ path: `/${locale}/licenses/`, params: { locale } })
    const page = mount(LicencesPage)

    expect(page.get('h1').text()).toBe(locale === 'en' ? 'Open-source licences' : '開放原始碼授權')
    expect(page.findAll('.licences-page__component')).toHaveLength(openSourceComponents.length)
    expect(page.get('#pdfjs').text()).toContain('Apache License 2.0')
    expect(page.get('#pdf-lib').text()).toContain('Copyright (c) 2019 Andrew Dillon')
    expect(page.get('#modnet').text()).toContain(locale === 'en' ? 'Portrait Background Remover' : '人像去背')
    page.unmount()
  })
})
