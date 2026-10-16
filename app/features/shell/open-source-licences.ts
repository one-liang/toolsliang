import { backgroundRemovalCandidates, backgroundRemovalRuntime } from '../tools/image-background-remover/domain/reference'
import { portraitMattingModel } from '../tools/image-background-remover/domain/model'
import { pdfEngineCandidates } from '../tools/pdf-signature/domain/reference'
import { supportedLocales, type LocaleCode, type LocalizedCopy } from '../tools/catalog'

/**
 * Third-party code and models a tool ships to the visitor's device, credited
 * the way their licences ask. They used to sit under a tool's "sources", but a
 * library is how a tool works, not where its answer comes from (#82), so they
 * live on one page of their own. Name, version and licence are read back from
 * the decision records that selected them, so a dependency bump that skips the
 * record cannot leave this page crediting the wrong release.
 */
export interface OpenSourceComponent {
  id: string
  name: string
  version: string
  /** What it does for the visitor, in plain words. */
  role: LocalizedCopy
  licence: string
  licenceUrl: string
  /** The notice the licence asks to keep, as the shipped files print it. */
  notice?: string
  projectUrl: string
  /** Slugs of the tools that ship it. */
  tools: string[]
}

const licenceNames: Record<string, string> = {
  'Apache-2.0': 'Apache License 2.0',
  'MIT': 'MIT License',
}

function pdfEngine(id: string) {
  const engine = pdfEngineCandidates.find(candidate => candidate.id === id)
  if (!engine?.licenceVerified) throw new Error(`open-source licences: ${id} is not a verified PDF engine`)

  return engine
}

const pdfReader = pdfEngine('pdfjs-dist')
const pdfWriter = pdfEngine('cantoo-pdf-lib')
const portraitModel = backgroundRemovalCandidates.find(candidate => candidate.id === portraitMattingModel.candidateId)
if (!portraitModel) throw new Error('open-source licences: the shipped portrait model is not in the record')

export const openSourceComponents: OpenSourceComponent[] = [
  {
    id: 'pdfjs',
    name: 'PDF.js',
    version: pdfReader.version,
    role: {
      'zh-tw': '讀取 PDF、解開有密碼的檔案，並畫出頁面預覽。',
      en: 'Reads the PDF, opens a password-protected file, and draws the page previews.',
    },
    licence: pdfReader.licence,
    licenceUrl: pdfReader.licenceUrl,
    notice: 'Copyright 2024 Mozilla Foundation',
    projectUrl: pdfReader.repository,
    tools: ['pdf-signature'],
  },
  {
    id: 'pdf-lib',
    name: 'pdf-lib',
    version: pdfWriter.version,
    role: {
      'zh-tw': '把簽名寫進 PDF，產生可以下載的新檔。',
      en: 'Writes the signature into the PDF and produces the file you download.',
    },
    licence: pdfWriter.licence,
    licenceUrl: pdfWriter.licenceUrl,
    notice: 'Copyright (c) 2019 Andrew Dillon',
    projectUrl: pdfWriter.repository,
    tools: ['pdf-signature'],
  },
  {
    id: 'onnxruntime-web',
    name: 'ONNX Runtime Web',
    version: backgroundRemovalRuntime.version,
    role: {
      'zh-tw': '在你的瀏覽器裡執行去背模型。',
      en: 'Runs the background removal model inside your browser.',
    },
    licence: backgroundRemovalRuntime.licence,
    licenceUrl: 'https://github.com/microsoft/onnxruntime/blob/main/LICENSE',
    notice: 'Copyright (c) Microsoft Corporation. All rights reserved.',
    projectUrl: 'https://github.com/microsoft/onnxruntime',
    tools: ['image-background-remover', 'product-image-workbench'],
  },
  {
    id: 'modnet',
    name: 'MODNet',
    version: portraitModel.revision.slice(0, 7),
    role: {
      'zh-tw': '把照片裡的人物和背景分開的模型。',
      en: 'The model that separates a person from the background.',
    },
    licence: portraitModel.licence,
    licenceUrl: portraitModel.licenceUrl,
    projectUrl: 'https://github.com/ZHKKKe/MODNet',
    tools: ['image-background-remover', 'product-image-workbench'],
  },
]

export function licenceName(licence: string) {
  return licenceNames[licence] ?? licence
}

/** What a tool page links to the licences page for; empty when it ships nothing that needs credit. */
export function openSourceComponentsFor(slug: string) {
  return openSourceComponents.filter(component => component.tools.includes(slug))
}

/** Prerendered in both locales. It credits code rather than answering a search, so it is not indexed. */
export function openSourceLicenceRoutes(): string[] {
  return supportedLocales.map(locale => `/${locale}/licenses/`)
}

export function openSourceLicenceCopy(locale: LocaleCode) {
  return locale === 'en'
    ? {
        title: 'Open-source licences',
        intro: 'Some tools use code or models that others have published as open source while they work on your device. This page credits them as their licences ask.',
        usedBy: 'Used by',
        version: 'Version',
        licence: 'Licence',
        project: 'Project page',
      }
    : {
        title: '開放原始碼授權',
        intro: '有些工具在你的裝置上處理內容時，會用到別人以開放原始碼公開的程式或模型。這一頁依照它們的授權條款標示出來。',
        usedBy: '用在',
        version: '版本',
        licence: '授權',
        project: '專案網址',
      }
}
