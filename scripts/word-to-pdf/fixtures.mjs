/**
 * The T26 corpus: the documents the Word to PDF gate is decided on.
 *
 * §12.13 of the specification asks for at least thirty reviewed documents
 * covering simple text, tables, images, headers and footers, page breaks,
 * lists, CJK and Latin fonts, equations, footnotes, tracked changes and
 * unsupported macros. Each one is written from `ooxml.mjs` and carries what it
 * declares — the sentences it contains, the sentences it must never show, the
 * tables' shape, how many pages its own breaks demand — so a conversion can be
 * checked against the document's own markup instead of against a screenshot.
 *
 * What this cannot do is say what Word would draw. Nothing here was compared
 * against Word's layout engine, and the record says so; a claim about
 * pixel-level fidelity is not available from this corpus and is not made.
 *
 * No real document is used, so nothing in `artifacts/` ever belonged to anyone.
 */
import { createHash } from 'node:crypto'
import {
  A4, LETTER, anchoredImage, buildDocx, cachedPageBreak, cell, commentRange, complexField, contentControl,
  deletion, endnoteReference, equation, field, footnoteReference, heading, hyperlink,
  inlineImage, insertion, line, listItem, pageBreak, paragraph, png, row, run,
  sectionBreak, table, textBox,
} from './ooxml.mjs'
import { writeZip } from './zip.mjs'

/**
 * The only address any corpus document points at. No conversion may request it:
 * a converter that follows a document's own links has taken the document
 * somewhere the user did not ask it to go.
 */
export const EXTERNAL_LINK_PROBE = 'https://word-to-pdf-probe.invalid/corpus-link'

const LOREM_ZH = '這一段是用來測試段落換行與斷字的內容，句子刻意寫長一點，讓排版引擎必須決定在哪裡換行，也讓比對可以看出文字有沒有被整段吞掉。'
const LOREM_EN = 'This paragraph exists to make the layout engine choose its own line breaks, so a comparison can tell whether the text survived the conversion at all.'

function filler(count, prefix) {
  return Array.from({ length: count }, (_, index) => line(`${prefix} ${index + 1}：${index % 2 === 0 ? LOREM_ZH : LOREM_EN}`)).join('')
}

const swatch = png(240, 120, (x, y) => [
  32 + Math.round((x / 240) * 200),
  64 + Math.round((y / 120) * 150),
  200 - Math.round((x / 240) * 120),
  255,
])

const logo = png(96, 96, (x, y) => {
  const inside = (x - 48) ** 2 + (y - 48) ** 2 < 40 ** 2
  return inside ? [12, 92, 200, 255] : [0, 0, 0, 0]
})

const IMAGES = [
  { key: 'swatch', name: 'swatch.png', mediaType: 'image/png', data: swatch },
  { key: 'logo', name: 'logo.png', mediaType: 'image/png', data: logo },
]

/** A Compound File Binary header and directory, the container Office puts an encrypted package in. */
function compoundFile(streamNames) {
  const header = Buffer.alloc(512, 0xFF)
  Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]).copy(header, 0)
  header.fill(0, 8, 24)
  header.writeUInt16LE(0x003E, 24)
  header.writeUInt16LE(0x0003, 26)
  header.writeUInt16LE(0xFFFE, 28)
  header.writeUInt16LE(9, 30)
  header.writeUInt16LE(6, 32)
  header.fill(0, 34, 44)
  header.writeUInt32LE(1, 44)
  header.writeUInt32LE(1, 48)
  header.writeUInt32LE(0, 52)
  header.writeUInt32LE(4096, 56)
  header.writeUInt32LE(0xFFFFFFFE, 60)
  header.writeUInt32LE(0, 64)
  header.writeUInt32LE(0xFFFFFFFE, 68)
  header.writeUInt32LE(0, 72)
  header.writeUInt32LE(0, 76)

  const fat = Buffer.alloc(512, 0xFF)
  fat.writeUInt32LE(0xFFFFFFFD, 0)
  fat.writeUInt32LE(0xFFFFFFFE, 4)

  const directory = Buffer.alloc(512, 0)
  const names = ['Root Entry', ...streamNames]
  names.forEach((name, index) => {
    const base = index * 128
    const encoded = Buffer.from(`${name}\0`, 'utf16le')
    encoded.copy(directory, base)
    directory.writeUInt16LE(encoded.length, base + 64)
    directory[base + 66] = index === 0 ? 5 : 2
    directory.writeUInt32LE(0xFFFFFFFF, base + 68)
    directory.writeUInt32LE(0xFFFFFFFF, base + 72)
    directory.writeUInt32LE(index === 0 && names.length > 1 ? 1 : 0xFFFFFFFF, base + 76)
    directory.writeUInt32LE(0xFFFFFFFE, base + 116)
  })

  return Buffer.concat([header, fat, directory])
}

function docx(options) {
  return writeZip(buildDocx(options).entries)
}

