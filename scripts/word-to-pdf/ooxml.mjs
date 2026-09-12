/**
 * The OOXML parts a WordprocessingML package is made of.
 *
 * Every document in the T26 corpus is written here rather than saved out of
 * Word, for the same reason the T24 corpus was: a measurement is only
 * repeatable when the bytes it ran on can be rebuilt from this repository, and
 * no real document — nobody's letter, nobody's contract — may sit in a public
 * repository to make a conversion look good.
 *
 * The trade is stated plainly in the record: these documents are faithful to
 * ECMA-376 as a container and as markup, and they are not evidence about what
 * Word's own layout engine does with them. Everything the corpus claims is a
 * structure it declares, never a rendering it was compared against.
 *
 * References are to ECMA-376 Part 1, 5th edition (ISO/IEC 29500-1:2016).
 */
import { deflateSync } from 'node:zlib'
import { crc32 } from './zip.mjs'

/** A4 in twentieths of a point, the unit `w:pgSz` uses (§17.6.13). */
export const A4 = { width: 11906, height: 16838 }
export const LETTER = { width: 12240, height: 15840 }

const NS = [
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"',
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"',
  'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"',
  'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"',
  'xmlns:v="urn:schemas-microsoft-com:vml"',
  'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"',
  'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"',
  'mc:Ignorable="w14 wp14"',
].join(' ')

export function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** `xml:space="preserve"` everywhere: a converter that trims runs changes the text. */
export function text(value) {
  return `<w:t xml:space="preserve">${escapeXml(value)}</w:t>`
}

export function run(value, properties = '') {
  return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ''}${text(value)}</w:r>`
}

export function paragraph(content, properties = '') {
  return `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ''}${content}</w:p>`
}

/** A plain body paragraph carrying one sentinel string. */
export function line(value, { paragraphProperties = '', runProperties = '' } = {}) {
  return paragraph(run(value, runProperties), paragraphProperties)
}

export function heading(value, level = 1) {
  return paragraph(run(value, '<w:b/><w:sz w:val="32"/>'), `<w:pStyle w:val="Heading${level}"/><w:keepNext/>`)
}

/**
 * The break Word caches when it lays a document out (§17.3.3.13). It is not an
 * instruction — it records where the last renderer happened to break — but a
 * converter that does not paginate itself has nothing else to go on, so whether
 * a document carries these decides what such a converter can do.
 *
 * It is a run, and Word writes it as the first run of the paragraph that starts
 * the new page, so that is where the corpus puts it.
 */
export function cachedPageBreak() {
  return '<w:r><w:lastRenderedPageBreak/></w:r>'
}

export function pageBreak() {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
}

/**
 * `w:sectPr` (§17.6.18). Placed inside a paragraph's `w:pPr` it ends a section;
 * placed at the end of `w:body` it describes the last one.
 */
export function sectionProperties({
  size = A4,
  orientation = 'portrait',
  columns = 1,
  headerRelationships = {},
  footerRelationships = {},
  titlePage = false,
  margin = { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720 },
  type,
} = {}) {
  const landscape = orientation === 'landscape'
  const width = landscape ? size.height : size.width
  const height = landscape ? size.width : size.height
  const references = [
    ...Object.entries(headerRelationships).map(([kind, id]) => `<w:headerReference w:type="${kind}" r:id="${id}"/>`),
    ...Object.entries(footerRelationships).map(([kind, id]) => `<w:footerReference w:type="${kind}" r:id="${id}"/>`),
  ].join('')
  return [
    references,
    type ? `<w:type w:val="${type}"/>` : '',
    `<w:pgSz w:w="${width}" w:h="${height}"${landscape ? ' w:orient="landscape"' : ''}/>`,
    `<w:pgMar w:top="${margin.top}" w:right="${margin.right}" w:bottom="${margin.bottom}" w:left="${margin.left}" w:header="${margin.header}" w:footer="${margin.footer}" w:gutter="0"/>`,
    columns > 1 ? `<w:cols w:num="${columns}" w:space="425" w:equalWidth="1"/>` : '<w:cols w:space="425"/>',
    titlePage ? '<w:titlePg/>' : '',
    '<w:docGrid w:linePitch="360"/>',
  ].join('')
}

/** Ends a section: an empty paragraph whose properties carry the section's own `w:sectPr`. */
export function sectionBreak(options) {
  return `<w:p><w:pPr><w:sectPr>${sectionProperties(options)}</w:sectPr></w:pPr></w:p>`
}

const CELL_BORDERS = '<w:tcBorders><w:top w:val="single" w:sz="4" w:color="333333"/><w:left w:val="single" w:sz="4" w:color="333333"/><w:bottom w:val="single" w:sz="4" w:color="333333"/><w:right w:val="single" w:sz="4" w:color="333333"/></w:tcBorders>'

export function cell(content, { width = 2400, span, merge, shade } = {}) {
  const properties = [
    `<w:tcW w:w="${width}" w:type="dxa"/>`,
    span ? `<w:gridSpan w:val="${span}"/>` : '',
    merge ? `<w:vMerge${merge === 'restart' ? ' w:val="restart"' : ''}/>` : '',
    shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : '',
    CELL_BORDERS,
  ].join('')
  const body = typeof content === 'string' ? line(content) : content.join('')
  return `<w:tc><w:tcPr>${properties}</w:tcPr>${body || '<w:p/>'}</w:tc>`
}

export function row(cells, { header = false, height } = {}) {
  const properties = [
    header ? '<w:tblHeader/>' : '',
    height ? `<w:trHeight w:val="${height}"/>` : '',
  ].join('')
  return `<w:tr>${properties ? `<w:trPr>${properties}</w:trPr>` : ''}${cells.join('')}</w:tr>`
}

export function table(rows, { width = 9600, columns = [] } = {}) {
  const grid = columns.length
    ? `<w:tblGrid>${columns.map(value => `<w:gridCol w:w="${value}"/>`).join('')}</w:tblGrid>`
    : ''
  const properties = [
    `<w:tblW w:w="${width}" w:type="dxa"/>`,
    '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="333333"/><w:left w:val="single" w:sz="4" w:color="333333"/><w:bottom w:val="single" w:sz="4" w:color="333333"/><w:right w:val="single" w:sz="4" w:color="333333"/><w:insideH w:val="single" w:sz="4" w:color="333333"/><w:insideV w:val="single" w:sz="4" w:color="333333"/></w:tblBorders>',
    '<w:tblLayout w:type="fixed"/>',
  ].join('')
  return `<w:tbl><w:tblPr>${properties}</w:tblPr>${grid}${rows.join('')}</w:tbl><w:p/>`
}

export function listItem(value, { numberingId = 1, level = 0 } = {}) {
  return line(value, { paragraphProperties: `<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${numberingId}"/></w:numPr>` })
}

