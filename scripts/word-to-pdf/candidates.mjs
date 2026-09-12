/**
 * What T26 measured for DOCX to PDF in the browser, and what it ruled out first.
 *
 * A library is pinned to one published version and to the integrity string the
 * registry serves for that version's tarball, so a later republish cannot
 * change what the record describes. `files` names exactly the artefacts the
 * harness loads; the evaluation records their SHA-256 as it extracts them.
 *
 * The unit that gets measured is a *pipeline*, not a library. Nothing on npm
 * reads a DOCX and writes a PDF on its own, so every candidate here is a chain:
 * something parses the package, something decides where the text goes, and
 * something produces the file. Where the chain breaks is the finding.
 */

/**
 * Licences this project may redistribute from its own bundle. BSD-2-Clause is
 * added to the T24 list (ADR-0001, specification §14): it is the same
 * attribution-only shape as BSD-3-Clause with the non-endorsement clause
 * dropped, and nothing about it stops the file being served from our origin.
 */
export const permittedLicences = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause']

export const libraries = [
  {
    id: 'jszip',
    package: 'jszip',
    version: '3.10.1',
    publishedAt: '2022-08-02',
    stages: ['unzip'],
    /*
     * Dual licensed: the package offers MIT or GPL-3.0-or-later and lets the
     * user pick. This project takes the MIT option, which is what makes it
     * redistributable here; the GPL option is never exercised and the choice
     * has to stay written down, because a bare "(MIT OR GPL-3.0-or-later)" in a
     * manifest is not by itself a statement of which one we are relying on.
     */
    licence: 'MIT',
    licenceDeclared: '(MIT OR GPL-3.0-or-later)',
    licenceVerified: true,
    licenceUrl: 'https://github.com/Stuk/jszip/blob/main/LICENSE.markdown',
    repository: 'https://github.com/Stuk/jszip',
    integrity: 'sha512-xXDvecyTpGLrqFrvkrUSoxxfJI5AH7U8zxxtVclpsUtMCq4JQ290LY8AW5c7Ggnr/Y/oK+bQMbqK2qmtk3pN4g==',
    global: 'JSZip',
    files: { script: 'package/dist/jszip.min.js' },
  },
  {
    id: 'docx-preview',
    package: 'docx-preview',
    version: '0.4.0',
    publishedAt: '2026-07-07',
    stages: ['parse', 'layout', 'paginate'],
    licence: 'Apache-2.0',
    licenceDeclared: 'Apache-2.0',
    licenceVerified: true,
    licenceUrl: 'https://github.com/VolodymyrBaydalka/docxjs/blob/master/LICENSE',
    repository: 'https://github.com/VolodymyrBaydalka/docxjs',
    integrity: 'sha512-OdKtE/uj3M4RfGarLkGjahUzRg8/kBp0Sraj1r1NAY1tp/sTpHOBqDrzVf9onMBt9vxP6SdQ6bpLCUCsFwjgcA==',
    global: 'docx',
    files: { script: 'package/dist/docx-preview.min.js' },
  },
  {
    id: 'mammoth',
    package: 'mammoth',
    version: '1.12.3',
    publishedAt: '2026-09-12',
    stages: ['parse'],
    licence: 'BSD-2-Clause',
    licenceDeclared: 'BSD-2-Clause',
    licenceVerified: true,
    licenceUrl: 'https://github.com/mwilliamson/mammoth.js/blob/master/LICENSE',
    repository: 'https://github.com/mwilliamson/mammoth.js',
    integrity: 'sha512-kkv2MrSFk3f/w3uLsz4FG/91LdWp2j+qmp7AjG2v7w2xgX5YDxiaFlaWourXrXtyUR6335+9guyIlPBnhHLvKw==',
    global: 'mammoth',
    files: { script: 'package/mammoth.browser.min.js' },
  },
  {
    id: 'html2canvas',
    package: 'html2canvas',
    version: '1.4.1',
    publishedAt: '2022-01-22',
    stages: ['rasterise'],
    licence: 'MIT',
    licenceDeclared: 'MIT',
    licenceVerified: true,
    licenceUrl: 'https://github.com/niklasvh/html2canvas/blob/master/LICENSE',
    repository: 'https://github.com/niklasvh/html2canvas',
    integrity: 'sha512-fPU6BHNpsyIhr8yyMpTLLxAbkaK8ArIBcmZIRiBLiDhjeqvXolaEmDGmELFuX9I4xDcaKKcJl+TKZLqruBbmWA==',
    global: 'html2canvas',
    files: { script: 'package/dist/html2canvas.min.js' },
  },
  {
    id: 'jspdf',
    package: 'jspdf',
    version: '4.2.1',
    publishedAt: '2026-03-17',
    stages: ['write-pdf'],
    licence: 'MIT',
    licenceDeclared: 'MIT',
    licenceVerified: true,
    licenceUrl: 'https://github.com/parallax/jsPDF/blob/master/LICENSE',
    repository: 'https://github.com/parallax/jsPDF',
    integrity: 'sha512-YyAXyvnmjTbR4bHQRLzex3CuINCDlQnBqoSYyjJwTP2x9jDLuKDzy7aKUl0hgx3uhcl7xzg32agn5vlie6HIlQ==',
    global: 'jspdf',
    files: { script: 'package/dist/jspdf.umd.min.js' },
  },
  {
    id: 'pdfjs-dist',
    package: 'pdfjs-dist',
    version: '6.3.289',
    publishedAt: '2026-08-29',
    stages: ['read-pdf'],
    licence: 'Apache-2.0',
    licenceDeclared: 'Apache-2.0',
    licenceVerified: true,
    licenceUrl: 'https://github.com/mozilla/pdf.js/blob/master/LICENSE',
    repository: 'https://github.com/mozilla/pdf.js',
    integrity: 'sha512-ZHjSVpDa3D6izMq8/04lvkhkATUmL9px6ChPaXc1k6nU2Mrhlg1/7F0bdUqCwUjw3NsPTfPZsMDUU6ZIcRaeQw==',
    files: { module: 'package/build/pdf.min.mjs', worker: 'package/build/pdf.worker.min.mjs' },
  },
]