/** Every document in the corpus, in the order the record's tables print them. */
function corpus() {
  const documents = []
  const add = (fixture) => {
    documents.push(fixture)
    return fixture
  }

  const declare = value => ({
    pages: null,
    sections: 1,
    orientations: ['portrait'],
    text: [],
    absentText: [],
    tables: [],
    images: 0,
    headerText: [],
    footerText: [],
    footnoteText: [],
    endnoteText: [],
    commentText: [],
    listMarkers: [],
    hyperlinks: [],
    fields: [],
    equationText: [],
    /* Families the document names in `w:rFonts`; §12.13 asks what happens to them. */
    fontFamilies: [],
    ...value,
  })

  /* ---- text ---- */

  add({
    name: 'plain-paragraphs',
    category: 'text',
    features: ['paragraphs'],
    expectation: 'convert',
    note: '最小的可轉換文件：六段純文字，沒有任何樣式。',
    declared: declare({ pages: 1, text: ['第一段：純文字基準。', '第六段：純文字基準。'] }),
    bytes: docx({
      body: [
        heading('純文字基準文件'),
        ...Array.from({ length: 6 }, (_, index) => line(`第${['一', '二', '三', '四', '五', '六'][index]}段：純文字基準。${index % 2 === 0 ? LOREM_ZH : LOREM_EN}`)),
      ].join(''),
    }),
  })

  add({
    name: 'latin-typography',
    category: 'text',
    features: ['character-formatting', 'latin-fonts'],
    expectation: 'convert',
    note: '粗體、斜體、底線、刪除線、上下標、字距與色彩，全部在拉丁字型上。',
    declared: declare({
      pages: 1,
      text: ['Bold run', 'Italic run', 'Struck run', 'Superscript', 'Georgia serif run'],
      fontFamilies: ['Georgia', 'Courier New', 'Calibri'],
    }),
    bytes: docx({
      body: [
        heading('Latin typography'),
        paragraph([
          run('Bold run ', '<w:b/>'),
          run('Italic run ', '<w:i/>'),
          run('Underlined run ', '<w:u w:val="single"/>'),
          run('Struck run ', '<w:strike/>'),
          run('Superscript', '<w:vertAlign w:val="superscript"/>'),
          run(' and '),
          run('subscript', '<w:vertAlign w:val="subscript"/>'),
        ].join('')),
        paragraph([
          run('Georgia serif run. ', '<w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/>'),
          run('Courier New monospace run. ', '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>'),
          run('Coloured and spaced run.', '<w:color w:val="B03060"/><w:spacing w:val="40"/><w:sz w:val="28"/>'),
        ].join('')),
        line(LOREM_EN),
      ].join(''),
    }),
  })

  add({
    name: 'cjk-latin-mixed',
    category: 'text',
    features: ['cjk-fonts', 'latin-fonts', 'mixed-script'],
    expectation: 'convert',
    note: '繁體中文與拉丁文字交錯，並指定 eastAsia 字型；行內混排的斷行是常見的失真點。',
    declared: declare({
      pages: 1,
      text: ['繁體中文與 Latin script 在同一行混排', '標點符號：，。、；：「」（）？！'],
      fontFamilies: ['Microsoft JhengHei', 'Calibri'],
    }),
    bytes: docx({
      body: [
        heading('繁體中文與拉丁文字混排'),
        line('繁體中文與 Latin script 在同一行混排，字型切換由 eastAsia 與 ascii 兩個屬性決定。'),
        line('標點符號：，。、；：「」（）？！——這一行用來看標點壓縮與行首禁則。'),
        paragraph(run('微軟正黑體指定段落。', '<w:rFonts w:eastAsia="Microsoft JhengHei" w:ascii="Calibri" w:hAnsi="Calibri"/>')),
        line(LOREM_ZH),
      ].join(''),
    }),
  })

  add({
    name: 'cjk-missing-font',
    category: 'text',
    features: ['cjk-fonts', 'font-substitution'],
    expectation: 'convert',
    note: '指定標楷體 DFKai-SB。量測機器不一定裝有這個字型，替代字型的處理方式就是這份文件要看的事。',
    declared: declare({
      pages: 1,
      text: ['這一段指定標楷體', '這一段指定細明體'],
      fontFamilies: ['DFKai-SB', 'MingLiU', 'Corpus Imaginary Sans'],
    }),
    bytes: docx({
      body: [
        heading('字型替代'),
        paragraph(run('這一段指定標楷體，如果系統沒有就會被替代。', '<w:rFonts w:eastAsia="DFKai-SB" w:ascii="DFKai-SB" w:hAnsi="DFKai-SB"/>')),
        paragraph(run('這一段指定細明體，同樣可能被替代。', '<w:rFonts w:eastAsia="MingLiU" w:ascii="MingLiU" w:hAnsi="MingLiU"/>')),
        paragraph(run('This run asks for a font nobody has: Corpus Imaginary Sans.', '<w:rFonts w:ascii="Corpus Imaginary Sans" w:hAnsi="Corpus Imaginary Sans"/>')),
      ].join(''),
    }),
  })

  add({
    name: 'paragraph-layout',
    category: 'text',
    features: ['alignment', 'indentation', 'line-spacing'],
    expectation: 'convert',
    note: '靠左、置中、靠右、左右對齊、首行縮排、懸掛縮排與固定行高。',
    declared: declare({
      pages: 1,
      text: ['置中段落', '靠右段落', '左右對齊段落', '首行縮排段落', '固定行高段落'],
    }),
    bytes: docx({
      body: [
        heading('段落排版'),
        line('靠左段落（預設）。'),
        line('置中段落。', { paragraphProperties: '<w:jc w:val="center"/>' }),
        line('靠右段落。', { paragraphProperties: '<w:jc w:val="right"/>' }),
        line(`左右對齊段落。${LOREM_ZH}${LOREM_EN}`, { paragraphProperties: '<w:jc w:val="both"/>' }),
        line(`首行縮排段落。${LOREM_ZH}`, { paragraphProperties: '<w:ind w:firstLine="480"/>' }),
        line(`懸掛縮排段落。${LOREM_ZH}`, { paragraphProperties: '<w:ind w:left="720" w:hanging="480"/>' }),
        line(`固定行高段落。${LOREM_ZH}`, { paragraphProperties: '<w:spacing w:line="480" w:lineRule="exact"/>' }),
      ].join(''),
    }),
  })

  add({
    name: 'tab-stops',
    category: 'text',
    features: ['tab-stops', 'leaders'],
    expectation: 'convert',
    note: '置中、靠右與小數點定位停駐點，以及點狀前導字元；目錄與表單常依賴它。',
    declared: declare({
      pages: 1,
      text: ['項目名稱', '金額', '第一項'],
    }),
    bytes: docx({
      body: [
        heading('定位停駐點'),
        paragraph(`${run('項目名稱')}<w:r><w:tab/></w:r>${run('金額')}`, '<w:tabs><w:tab w:val="right" w:pos="9026" w:leader="dot"/></w:tabs>'),
        paragraph(`${run('第一項')}<w:r><w:tab/></w:r>${run('1,234.50')}`, '<w:tabs><w:tab w:val="decimal" w:pos="9026" w:leader="dot"/></w:tabs>'),
        paragraph(`${run('置中')}<w:r><w:tab/></w:r>${run('靠右')}`, '<w:tabs><w:tab w:val="center" w:pos="4513"/><w:tab w:val="right" w:pos="9026"/></w:tabs>'),
      ].join(''),
    }),
  })

  /* ---- tables and lists ---- */

  add({
    name: 'simple-table',
    category: 'table',
    features: ['tables', 'borders'],
    expectation: 'convert',
    note: '四列三欄，有框線與標題列底色。',
    declared: declare({
      pages: 1,
      text: ['品名', '單價', '小計', '保溫杯'],
      tables: [{ rows: 4, columns: 3 }],
    }),
    bytes: docx({
      body: [
        heading('簡單表格'),
        table([
          row([cell('品名', { width: 3200, shade: 'E8EEF9' }), cell('單價', { width: 3200, shade: 'E8EEF9' }), cell('小計', { width: 3200, shade: 'E8EEF9' })], { header: true }),
          row([cell('保溫杯', { width: 3200 }), cell('380', { width: 3200 }), cell('1,140', { width: 3200 })]),
          row([cell('筆記本', { width: 3200 }), cell('120', { width: 3200 }), cell('600', { width: 3200 })]),
          row([cell('帆布袋', { width: 3200 }), cell('250', { width: 3200 }), cell('750', { width: 3200 })]),
        ], { columns: [3200, 3200, 3200] }),
      ].join(''),
    }),
  })

  add({
    name: 'merged-table',
    category: 'table',
    features: ['tables', 'grid-span', 'vertical-merge'],
    expectation: 'convert',
    note: '橫向 gridSpan 與縱向 vMerge 合併；合併還原錯誤會直接改變表格語意。',
    declared: declare({
      pages: 1,
      text: ['跨三欄的標題列', '縱向合併', '右上'],
      tables: [{ rows: 4, columns: 3 }],
    }),
    bytes: docx({
      body: [
        heading('合併儲存格'),
        table([
          row([cell('跨三欄的標題列', { width: 9600, span: 3, shade: 'E8EEF9' })], { header: true }),
          row([cell('縱向合併', { width: 3200, merge: 'restart' }), cell('右上', { width: 3200 }), cell('最右上', { width: 3200 })]),
          row([cell('', { width: 3200, merge: 'continue' }), cell('右中', { width: 3200 }), cell('最右中', { width: 3200 })]),
          row([cell('左下', { width: 3200 }), cell('跨兩欄', { width: 6400, span: 2 })]),
        ], { columns: [3200, 3200, 3200] }),
      ].join(''),
    }),
  })

  add({
    name: 'nested-table',
    category: 'table',
    features: ['tables', 'nested-tables'],
    expectation: 'convert',
    note: '表格中再放一個表格，用來看解析器的遞迴與寬度計算。',
    declared: declare({
      pages: 1,
      text: ['外層儲存格', '內層左上', '內層右下'],
      tables: [{ rows: 2, columns: 2 }, { rows: 2, columns: 2 }],
    }),
    bytes: docx({
      body: [
        heading('巢狀表格'),
        table([
          row([cell('外層儲存格', { width: 4800 }), cell([
            table([
              row([cell('內層左上', { width: 2200 }), cell('內層右上', { width: 2200 })]),
              row([cell('內層左下', { width: 2200 }), cell('內層右下', { width: 2200 })]),
            ], { width: 4400, columns: [2200, 2200] }),
          ], { width: 4800 })]),
          row([cell('外層第二列左', { width: 4800 }), cell('外層第二列右', { width: 4800 })]),
        ], { columns: [4800, 4800] }),
      ].join(''),
    }),
  })

  add({
    name: 'wide-table',
    category: 'table',
    features: ['tables', 'overflow'],
    expectation: 'convert',
    note: '表格寬度超過版面文字寬度，逼引擎決定溢出、縮放或裁切。',
    declared: declare({
      pages: 1,
      text: ['溢出測試', '欄一', '欄十'],
      tables: [{ rows: 3, columns: 10 }],
    }),
    bytes: docx({
      body: [
        heading('超寬表格'),
        line('溢出測試：下面的表格比文字欄寬。'),
        table([
          row(Array.from({ length: 10 }, (_, index) => cell(`欄${['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][index]}`, { width: 1600, shade: 'E8EEF9' })), { header: true }),
          row(Array.from({ length: 10 }, (_, index) => cell(`${(index + 1) * 111}`, { width: 1600 }))),
          row(Array.from({ length: 10 }, (_, index) => cell(`${(index + 1) * 222}`, { width: 1600 }))),
        ], { width: 16000, columns: Array.from({ length: 10 }, () => 1600) }),
      ].join(''),
    }),
  })

  add({
    name: 'long-table-repeat-header',
    category: 'table',
    features: ['tables', 'repeating-header', 'page-flow'],
    expectation: 'convert',
    note: '六十列的表格必須跨頁，標題列標了 tblHeader 應在每頁重複。',
    declared: declare({
      text: ['序號', '說明', '第 60 列'],
      tables: [{ rows: 61, columns: 2 }],
    }),
    bytes: docx({
      body: [
        heading('跨頁表格與重複標題列'),
        table([
          row([cell('序號', { width: 1600, shade: 'E8EEF9' }), cell('說明', { width: 8000, shade: 'E8EEF9' })], { header: true }),
          ...Array.from({ length: 60 }, (_, index) => row([
            cell(`${index + 1}`, { width: 1600 }),
            cell(`第 ${index + 1} 列：${index === 59 ? '第 60 列' : LOREM_ZH.slice(0, 28)}`, { width: 8000 }),
          ])),
        ], { columns: [1600, 8000] }),
      ].join(''),
    }),
  })

  add({
    name: 'lists-bullet-and-numbered',
    category: 'list',
    features: ['lists', 'numbering', 'multilevel'],
    expectation: 'convert',
    note: '三層項目符號與三層編號清單；編號要由 numbering.xml 算出來，不是文字。',
    declared: declare({
      pages: 1,
      text: ['第一層項目', '第三層項目', '編號第一層'],
      listMarkers: ['●', '1.'],
    }),
    bytes: docx({
      numbering: true,
      body: [
        heading('清單'),
        listItem('第一層項目', { numberingId: 1, level: 0 }),
        listItem('第二層項目', { numberingId: 1, level: 1 }),
        listItem('第三層項目', { numberingId: 1, level: 2 }),
        listItem('編號第一層', { numberingId: 2, level: 0 }),
        listItem('編號第二層', { numberingId: 2, level: 1 }),
        listItem('編號第三層', { numberingId: 2, level: 2 }),
        listItem('編號第一層之二', { numberingId: 2, level: 0 }),
      ].join(''),
    }),
  })

  /* ---- pagination ---- */

  add({
    name: 'explicit-page-breaks',
    category: 'pagination',
    features: ['page-breaks'],
    expectation: 'convert',
    note: '四個明確分頁符號，因此這份文件宣告的頁數是五。',
    declared: declare({
      pages: 5,
      text: ['第 1 頁起始', '第 5 頁起始'],
    }),
    bytes: docx({
      body: Array.from({ length: 5 }, (_, index) => [
        index > 0 ? pageBreak() : '',
        heading(`第 ${index + 1} 頁起始`),
        line(LOREM_ZH),
      ].join('')).join(''),
    }),
  })

  add({
    name: 'word-cached-page-breaks',
    category: 'pagination',
    features: ['cached-page-breaks', 'page-flow'],
    expectation: 'convert',
    note: '文字自然流過三頁，分頁點以 w:lastRenderedPageBreak 標記，就像 Word 存檔時留下的那樣。',
    declared: declare({
      pages: 3,
      text: ['快取分頁第 1 段', '快取分頁第 24 段'],
    }),
    bytes: docx({
      body: [
        heading('帶有快取分頁點的文件'),
        ...Array.from({ length: 24 }, (_, index) => paragraph(
          `${index > 0 && index % 8 === 0 ? cachedPageBreak() : ''}${run(`快取分頁第 ${index + 1} 段：${index % 2 === 0 ? LOREM_ZH : LOREM_EN}`)}`,
        )),
      ].join(''),
    }),
  })

  add({
    name: 'flowing-overflow-no-breaks',
    category: 'pagination',
    features: ['page-flow'],
    expectation: 'convert',
    note: '同樣長度的文字，但沒有明確分頁符號也沒有快取分頁點，這是非 Word 產生器常見的樣子。',
    declared: declare({
      pages: 3,
      text: ['自然分頁第 1 段', '自然分頁第 24 段'],
    }),
    bytes: docx({
      body: [
        heading('沒有任何分頁標記的文件'),
        ...Array.from({ length: 24 }, (_, index) => line(`自然分頁第 ${index + 1} 段：${index % 2 === 0 ? LOREM_ZH : LOREM_EN}`)),
      ].join(''),
    }),
  })

  add({
    name: 'section-breaks-next-page',
    category: 'pagination',
    features: ['section-breaks'],
    expectation: 'convert',
    note: '三個分節符號，每一節從新的一頁開始。',
    declared: declare({
      pages: 3,
      sections: 3,
      text: ['第一節', '第二節', '第三節'],
    }),
    bytes: docx({
      body: [
        heading('第一節'), line(LOREM_ZH),
        sectionBreak({ type: 'nextPage' }),
        heading('第二節'), line(LOREM_EN),
        sectionBreak({ type: 'nextPage' }),
        heading('第三節'), line(LOREM_ZH),
      ].join(''),
      section: { type: 'nextPage' },
    }),
  })

  add({
    name: 'two-column-section',
    category: 'pagination',
    features: ['columns', 'section-breaks'],
    expectation: 'convert',
    note: '單欄與雙欄各一節；欄位排版是 HTML 轉換最常整個消失的部分。',
    declared: declare({
      sections: 2,
      text: ['單欄前言', '雙欄內文開始'],
    }),
    bytes: docx({
      body: [
        heading('單欄前言'), line(LOREM_ZH),
        sectionBreak({ type: 'nextPage' }),
        heading('雙欄內文開始'),
        filler(6, '雙欄段落'),
      ].join(''),
      section: { columns: 2, type: 'continuous' },
    }),
  })

  add({
    name: 'orientation-mixed',
    category: 'pagination',
    features: ['orientation', 'section-breaks'],
    expectation: 'convert',
    note: '直向、橫向、直向三節；橫向頁的紙張長寬互換。',
    declared: declare({
      pages: 3,
      sections: 3,
      orientations: ['portrait', 'landscape', 'portrait'],
      text: ['直向第一節', '橫向第二節', '直向第三節'],
    }),
    bytes: docx({
      body: [
        heading('直向第一節'), line(LOREM_ZH),
        sectionBreak({ type: 'nextPage', orientation: 'portrait' }),
        heading('橫向第二節'), line(LOREM_EN),
        sectionBreak({ type: 'nextPage', orientation: 'landscape' }),
        heading('直向第三節'), line(LOREM_ZH),
      ].join(''),
      section: { type: 'nextPage', orientation: 'portrait' },
    }),
  })

  add({
    name: 'page-size-mixed',
    category: 'pagination',
    features: ['page-size', 'section-breaks'],
    expectation: 'convert',
    note: 'A4 與 Letter 兩節；頁面尺寸換掉之後版心寬度也跟著變。',
    declared: declare({
      pages: 2,
      sections: 2,
      text: ['A4 這一節', 'Letter 這一節'],
    }),
    bytes: docx({
      body: [
        heading('A4 這一節'), line(LOREM_ZH),
        sectionBreak({ type: 'nextPage', size: A4 }),
        heading('Letter 這一節'), line(LOREM_EN),
      ].join(''),
      section: { type: 'nextPage', size: LETTER },
    }),
  })

  add({
    name: 'keep-together',
    category: 'pagination',
    features: ['keep-next', 'keep-lines', 'widow-control'],
    expectation: 'convert',
    note: 'keepNext、keepLines 與寡行控制；忽略它們不會少字，但會把標題留在前一頁底部。',
    declared: declare({
      text: ['這個標題必須跟著下一段', '不可拆開的段落'],
    }),
    bytes: docx({
      body: [
        filler(14, '前置段落'),
        line('這個標題必須跟著下一段', { paragraphProperties: '<w:keepNext/><w:pStyle w:val="Heading2"/>' }),
        line(`不可拆開的段落。${LOREM_ZH}${LOREM_ZH}`, { paragraphProperties: '<w:keepLines/><w:widowControl/>' }),
        filler(6, '後續段落'),
      ].join(''),
    }),
  })

  /* ---- headers, footers, notes, fields ---- */

  add({
    name: 'headers-and-footers',
    category: 'furniture',
    features: ['headers', 'footers', 'page-field'],
    expectation: 'convert',
    note: '預設頁首與含 PAGE 功能變數的頁尾，文件有三頁。',
    declared: declare({
      pages: 3,
      text: ['內文第 1 頁', '內文第 3 頁'],
      headerText: ['頁首：季度報告'],
      footerText: ['第'],
      fields: ['PAGE'],
    }),
    bytes: docx({
      headers: [{ kind: 'default', content: paragraph(run('頁首：季度報告'), '<w:pStyle w:val="Header"/>') }],
      footers: [{
        kind: 'default',
        content: paragraph(`${run('第 ')}${complexField(' PAGE ', '1')}${run(' 頁，共 ')}${complexField(' NUMPAGES ', '3')}${run(' 頁')}`, '<w:pStyle w:val="Footer"/><w:jc w:val="center"/>'),
      }],
      section: { headers: ['default'], footers: ['default'] },
      body: Array.from({ length: 3 }, (_, index) => [
        index > 0 ? pageBreak() : '',
        heading(`內文第 ${index + 1} 頁`),
        line(LOREM_ZH),
      ].join('')).join(''),
    }),
  })

  add({
    name: 'header-first-even-odd',
    category: 'furniture',
    features: ['headers', 'title-page', 'even-odd-headers'],
    expectation: 'convert',
    note: '首頁不同加上奇偶頁不同，共三種頁首；只認得預設頁首的轉換會把三種寫成一種。',
    declared: declare({
      pages: 4,
      text: ['內文第 1 頁', '內文第 4 頁'],
      headerText: ['首頁頁首', '偶數頁頁首', '奇數頁頁首'],
    }),
    bytes: docx({
      settingsExtra: ['<w:evenAndOddHeaders/>'],
      headers: [
        { kind: 'first', content: paragraph(run('首頁頁首'), '<w:pStyle w:val="Header"/>') },
        { kind: 'even', content: paragraph(run('偶數頁頁首'), '<w:pStyle w:val="Header"/>') },
        { kind: 'default', content: paragraph(run('奇數頁頁首'), '<w:pStyle w:val="Header"/>') },
      ],
      section: { headers: ['first', 'even', 'default'], titlePage: true },
      body: Array.from({ length: 4 }, (_, index) => [
        index > 0 ? pageBreak() : '',
        heading(`內文第 ${index + 1} 頁`),
        line(LOREM_ZH),
      ].join('')).join(''),
    }),
  })

  add({
    name: 'footnotes',
    category: 'furniture',
    features: ['footnotes'],
    expectation: 'convert',
    note: '三個註腳；註腳內容放在另一個 part，忽略它就是整段文字消失。',
    declared: declare({
      pages: 1,
      text: ['需要註腳的句子一', '需要註腳的句子三'],
      footnoteText: ['註腳一：資料來源說明。', '註腳三：最後一個註腳。'],
    }),
    bytes: docx({
      footnotes: [
        { id: 2, text: '註腳一：資料來源說明。' },
        { id: 3, text: '註腳二：補充條件。' },
        { id: 4, text: '註腳三：最後一個註腳。' },
      ],
      body: [
        heading('註腳'),
        paragraph(`${run('需要註腳的句子一。')}${footnoteReference(2)}`),
        paragraph(`${run('需要註腳的句子二。')}${footnoteReference(3)}`),
        paragraph(`${run('需要註腳的句子三。')}${footnoteReference(4)}`),
      ].join(''),
    }),
  })

  add({
    name: 'endnotes',
    category: 'furniture',
    features: ['endnotes'],
    expectation: 'convert',
    note: '兩個章節附註，內容應出現在文件末尾。',
    declared: declare({
      pages: 1,
      text: ['需要章節附註的句子'],
      endnoteText: ['附註一：延伸閱讀。', '附註二：相關規範。'],
    }),
    bytes: docx({
      endnotes: [
        { id: 2, text: '附註一：延伸閱讀。' },
        { id: 3, text: '附註二：相關規範。' },
      ],
      body: [
        heading('章節附註'),
        paragraph(`${run('需要章節附註的句子。')}${endnoteReference(2)}`),
        paragraph(`${run('第二個引用。')}${endnoteReference(3)}`),
      ].join(''),
    }),
  })

  add({
    name: 'fields-and-toc',
    category: 'furniture',
    features: ['fields', 'table-of-contents'],
    expectation: 'convert',
    note: 'TOC、PAGE、NUMPAGES、DATE 與 REF 功能變數；快取結果與重新計算的差別在這裡看得見。',
    declared: declare({
      text: ['目錄', '第一章 標題', '第二章 標題'],
      fields: ['TOC', 'PAGE', 'NUMPAGES', 'DATE'],
    }),
    bytes: docx({
      body: [
        heading('目錄'),
        paragraph(field(' TOC \\o "1-3" \\h \\z \\u ', '第一章 標題\t1')),
        pageBreak(),
        heading('第一章 標題'),
        line(LOREM_ZH),
        paragraph(`${run('本頁為第 ')}${field(' PAGE ', '2')}${run(' 頁，共 ')}${field(' NUMPAGES ', '3')}${run(' 頁。')}`),
        pageBreak(),
        heading('第二章 標題'),
        paragraph(`${run('建立日期：')}${field(' DATE \\@ "yyyy/MM/dd" ', '2026/09/01')}`),
      ].join(''),
    }),
  })

  /* ---- media ---- */

  add({
    name: 'inline-image',
    category: 'media',
    features: ['images', 'inline-drawing'],
    expectation: 'convert',
    note: '一張置入文字流的 PNG，另一張帶透明背景。',
    declared: declare({
      pages: 1,
      text: ['圖片說明：漸層色塊'],
      images: 2,
    }),
    bytes: docx({
      images: IMAGES,
      body: ({ imageIds }) => [
        heading('內嵌圖片'),
        line('圖片說明：漸層色塊'),
        inlineImage(imageIds.swatch, { id: 1, name: '漸層色塊' }),
        line('下面是帶 alpha 的圖示。'),
        inlineImage(imageIds.logo, { id: 2, name: '圓形圖示', widthEmu: 914400, heightEmu: 914400 }),
      ].join(''),
    }),
  })

  add({
    name: 'floating-image-wrap',
    category: 'media',
    features: ['images', 'anchored-drawing', 'text-wrapping'],
    expectation: 'convert',
    note: '錨定圖片加上四周環繞；環繞失敗時文字會被整塊推開或壓在圖上。',
    declared: declare({
      pages: 1,
      text: ['環繞測試段落'],
      images: 1,
    }),
    bytes: docx({
      images: [IMAGES[0]],
      body: ({ imageIds }) => [
        heading('浮動圖片與文繞圖'),
        anchoredImage(imageIds.swatch),
        line(`環繞測試段落。${LOREM_ZH}${LOREM_EN}${LOREM_ZH}`),
      ].join(''),
    }),
  })

  add({
    name: 'image-gallery',
    category: 'media',
    features: ['images', 'many-relationships'],
    expectation: 'convert',
    note: '同一張圖片以十二個位置重複置入，看關係表與解碼成本。',
    declared: declare({
      text: ['圖庫頁'],
      images: 12,
    }),
    bytes: docx({
      images: [IMAGES[0]],
      body: ({ imageIds }) => [
        heading('圖庫頁'),
        ...Array.from({ length: 12 }, (_, index) => inlineImage(imageIds.swatch, {
          id: index + 10,
          name: `圖片 ${index + 1}`,
          widthEmu: 1828800,
          heightEmu: 914400,
        })),
      ].join(''),
    }),
  })

  /* ---- hard features ---- */

  add({
    name: 'equation-omml',
    category: 'hard',
    features: ['equations', 'omml'],
    expectation: 'convert',
    note: 'OMML 方程式；掉了整個命名空間的話公式會無聲消失。',
    declared: declare({
      pages: 1,
      text: ['下面是一個方程式'],
      equationText: ['a', 'b', 'x', '2'],
    }),
    bytes: docx({
      body: [
        heading('方程式'),
        line('下面是一個方程式：'),
        equation('a', 'b', 'x', '2'),
        line('方程式之後還有一段文字。'),
      ].join(''),
    }),
  })

  add({
    name: 'tracked-changes',
    category: 'hard',
    features: ['tracked-changes', 'revisions'],
    expectation: 'convert',
    note: '插入與刪除修訂。刪除的文字若被當成正文印出來，就是把作者拿掉的內容交還給讀者。',
    declared: declare({
      pages: 1,
      text: ['這一段有修訂', '這是插入的內容'],
      absentText: ['這是被刪除的內容'],
    }),
    bytes: docx({
      body: [
        heading('追蹤修訂'),
        paragraph(`${run('這一段有修訂：')}${insertion('這是插入的內容。', { id: 910 })}${deletion('這是被刪除的內容。', { id: 911 })}${run('修訂結束。')}`),
        paragraph(`${run('第二段：')}${deletion('整段都被刪除了。', { id: 912 })}`),
      ].join(''),
    }),
  })

  add({
    name: 'comments',
    category: 'hard',
    features: ['comments', 'annotations'],
    expectation: 'convert',
    note: '兩則註解。註解不是正文，印進版面就是洩漏審閱過程。',
    declared: declare({
      pages: 1,
      text: ['被註解的句子'],
      commentText: ['審閱意見一：請確認數字。', '審閱意見二：這裡要補來源。'],
    }),
    bytes: docx({
      comments: [
        { id: 1, author: 'Reviewer A', initials: 'RA', text: '審閱意見一：請確認數字。' },
        { id: 2, author: 'Reviewer B', initials: 'RB', text: '審閱意見二：這裡要補來源。' },
      ],
      body: [
        heading('註解'),
        paragraph(commentRange(1, run('被註解的句子。'))),
        paragraph(commentRange(2, run('第二個被註解的句子。'))),
      ].join(''),
    }),
  })

  add({
    name: 'content-controls',
    category: 'hard',
    features: ['structured-document-tags'],
    expectation: 'convert',
    note: '內容控制項（w:sdt）包住的文字；不認得 sdt 的解析器會連內容一起跳過。',
    declared: declare({
      pages: 1,
      text: ['控制項內的公司名稱', '控制項內的日期'],
    }),
    bytes: docx({
      body: [
        heading('內容控制項'),
        contentControl('company', line('控制項內的公司名稱')),
        contentControl('date', line('控制項內的日期')),
        line('控制項之外的一般段落。'),
      ].join(''),
    }),
  })

  add({
    name: 'text-box',
    category: 'hard',
    features: ['text-boxes', 'alternate-content', 'vml-fallback'],
    expectation: 'convert',
    note: 'DrawingML 文字方塊加上 VML 後備；兩個分支都不認得就會少掉一整塊文字。',
    declared: declare({
      pages: 1,
      text: ['文字方塊裡的內容', '文字方塊之外'],
    }),
    bytes: docx({
      body: [
        heading('文字方塊'),
        textBox('文字方塊裡的內容'),
        line('文字方塊之外的段落。'),
      ].join(''),
    }),
  })

  add({
    name: 'external-hyperlinks',
    category: 'hard',
    features: ['hyperlinks', 'external-relationships'],
    expectation: 'convert',
    note: `文件指向 ${EXTERNAL_LINK_PROBE}。任何一次對這個位址的請求都是邊界事故。`,
    declared: declare({
      pages: 1,
      text: ['這是一個外部連結'],
      hyperlinks: [EXTERNAL_LINK_PROBE],
    }),
    bytes: docx({
      hyperlinks: [{ key: 'probe', target: EXTERNAL_LINK_PROBE }],
      body: ({ hyperlinkIds }) => [
        heading('外部連結'),
        hyperlink(hyperlinkIds.probe, '這是一個外部連結'),
        line('連結之後的一般段落。'),
      ].join(''),
    }),
  })

  add({
    name: 'mixed-complex',
    category: 'hard',
    features: ['tables', 'images', 'lists', 'footnotes', 'headers', 'footers', 'equations', 'page-breaks'],
    expectation: 'convert',
    note: '表格、圖片、清單、註腳、頁首頁尾、方程式與分頁在同一份文件裡。',
    declared: declare({
      pages: 3,
      text: ['綜合測試文件', '綜合清單一', '綜合表格'],
      tables: [{ rows: 3, columns: 3 }],
      images: 1,
      headerText: ['綜合頁首'],
      footerText: ['綜合頁尾'],
      footnoteText: ['綜合註腳內容。'],
      listMarkers: ['●'],
    }),
    bytes: docx({
      numbering: true,
      images: [IMAGES[0]],
      footnotes: [{ id: 2, text: '綜合註腳內容。' }],
      headers: [{ kind: 'default', content: paragraph(run('綜合頁首'), '<w:pStyle w:val="Header"/>') }],
      footers: [{ kind: 'default', content: paragraph(run('綜合頁尾'), '<w:pStyle w:val="Footer"/>') }],
      section: { headers: ['default'], footers: ['default'] },
      body: ({ imageIds }) => [
        heading('綜合測試文件'),
        paragraph(`${run('第一段帶註腳。')}${footnoteReference(2)}`),
        listItem('綜合清單一', { numberingId: 1, level: 0 }),
        listItem('綜合清單二', { numberingId: 1, level: 1 }),
        pageBreak(),
        heading('綜合表格'),
        table([
          row([cell('A', { width: 3200, shade: 'E8EEF9' }), cell('B', { width: 3200, shade: 'E8EEF9' }), cell('C', { width: 3200, shade: 'E8EEF9' })], { header: true }),
          row([cell('1', { width: 3200 }), cell('2', { width: 3200 }), cell('3', { width: 3200 })]),
          row([cell('4', { width: 3200 }), cell('5', { width: 3200 }), cell('6', { width: 3200 })]),
        ], { columns: [3200, 3200, 3200] }),
        pageBreak(),
        inlineImage(imageIds.swatch, { id: 3, name: '綜合圖片' }),
        equation('x', 'y', 'e', 'i'),
      ].join(''),
    }),
  })

  /* ---- scale ---- */

  add({
    name: 'reference-20-page',
    category: 'scale',
    features: ['paragraphs', 'tables', 'images', 'headers', 'footers', 'page-breaks'],
    expectation: 'convert',
    note: '規格 §12.13 的代表性二十頁文件，效能預算以它為準。',
    declared: declare({
      pages: 20,
      text: ['參考文件第 1 節', '參考文件第 20 節'],
      images: 5,
      headerText: ['參考文件頁首'],
      footerText: ['參考文件頁尾'],
      tables: Array.from({ length: 5 }, () => ({ rows: 4, columns: 3 })),
    }),
    bytes: docx({
      images: [IMAGES[0]],
      headers: [{ kind: 'default', content: paragraph(run('參考文件頁首'), '<w:pStyle w:val="Header"/>') }],
      footers: [{ kind: 'default', content: paragraph(`${run('參考文件頁尾 ')}${complexField(' PAGE ', '1')}`, '<w:pStyle w:val="Footer"/>') }],
      section: { headers: ['default'], footers: ['default'] },
      body: ({ imageIds }) => Array.from({ length: 20 }, (_, index) => [
        index > 0 ? pageBreak() : '',
        heading(`參考文件第 ${index + 1} 節`),
        filler(4, `第 ${index + 1} 節段落`),
        index % 4 === 3
          ? table([
            row([cell('欄一', { width: 3200, shade: 'E8EEF9' }), cell('欄二', { width: 3200, shade: 'E8EEF9' }), cell('欄三', { width: 3200, shade: 'E8EEF9' })], { header: true }),
            ...Array.from({ length: 3 }, (_, rowIndex) => row([
              cell(`${index}-${rowIndex}-1`, { width: 3200 }),
              cell(`${index}-${rowIndex}-2`, { width: 3200 }),
              cell(`${index}-${rowIndex}-3`, { width: 3200 }),
            ])),
          ], { columns: [3200, 3200, 3200] })
          : '',
        index % 4 === 0 ? inlineImage(imageIds.swatch, { id: 100 + index, name: `參考圖片 ${index}` }) : '',
      ].join('')).join(''),
    }),
  })

  add({
    name: 'large-120-page',
    category: 'scale',
    features: ['paragraphs', 'page-breaks'],
    expectation: 'convert',
    note: '一百二十頁，用來看上限該定在哪裡，不是宣稱支援到這個大小。',
    declared: declare({
      pages: 120,
      text: ['長文件第 1 節', '長文件第 120 節'],
    }),
    bytes: docx({
      body: Array.from({ length: 120 }, (_, index) => [
        index > 0 ? pageBreak() : '',
        heading(`長文件第 ${index + 1} 節`),
        filler(5, `第 ${index + 1} 節段落`),
      ].join('')).join(''),
    }),
  })

  /* ---- must be refused ---- */

  add({
    name: 'macro-enabled',
    category: 'refuse',
    features: ['macros', 'vba-project'],
    expectation: 'refuse',
    extension: 'docm',
    mediaType: 'application/vnd.ms-word.document.macroEnabled.12',
    note: '宣告 VBA 專案的 .docm。裡面沒有可執行的巨集程式碼，只有一段說明文字。',
    declared: declare({
      text: ['這份文件宣告了巨集'],
      absentText: ['CORPUS PLACEHOLDER'],
    }),
    bytes: docx({
      macroEnabled: true,
      body: [
        heading('巨集文件'),
        line('這份文件宣告了巨集。'),
      ].join(''),
    }),
  })

  add({
    name: 'legacy-binary-doc',
    category: 'refuse',
    features: ['legacy-format'],
    expectation: 'refuse',
    extension: 'doc',
    mediaType: 'application/msword',
    note: 'Word 97-2003 的 CFB 二進位格式，不是 OOXML；必須在解析前就被辨識。',
    declared: declare({}),
    bytes: Buffer.concat([
      compoundFile(['WordDocument', '1Table']),
      Buffer.from('CORPUS PLACEHOLDER: a Word 97-2003 container shape, with no document stream.', 'ascii'),
    ]),
  })

  add({
    name: 'encrypted-docx',
    category: 'refuse',
    features: ['encryption'],
    expectation: 'refuse',
    note: 'ECMA-376 加密後的 OOXML 被包在 CFB 容器裡，副檔名仍是 .docx；ZIP 簽章不存在。',
    declared: declare({}),
    bytes: Buffer.concat([
      compoundFile(['EncryptionInfo', 'EncryptedPackage']),
      Buffer.from('CORPUS PLACEHOLDER: an encrypted-package container shape, with no ciphertext.', 'ascii'),
    ]),
  })

  add({
    name: 'truncated-package',
    category: 'refuse',
    features: ['damaged-package'],
    expectation: 'refuse',
    note: '一份正常的 .docx 被截掉後面 40%，中央目錄不見了。',
    declared: declare({}),
    bytes: (() => {
      const whole = docx({ body: [heading('會被截斷的文件'), filler(10, '段落')].join('') })
      return whole.subarray(0, Math.floor(whole.length * 0.6))
    })(),
  })

  add({
    name: 'not-a-package',
    category: 'refuse',
    features: ['damaged-package'],
    expectation: 'refuse',
    note: '副檔名是 .docx，內容是決定性產生的位元組；連 ZIP 都不是。',
    declared: declare({}),
    bytes: (() => {
      const bytes = Buffer.alloc(4096)
      /* A fixed linear congruential sequence, so the file is the same on every machine. */
      let state = 0x2026_0912 >>> 0
      for (let index = 0; index < bytes.length; index += 1) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0
        bytes[index] = state >>> 24
      }
      return bytes
    })(),
  })

  return documents
}

export function buildFixtures() {
  return corpus().map((fixture) => {
    const extension = fixture.extension ?? 'docx'
    return {
      mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ...fixture,
      extension,
      filename: `${fixture.name}.${extension}`,
      byteLength: fixture.bytes.length,
      sha256: createHash('sha256').update(fixture.bytes).digest('hex'),
    }
  })
}

/** Categories in the order the record prints them. */
export const fixtureCategories = ['text', 'table', 'list', 'pagination', 'furniture', 'media', 'hard', 'scale', 'refuse']