/** An inline picture (§17.3.3.9 with DrawingML §20.4). `emu` is English Metric Units: 914400 per inch. */
export function inlineImage(relationshipId, { widthEmu = 2286000, heightEmu = 1143000, name = 'corpus-image', id = 1 } = {}) {
  return `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${widthEmu}" cy="${heightEmu}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${id}" name="${escapeXml(name)}" descr="${escapeXml(name)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${escapeXml(name)}" descr="${escapeXml(name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
}

/** A floating picture anchored to the page with square text wrapping (§20.4.2.3). */
export function anchoredImage(relationshipId, { widthEmu = 1600200, heightEmu = 1143000, name = 'floating-image', id = 50 } = {}) {
  return `<w:p><w:r><w:drawing><wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="251658240" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>2540000</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="${widthEmu}" cy="${heightEmu}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapSquare wrapText="bothSides"/><wp:docPr id="${id}" name="${escapeXml(name)}" descr="${escapeXml(name)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${escapeXml(name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>`
}

export function footnoteReference(id) {
  return `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteReference w:id="${id}"/></w:r>`
}

export function endnoteReference(id) {
  return `<w:r><w:rPr><w:rStyle w:val="EndnoteReference"/><w:vertAlign w:val="superscript"/></w:rPr><w:endnoteReference w:id="${id}"/></w:r>`
}

export function hyperlink(relationshipId, value) {
  return `<w:p><w:hyperlink r:id="${relationshipId}" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr>${text(value)}</w:r></w:hyperlink></w:p>`
}

/** A simple field (§17.16.19). `fallback` is the cached result a reader may show without evaluating. */
export function field(instruction, fallback) {
  return `<w:fldSimple w:instr="${escapeXml(instruction)}">${run(fallback)}</w:fldSimple>`
}

/** The complex-field form, which is what Word actually writes for PAGE in a footer. */
export function complexField(instruction, fallback) {
  return [
    '<w:r><w:fldChar w:fldCharType="begin"/></w:r>',
    `<w:r><w:instrText xml:space="preserve">${escapeXml(instruction)}</w:instrText></w:r>`,
    '<w:r><w:fldChar w:fldCharType="separate"/></w:r>',
    run(fallback),
    '<w:r><w:fldChar w:fldCharType="end"/></w:r>',
  ].join('')
}

const REVISION_DATE = '2026-09-01T09:00:00Z'

export function insertion(value, { id = 900, author = 'Reviewer A' } = {}) {
  return `<w:ins w:id="${id}" w:author="${escapeXml(author)}" w:date="${REVISION_DATE}">${run(value)}</w:ins>`
}

/** Deleted text uses `w:delText`, not `w:t`: a reader that treats them alike shows text the author removed. */
export function deletion(value, { id = 901, author = 'Reviewer A' } = {}) {
  return `<w:del w:id="${id}" w:author="${escapeXml(author)}" w:date="${REVISION_DATE}"><w:r><w:delText xml:space="preserve">${escapeXml(value)}</w:delText></w:r></w:del>`
}

export function commentRange(id, content) {
  return `<w:commentRangeStart w:id="${id}"/>${content}<w:commentRangeEnd w:id="${id}"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="${id}"/></w:r>`
}

/** A structured document tag: a content control (§17.5.2). */
export function contentControl(alias, content) {
  return `<w:sdt><w:sdtPr><w:alias w:val="${escapeXml(alias)}"/><w:tag w:val="${escapeXml(alias)}"/><w:id w:val="1200"/><w:text/></w:sdtPr><w:sdtContent>${content}</w:sdtContent></w:sdt>`
}

/**
 * An OMML equation (§22.1). Written as a fraction with a superscript so a
 * converter that drops the maths namespace loses something visible rather than
 * something subtle.
 */
export function equation(numerator, denominator, exponentBase, exponent) {
  return `<w:p><m:oMathPara><m:oMath><m:f><m:fPr><m:ctrlPr/></m:fPr><m:num><m:r><m:t>${escapeXml(numerator)}</m:t></m:r></m:num><m:den><m:r><m:t>${escapeXml(denominator)}</m:t></m:r></m:den></m:f><m:sSup><m:e><m:r><m:t>${escapeXml(exponentBase)}</m:t></m:r></m:e><m:sup><m:r><m:t>${escapeXml(exponent)}</m:t></m:r></m:sup></m:sSup></m:oMath></m:oMathPara></w:p>`
}

/**
 * A text box, written the way Word writes one: a DrawingML shape with a VML
 * fallback inside `mc:AlternateContent` (§v. Part 3 markup compatibility).
 * A reader that understands neither branch silently loses the text.
 */
export function textBox(value) {
  return `<w:p><w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="3200400" cy="1143000"/><wp:docPr id="70" name="TextBox 70"/><a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvSpPr txBox="1"/><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="3200400" cy="1143000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="EEF3FF"/></a:solidFill></wps:spPr><wps:txbx><w:txbxContent>${line(value)}</w:txbxContent></wps:txbx><wps:bodyPr rot="0" vert="horz" wrap="square" anchor="t"/></wps:wsp></a:graphicData></a:graphic></wp:inline></w:drawing></mc:Choice><mc:Fallback><w:pict><v:shape id="TextBox70" style="width:252pt;height:90pt" fillcolor="#EEF3FF" stroked="f"><v:textbox><w:txbxContent>${line(value)}</w:txbxContent></v:textbox></v:shape></w:pict></mc:Fallback></mc:AlternateContent></w:r></w:p>`
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${NS}>
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Microsoft JhengHei" w:cs="Calibri"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-US" w:eastAsia="zh-TW"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/><w:spacing w:before="200" w:after="100"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/><w:contextualSpacing/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Header"><w:name w:val="header"/><w:basedOn w:val="Normal"/><w:pPr><w:tabs><w:tab w:val="center" w:pos="4513"/><w:tab w:val="right" w:pos="9026"/></w:tabs><w:spacing w:after="0"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:tabs><w:tab w:val="center" w:pos="4513"/><w:tab w:val="right" w:pos="9026"/></w:tabs><w:spacing w:after="0"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="FootnoteText"><w:name w:val="footnote text"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="20"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="EndnoteText"><w:name w:val="endnote text"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="20"/></w:rPr></w:style>
  <w:style w:type="character" w:styleId="FootnoteReference"><w:name w:val="footnote reference"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>
  <w:style w:type="character" w:styleId="EndnoteReference"><w:name w:val="endnote reference"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>
  <w:style w:type="character" w:styleId="CommentReference"><w:name w:val="annotation reference"/><w:rPr><w:sz w:val="16"/></w:rPr></w:style>
  <w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>
</w:styles>
`

const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering ${NS}>
  <w:abstractNum w:abstractNumId="0">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="●"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>
    <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="○"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr></w:lvl>
    <w:lvl w:ilvl="2"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="▪"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="2160" w:hanging="360"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:multiLevelType w:val="multilevel"/>
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>
    <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1.%2"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="1440" w:hanging="432"/></w:pPr></w:lvl>
    <w:lvl w:ilvl="2"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%1.%2.%3"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="2160" w:hanging="504"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>
`

const SETTINGS_BASE = [
  '<w:zoom w:percent="100"/>',
  '<w:defaultTabStop w:val="480"/>',
  '<w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr>',
  '<w:endnotePr><w:endnote w:id="-1"/><w:endnote w:id="0"/></w:endnotePr>',
  '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>',
]

function settingsPart(extra = []) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:settings ${NS}>${[...SETTINGS_BASE, ...extra].join('')}</w:settings>\n`
}

function notesPart(element, notes) {
  const separators = [
    `<w:${element} w:type="separator" w:id="-1"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:separator/></w:r></w:p></w:${element}>`,
    `<w:${element} w:type="continuationSeparator" w:id="0"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:continuationSeparator/></w:r></w:p></w:${element}>`,
  ].join('')
  const body = notes.map(note => `<w:${element} w:id="${note.id}"><w:p><w:pPr><w:pStyle w:val="${element === 'footnote' ? 'FootnoteText' : 'EndnoteText'}"/></w:pPr><w:r><w:rPr><w:rStyle w:val="${element === 'footnote' ? 'Footnote' : 'Endnote'}Reference"/></w:rPr><w:${element}Ref/></w:r>${run(` ${note.text}`)}</w:p></w:${element}>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:${element}s ${NS}>${separators}${body}</w:${element}s>\n`
}

function commentsPart(comments) {
  const body = comments.map(comment => `<w:comment w:id="${comment.id}" w:author="${escapeXml(comment.author)}" w:date="${REVISION_DATE}" w:initials="${escapeXml(comment.initials)}">${line(comment.text)}</w:comment>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:comments ${NS}>${body}</w:comments>\n`
}

export function headerPart(content) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr ${NS}>${content}</w:hdr>\n`
}

export function footerPart(content) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr ${NS}>${content}</w:ftr>\n`
}

const RELATIONSHIP_TYPES = {
  styles: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles',
  numbering: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering',
  settings: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings',
  footnotes: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes',
  endnotes: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes',
  comments: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments',
  header: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/header',
  footer: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer',
  image: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
  hyperlink: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
  vbaProject: 'http://schemas.microsoft.com/office/2006/relationships/vbaProject',
}

const OVERRIDE_TYPES = {
  'word/document.xml': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
  'word/styles.xml': 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml',
  'word/numbering.xml': 'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml',
  'word/settings.xml': 'application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml',
  'word/footnotes.xml': 'application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml',
  'word/endnotes.xml': 'application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml',
  'word/comments.xml': 'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml',
}

/**
 * Assembles one WordprocessingML package.
 *
 * `body` is the document body without its trailing `w:sectPr`; `section`
 * describes the last section. Optional parts appear only when asked for, so a
 * fixture that claims to be minimal really is.
 */
export function buildDocx({
  body,
  section = {},
  numbering = false,
  footnotes = [],
  endnotes = [],
  comments = [],
  headers = [],
  footers = [],
  images = [],
  hyperlinks = [],
  settingsExtra = [],
  macroEnabled = false,
} = {}) {
  const parts = []
  const relationships = []
  const overrides = new Map()
  const defaults = new Map([
    ['rels', 'application/vnd.openxmlformats-package.relationships+xml'],
    ['xml', 'application/xml'],
  ])

  let nextRelationship = 1
  const relate = (target, kind, mode) => {
    const id = `rId${nextRelationship}`
    nextRelationship += 1
    relationships.push(`<Relationship Id="${id}" Type="${RELATIONSHIP_TYPES[kind]}" Target="${escapeXml(target)}"${mode ? ` TargetMode="${mode}"` : ''}/>`)
    return id
  }

  const addPart = (name, data, { store = false } = {}) => {
    parts.push({ name, data, store })
    if (OVERRIDE_TYPES[name]) overrides.set(name, OVERRIDE_TYPES[name])
  }

  addPart('word/styles.xml', STYLES)
  relate('styles.xml', 'styles')

  addPart('word/settings.xml', settingsPart(settingsExtra))
  relate('settings.xml', 'settings')

  if (numbering) {
    addPart('word/numbering.xml', NUMBERING)
    relate('numbering.xml', 'numbering')
  }

  if (footnotes.length) {
    addPart('word/footnotes.xml', notesPart('footnote', footnotes))
    relate('footnotes.xml', 'footnotes')
  }

  if (endnotes.length) {
    addPart('word/endnotes.xml', notesPart('endnote', endnotes))
    relate('endnotes.xml', 'endnotes')
  }

  if (comments.length) {
    addPart('word/comments.xml', commentsPart(comments))
    relate('comments.xml', 'comments')
  }

  const headerIds = {}
  headers.forEach((entry, index) => {
    const name = `word/header${index + 1}.xml`
    addPart(name, headerPart(entry.content))
    overrides.set(name, 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml')
    headerIds[entry.kind] = relate(`header${index + 1}.xml`, 'header')
  })

  const footerIds = {}
  footers.forEach((entry, index) => {
    const name = `word/footer${index + 1}.xml`
    addPart(name, footerPart(entry.content))
    overrides.set(name, 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml')
    footerIds[entry.kind] = relate(`footer${index + 1}.xml`, 'footer')
  })

  const imageIds = {}
  images.forEach((image) => {
    const name = `word/media/${image.name}`
    addPart(name, image.data, { store: true })
    defaults.set(image.name.split('.').pop(), image.mediaType)
    imageIds[image.key] = relate(`media/${image.name}`, 'image')
  })

  const hyperlinkIds = {}
  hyperlinks.forEach((link) => {
    hyperlinkIds[link.key] = relate(link.target, 'hyperlink', 'External')
  })

  if (macroEnabled) {
    /*
     * A VBA project is a CFB stream of compiled macro code. The corpus needs a
     * document that declares one so a converter can be watched refusing it; it
     * does not need code that runs, and would not be allowed to ship one.
     */
    const vba = Buffer.concat([
      Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]),
      Buffer.alloc(504),
      Buffer.from('CORPUS PLACEHOLDER: declares a VBA project, contains no macro code.', 'ascii'),
    ])
    addPart('word/vbaProject.bin', vba, { store: true })
    defaults.set('bin', 'application/vnd.ms-office.vbaProject')
    relate('vbaProject.bin', 'vbaProject')
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS}><w:body>${typeof body === 'function' ? body({ headerIds, footerIds, imageIds, hyperlinkIds }) : body}<w:sectPr>${sectionProperties({ ...section, headerRelationships: mapIds(section.headers, headerIds), footerRelationships: mapIds(section.footers, footerIds) })}</w:sectPr></w:body></w:document>
`
  addPart('word/document.xml', documentXml)
  overrides.set('word/document.xml', macroEnabled
    ? 'application/vnd.ms-word.document.macroEnabled.main+xml'
    : OVERRIDE_TYPES['word/document.xml'])

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${[...defaults].map(([extension, type]) => `<Default Extension="${extension}" ContentType="${type}"/>`).join('')}${[...overrides].map(([name, type]) => `<Override PartName="/${name}" ContentType="${type}"/>`).join('')}</Types>
`

  const packageRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdDocument" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>
`

  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join('')}</Relationships>
`

  return {
    entries: [
      { name: '[Content_Types].xml', data: contentTypes },
      { name: '_rels/.rels', data: packageRels },
      { name: 'word/_rels/document.xml.rels', data: documentRels },
      ...parts,
    ],
    ids: { headerIds, footerIds, imageIds, hyperlinkIds },
  }
}

function mapIds(kinds, ids) {
  if (!kinds) return {}
  return Object.fromEntries(kinds.map(kind => [kind, ids[kind]]).filter(([, id]) => id))
}

/**
 * A PNG with no dependency beyond zlib, so the corpus's images are as
 * reproducible as its markup. `draw(x, y)` returns `[r, g, b, a]`.
 */
export function png(width, height, draw) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  let cursor = 0
  for (let y = 0; y < height; y += 1) {
    raw[cursor] = 0
    cursor += 1
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = draw(x, y)
      raw[cursor] = r
      raw[cursor + 1] = g
      raw[cursor + 2] = b
      raw[cursor + 3] = a
      cursor += 4
    }
  }

  const chunk = (type, data) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length, 0)
    const typed = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const checksum = Buffer.alloc(4)
    checksum.writeUInt32BE(crc32(typed), 0)
    return Buffer.concat([length, typed, checksum])
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