/**
 * The chains that were actually run. `dom` pipelines stop at the rendered
 * document, which is where fidelity can be inspected part by part; `pdf`
 * pipelines carry on to a file, which is the thing a user would download.
 *
 * Both `pdf` pipelines end in the same rasteriser, because it is the only
 * redistributable way measured to get browser layout into a PDF without asking
 * the user to drive the print dialogue. That is a finding, not a shortcut.
 *
 * `parser` names which library reads the document, so the harness never has to
 * infer it from the library list.
 */
export const pipelines = [
  {
    id: 'docx-preview',
    parser: 'docx-preview',
    output: 'dom',
    libraries: ['jszip', 'docx-preview'],
    stages: ['unzip', 'parse', 'layout', 'paginate'],
    note: 'The only measured candidate that models a page at all: it applies section properties and breaks the document into page boxes.',
  },
  {
    id: 'mammoth',
    parser: 'mammoth',
    output: 'dom',
    libraries: ['mammoth'],
    stages: ['unzip', 'parse'],
    note: 'Semantic conversion. It deliberately produces HTML with no page model, so it is measured for what survives, not for where it lands.',
  },
  {
    id: 'docx-preview-raster-pdf',
    parser: 'docx-preview',
    output: 'pdf',
    libraries: ['jszip', 'docx-preview', 'html2canvas', 'jspdf'],
    stages: ['unzip', 'parse', 'layout', 'paginate', 'rasterise', 'write-pdf'],
    note: 'The full chain a published tool would ship: lay the document out, photograph each page box, write the photographs into a PDF.',
  },
  {
    id: 'mammoth-raster-pdf',
    parser: 'mammoth',
    output: 'pdf',
    libraries: ['mammoth', 'html2canvas', 'jspdf'],
    stages: ['unzip', 'parse', 'rasterise', 'write-pdf'],
    note: 'The same ending on a document with no page model, so the pagination has to be invented by slicing a tall image.',
  },
]

