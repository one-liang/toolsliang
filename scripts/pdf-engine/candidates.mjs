/**
 * The libraries T24 measured, and the ones it ruled out before measuring.
 *
 * A candidate is pinned to one published version and to the integrity string
 * the registry serves for that version's tarball, so a later republish cannot
 * change what was measured. `files` names the exact artefacts the harness
 * loads; the evaluation records their SHA-256 as it extracts them.
 */

/** Only these may end up in a shipped bundle, per ADR-0001 and the supply-chain rules in §14 of the specification. */
export const permittedLicences = ['MIT', 'Apache-2.0', 'BSD-3-Clause']

export const candidates = [
  {
    id: 'pdfjs-dist',
    package: 'pdfjs-dist',
    version: '6.3.289',
    publishedAt: '2026-08-29',
    /** What the library can do for a signature tool, in the terms the record uses. */
    roles: ['parse', 'preview', 'password'],
    licence: 'Apache-2.0',
    licenceVerified: true,
    licenceUrl: 'https://github.com/mozilla/pdf.js/blob/master/LICENSE',
    repository: 'https://github.com/mozilla/pdf.js',
    integrity: 'sha512-ZHjSVpDa3D6izMq8/04lvkhkATUmL9px6ChPaXc1k6nU2Mrhlg1/7F0bdUqCwUjw3NsPTfPZsMDUU6ZIcRaeQw==',
    files: {
      module: 'package/build/pdf.min.mjs',
      worker: 'package/build/pdf.worker.min.mjs',
    },
  },
  {
    id: 'hyzyla-pdfium',
    package: '@hyzyla/pdfium',
    version: '2.1.13',
    publishedAt: '2026-05-12',
    roles: ['parse', 'preview', 'password'],
    /*
     * The npm manifest and the package's own LICENSE.md both say MIT, and the
     * LICENSE.md is the MIT boilerplate as shipped with git, copyright "Scott
     * Chacon and others". The 5 MB WebAssembly binary in the same package is a
     * PDFium build, which is BSD-3-Clause with Foxit and Google notices, and
     * the package carries neither. The declared licence does not cover what the
     * package redistributes, so it is not verified.
     */
    licence: 'MIT',
    licenceVerified: false,
    licenceUrl: 'https://github.com/hyzyla/pdfium/blob/main/LICENSE.md',
    repository: 'https://github.com/hyzyla/pdfium',
    integrity: 'sha512-4J+xMFJW6V+jktxor6Lsk/2YdPCpeY+Ga69J98uyNQwYESkAsUDxz8BeFU0ZbZJIJ+fK3J6bm61gmwWnUzVU1g==',
    files: {
      module: 'package/dist/index.esm.browser.js',
      wasm: 'package/dist/pdfium.wasm',
    },
  },
  {
    id: 'pdf-lib',
    package: 'pdf-lib',
    version: '1.17.1',
    publishedAt: '2021-11-06',
    roles: ['parse', 'write'],
    licence: 'MIT',
    licenceVerified: true,
    licenceUrl: 'https://github.com/Hopding/pdf-lib/blob/master/LICENSE.md',
    repository: 'https://github.com/Hopding/pdf-lib',
    integrity: 'sha512-V/mpyJAoTsN4cnP31vc0wfNA1+p20evqqnap0KLoRUN0Yk/p3wN52DOEsL4oBFcLdb76hlpKPtzJIgo67j/XLw==',
    files: {
      script: 'package/dist/pdf-lib.min.js',
    },
  },
  {
    id: 'cantoo-pdf-lib',
    package: '@cantoo/pdf-lib',
    version: '2.9.2',
    publishedAt: '2026-09-07',
    roles: ['parse', 'write', 'password'],
    licence: 'MIT',
    licenceVerified: true,
    licenceUrl: 'https://github.com/cantoo-scribe/pdf-lib/blob/master/LICENSE.md',
    repository: 'https://github.com/cantoo-scribe/pdf-lib',
    integrity: 'sha512-Oy8F4aB5Ts/eFkF6s7JdfvgTwoSU8sJZwpmLPuG1JZilTGiFGiFBR90rmJXSeKfvN2QzX/gRR8pYyf4gXP9vHg==',
    files: {
      script: 'package/dist/pdf-lib.min.js',
    },
  },
]

/**
 * Ruled out before any browser ran, each with the fact that decided it. A
 * licence or a runtime requirement is cheaper to check than a measurement, and
 * a candidate that fails one cannot be rescued by a good number.
 */
export const exclusions = [
  {
    id: 'mupdf',
    package: 'mupdf',
    version: '1.28.1',
    reason: 'copyleft-licence',
    detail: 'AGPL-3.0-or-later, or a commercial licence from Artifex. Neither fits a site whose source is not offered under the AGPL.',
    sourceUrl: 'https://www.npmjs.com/package/mupdf/v/1.28.1',
  },
  {
    id: 'jspdf',
    package: 'jspdf',
    version: '4.2.1',
    reason: 'creation-only',
    detail: 'Generates new documents. It cannot open an existing PDF, so it cannot place a signature on the user\'s file.',
    sourceUrl: 'https://www.npmjs.com/package/jspdf/v/4.2.1',
  },
  {
    id: 'muhammara',
    package: 'muhammara',
    version: '6.0.6',
    reason: 'no-browser-build',
    detail: 'A node-pre-gyp native addon; it installs a platform binary and has no browser entry point.',
    sourceUrl: 'https://www.npmjs.com/package/muhammara/v/6.0.6',
  },
  {
    id: 'nutrient-viewer',
    package: '@nutrient-sdk/viewer',
    version: '1.21.0',
    reason: 'proprietary-licence',
    detail: 'Published as "SEE LICENSE IN" a commercial subscription agreement, and needs a licence key at runtime.',
    sourceUrl: 'https://www.npmjs.com/package/@nutrient-sdk/viewer/v/1.21.0',
  },
  {
    id: 'pdftron-webviewer',
    package: '@pdftron/webviewer',
    version: '12.1.0',
    reason: 'proprietary-licence',
    detail: 'No licence field in the manifest; Apryse licenses the product commercially and keys it per deployment.',
    sourceUrl: 'https://www.npmjs.com/package/@pdftron/webviewer/v/12.1.0',
  },
  {
    id: 'pdf-annotate-js',
    package: 'pdf-annotate.js',
    version: '1.0.0',
    reason: 'unmaintained',
    detail: 'Last published in 2016. An unmaintained parser is the wrong place to open files a user cannot re-check.',
    sourceUrl: 'https://www.npmjs.com/package/pdf-annotate.js/v/1.0.0',
  },
]

export const exclusionReasons = [
  'copyleft-licence',
  'proprietary-licence',
  'creation-only',
  'no-browser-build',
  'unmaintained',
]