/** The independent reader every produced PDF is opened with; never itself a candidate. */
export const verifierId = 'pdfjs-dist'

/**
 * Ruled out before any browser ran. A licence, a missing runtime or a server
 * dependency is cheaper to check than a measurement, and no number rescues a
 * candidate that fails one.
 */
export const exclusions = [
  {
    id: 'zetajs',
    package: 'zetajs',
    version: '1.2.0',
    reason: 'runtime-not-redistributed',
    detail: 'The npm package is a 61 KiB JavaScript binding with no WebAssembly in it. The LibreOffice build it drives is published separately by allotropia, is measured in hundreds of megabytes, and is LGPL-3.0/MPL-2.0 — a runtime this project cannot serve from its own origin under ADR-0001.',
    sourceUrl: 'https://www.npmjs.com/package/zetajs/v/1.2.0',
  },
  {
    id: 'pandoc-wasm',
    package: 'pandoc-wasm',
    version: '1.1.0',
    reason: 'copyleft-licence',
    detail: 'GPL-2.0-or-later. This site\'s source is not offered under the GPL, so the binary cannot be bundled.',
    sourceUrl: 'https://www.npmjs.com/package/pandoc-wasm/v/1.1.0',
  },
  {
    id: 'nativedocuments-docx-wasm',
    package: '@nativedocuments/docx-wasm',
    version: '2.2.13-1561490777',
    reason: 'proprietary-licence',
    detail: 'The package ships a "NATIVE DOCUMENTS SOFTWARE LICENSE AGREEMENT" and states that no right exists without a key issued by the vendor; its README requires an ND_DEV_ID and ND_DEV_SECRET pair. Last published in 2019.',
    sourceUrl: 'https://www.npmjs.com/package/@nativedocuments/docx-wasm/v/2.2.13-1561490777',
  },
  {
    id: 'onlyoffice-document-editor',
    package: '@onlyoffice/document-editor-react',
    version: '2.2.0',
    reason: 'requires-server',
    detail: 'Apache-2.0, but it is a client for ONLYOFFICE Document Server: the document is converted on the server. That is the boundary ADR-0001 forbids crossing.',
    sourceUrl: 'https://www.npmjs.com/package/@onlyoffice/document-editor-react/v/2.2.0',
  },
  {
    id: 'docx2pdf',
    package: 'docx2pdf',
    version: '0.0.4',
    reason: 'no-browser-build',
    detail: 'Depends on puppeteer-core and chrome-aws-lambda; it converts by driving a headless browser from Node, and has no browser entry point.',
    sourceUrl: 'https://www.npmjs.com/package/docx2pdf/v/0.0.4',
  },
  {
    id: 'js-preview-docx',
    package: '@js-preview/docx',
    version: '1.6.4',
    reason: 'wraps-a-candidate',
    detail: 'A viewer component around docx-preview. Measuring it would measure docx-preview twice and attribute the result to the wrapper.',
    sourceUrl: 'https://www.npmjs.com/package/@js-preview/docx/v/1.6.4',
  },
  {
    id: 'docx',
    package: 'docx',
    version: '9.7.1',
    reason: 'creation-only',
    detail: 'Writes new DOCX files. It cannot open the user\'s document, which is the whole input side of this tool.',
    sourceUrl: 'https://www.npmjs.com/package/docx/v/9.7.1',
  },
  {
    id: 'pdfmake',
    package: 'pdfmake',
    version: '0.3.11',
    reason: 'creation-only',
    detail: 'Builds a PDF from its own document definition. It has no DOCX input, so it could only ever be the last link of a chain whose missing link is the one that matters.',
    sourceUrl: 'https://www.npmjs.com/package/pdfmake/v/0.3.11',
  },
]
