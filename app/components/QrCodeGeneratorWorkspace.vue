<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  describeQrPreview,
  describeQrReady,
  getQrCopy,
  qrColorMessage,
  qrPendingMessage,
  qrTooLongMessage,
  securityLabel,
} from '@/features/tools/qr-code-generator/content'
import { checkQrColors, qrDefaultColors, type QrColors } from '@/features/tools/qr-code-generator/domain/colors'
import { encodeQr } from '@/features/tools/qr-code-generator/domain/encode'
import {
  buildQrPayload,
  emptyQrFields,
  qrContentKinds,
  wifiSecurities,
  type QrContentKind,
} from '@/features/tools/qr-code-generator/domain/payload'
import {
  buildQrSvg,
  qrDownloadNames,
  qrPathData,
  qrViewBoxSize,
  rasterizeQr,
} from '@/features/tools/qr-code-generator/domain/render'

const { locale } = useAppLocale()
const text = computed(() => getQrCopy(locale.value))

/**
 * Everything the visitor types lives here and nowhere else: not in the URL,
 * not in storage (ADR-0001). Each kind keeps its own fields, so switching from
 * Wi-Fi to a link and back loses nothing, and closing the tab loses everything.
 */
const kind = ref<QrContentKind>('url')
const fields = reactive(emptyQrFields())
const colors = reactive<QrColors>({ ...qrDefaultColors })
// Shown by default: one mistyped character and the printed code cannot connect anyone.
const passwordVisible = ref(true)
const downloadFailed = ref(false)

const payload = computed(() => buildQrPayload(kind.value, fields))
const encoding = computed(() => payload.value.state === 'ready' ? encodeQr(payload.value.payload) : undefined)
const matrix = computed(() => encoding.value?.state === 'ready' ? encoding.value.matrix : undefined)
const colorCheck = computed(() => checkQrColors(colors))
const colorsChanged = computed(() => colors.foreground !== qrDefaultColors.foreground || colors.background !== qrDefaultColors.background)

const contentError = computed(() => encoding.value?.state === 'too-long' ? qrTooLongMessage(locale.value) : '')
const colorError = computed(() => colorCheck.value.state === 'blocked' ? qrColorMessage(colorCheck.value.problem, locale.value) : '')
/** A code can be downloaded only when it says exactly what the fields say, in colours a phone can read. */
const ready = computed(() => Boolean(matrix.value) && colorCheck.value.state === 'ok')

const state = computed(() => {
  if (encoding.value?.state === 'too-long') return 'too-long'
  if (payload.value.state !== 'ready') return payload.value.state
  return colorCheck.value.state === 'ok' ? 'ready' : 'blocked-colors'
})
const status = computed(() => {
  if (payload.value.state === 'empty') return text.value.previewEmpty
  if (payload.value.state === 'pending') return qrPendingMessage(payload.value.reason, locale.value)
  return ready.value ? describeQrReady(kind.value, locale.value) : ''
})

const viewBoxSize = computed(() => matrix.value ? qrViewBoxSize(matrix.value) : 0)
const pathData = computed(() => matrix.value ? qrPathData(matrix.value) : '')
const previewLabel = computed(() => describeQrPreview(kind.value, locale.value))
const encodedUrl = computed(() => kind.value === 'url' && payload.value.state === 'ready' ? payload.value.payload : '')

const contentDescribedBy = (helpId: string) => [helpId, contentError.value ? 'qr-content-error' : ''].filter(Boolean).join(' ')
const colorDescribedBy = computed(() => colorError.value ? 'qr-color-error' : undefined)

const kindLabels = computed<Record<QrContentKind, string>>(() => ({
  url: text.value.kindUrl,
  text: text.value.kindText,
  wifi: text.value.kindWifi,
}))

watch([payload, () => colors.foreground, () => colors.background], () => {
  downloadFailed.value = false
})

function resetColors() {
  Object.assign(colors, qrDefaultColors)
}

/** Hands a file this device made straight to the browser's own download. */
function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  // Revoked on the next task: some browsers still need the URL when the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

async function downloadPng() {
  if (!ready.value || !matrix.value) return
  const { width, height, pixels } = rasterizeQr(matrix.value, colors)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  const blob = context
    ? await new Promise<Blob | null>((resolve) => {
        context.putImageData(new ImageData(pixels, width, height), 0, 0)
        canvas.toBlob(resolve, 'image/png')
      })
    : null
  if (!blob) {
    downloadFailed.value = true
    return
  }
  saveFile(blob, qrDownloadNames.png)
}

function downloadSvg() {
  if (!ready.value || !matrix.value) return
  saveFile(new Blob([buildQrSvg(matrix.value, colors)], { type: 'image/svg+xml' }), qrDownloadNames.svg)
}
</script>

<template>
  <Card class="tool-workspace qr-code" :data-qr-state="state">
    <div class="qr-code__content">
      <fieldset class="qr-code__group">
        <legend>{{ text.kindLegend }}</legend>
        <div class="choice-group">
          <label v-for="option in qrContentKinds" :key="option" class="choice-option qr-code__kind">
            <input v-model="kind" type="radio" name="qr-content-kind" :value="option">
            <span>{{ kindLabels[option] }}</span>
          </label>
        </div>
      </fieldset>

      <div v-if="kind === 'url'" class="field-group qr-code__field">
        <label for="qr-url">{{ text.urlLabel }}</label>
        <Input
          id="qr-url"
          v-model="fields.url"
          type="text"
          inputmode="url"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          enterkeyhint="done"
          :aria-describedby="contentDescribedBy('qr-url-help')"
          :aria-invalid="Boolean(contentError)"
        />
        <p id="qr-url-help" class="field-help">{{ text.urlHint }}</p>
      </div>

      <div v-else-if="kind === 'text'" class="field-group qr-code__field">
        <label for="qr-text">{{ text.textLabel }}</label>
        <textarea
          id="qr-text"
          v-model="fields.text"
          class="ui-input qr-code__textarea"
          rows="4"
          autocomplete="off"
          :aria-describedby="contentDescribedBy('qr-text-help')"
          :aria-invalid="Boolean(contentError)"
        />
        <p id="qr-text-help" class="field-help">{{ text.textHint }}</p>
      </div>

      <template v-else>
        <div class="field-group qr-code__field">
          <label for="qr-wifi-ssid">{{ text.ssidLabel }}</label>
          <Input
            id="qr-wifi-ssid"
            v-model="fields.wifi.ssid"
            type="text"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            :aria-describedby="contentDescribedBy('qr-wifi-ssid-help')"
            :aria-invalid="Boolean(contentError)"
          />
          <p id="qr-wifi-ssid-help" class="field-help">{{ text.ssidHint }}</p>
        </div>

        <fieldset class="qr-code__group qr-code__field">
          <legend>{{ text.securityLegend }}</legend>
          <div class="choice-group">
            <label v-for="option in wifiSecurities" :key="option" class="choice-option qr-code__security">
              <input v-model="fields.wifi.security" type="radio" name="qr-wifi-security" :value="option">
              <span>{{ securityLabel(option, locale) }}</span>
            </label>
          </div>
        </fieldset>

        <div v-if="fields.wifi.security === 'wpa'" class="field-group qr-code__field">
          <label for="qr-wifi-password">{{ text.passwordLabel }}</label>
          <div class="qr-code__password">
            <Input
              id="qr-wifi-password"
              v-model="fields.wifi.password"
              :type="passwordVisible ? 'text' : 'password'"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              :aria-describedby="contentDescribedBy('qr-wifi-password-help')"
              :aria-invalid="Boolean(contentError)"
            />
            <Button type="button" variant="outline" aria-controls="qr-wifi-password" @click="passwordVisible = !passwordVisible">
              {{ passwordVisible ? text.hidePassword : text.showPassword }}
            </Button>
          </div>
          <p id="qr-wifi-password-help" class="field-help">{{ text.passwordHint }}</p>
        </div>
      </template>

      <p v-if="contentError" id="qr-content-error" class="field-error" role="alert">{{ contentError }}</p>
    </div>

    <section class="qr-code__preview" :aria-label="text.previewLabel">
      <div class="qr-code__stage" :class="{ 'qr-code__stage--empty': !matrix }">
        <svg
          v-if="matrix"
          class="qr-code__image"
          role="img"
          :aria-label="previewLabel"
          :viewBox="`0 0 ${viewBoxSize} ${viewBoxSize}`"
          shape-rendering="crispEdges"
        >
          <rect :width="viewBoxSize" :height="viewBoxSize" :fill="colors.background" />
          <path :fill="colors.foreground" :d="pathData" />
        </svg>
      </div>
      <div class="qr-code__actions">
        <Button type="button" :disabled="!ready" @click="downloadPng">{{ text.downloadPng }}</Button>
        <Button type="button" variant="outline" :disabled="!ready" @click="downloadSvg">{{ text.downloadSvg }}</Button>
      </div>
      <p class="qr-code__status" aria-live="polite">{{ status }}</p>
      <p v-if="encodedUrl" class="qr-code__encoded">
        <span class="qr-code__encoded-label">{{ text.encodedUrlLabel }}</span>
        <span class="qr-code__encoded-value" data-encoded-url>{{ encodedUrl }}</span>
      </p>
      <p v-if="downloadFailed" class="field-error qr-code__failed" role="alert">{{ text.downloadFailed }}</p>
      <p class="field-help qr-code__help">{{ text.downloadHelp }}</p>
      <p class="qr-code__reminder" data-scan-reminder>{{ text.scanReminder }}</p>
    </section>

    <fieldset class="qr-code__group qr-code__colors">
      <legend>{{ text.colorsLegend }}</legend>
      <div class="qr-code__swatches">
        <label class="qr-code__swatch" for="qr-foreground">
          <input
            id="qr-foreground"
            v-model="colors.foreground"
            type="color"
            :aria-describedby="colorDescribedBy"
            :aria-invalid="Boolean(colorError)"
          >
          <span>{{ text.foregroundLabel }}</span>
          <span class="qr-code__hex">{{ colors.foreground.toUpperCase() }}</span>
        </label>
        <label class="qr-code__swatch" for="qr-background">
          <input
            id="qr-background"
            v-model="colors.background"
            type="color"
            :aria-describedby="colorDescribedBy"
            :aria-invalid="Boolean(colorError)"
          >
          <span>{{ text.backgroundLabel }}</span>
          <span class="qr-code__hex">{{ colors.background.toUpperCase() }}</span>
        </label>
      </div>
      <p v-if="colorError" id="qr-color-error" class="field-error" role="alert">{{ colorError }}</p>
      <Button v-if="colorsChanged" type="button" variant="ghost" class="qr-code__reset" @click="resetColors">
        {{ text.resetColors }}
      </Button>
    </fieldset>

    <p class="qr-code__trademark">{{ text.trademark }}</p>
  </Card>
</template>

<style scoped>
.qr-code { display: grid; gap: 20px; grid-template-areas: "content" "preview" "colors" "trademark"; }
.qr-code__content { grid-area: content; display: grid; gap: 16px; min-width: 0; }
/* On a phone the code sits beside its two download buttons, so both fit above
   the bottom navigation together with the field; the notes follow below. */
.qr-code__preview {
  grid-area: preview;
  display: grid;
  grid-template-columns: 128px minmax(0, 1fr);
  grid-template-areas: "stage actions" "status status" "encoded encoded" "failed failed" "help help" "reminder reminder";
  column-gap: 16px;
  align-items: center;
  min-width: 0;
  padding: 16px;
  border: var(--rule) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-result-surface);
}
.qr-code__colors { grid-area: colors; }
.qr-code__trademark { grid-area: trademark; margin: 0; color: var(--color-muted-foreground); font-size: .75rem; }

.qr-code__group { margin: 0; padding: 0; border: 0; min-width: 0; }
.qr-code__group legend { margin-bottom: 8px; padding: 0; font-size: .86rem; font-weight: 700; }
.qr-code__textarea { min-height: 112px; padding-block: 10px; resize: vertical; line-height: 1.5; }
.qr-code__password { display: flex; gap: 8px; }
.qr-code__password :deep(.ui-input) { flex: 1 1 auto; min-width: 0; }
.qr-code__password .ui-button { flex: 0 0 auto; }

.qr-code__stage { grid-area: stage; display: grid; place-items: center; width: 100%; aspect-ratio: 1; }
.qr-code__stage--empty { border: 2px dashed var(--color-border-subtle); border-radius: var(--radius-md); }
.qr-code__image { display: block; width: 100%; height: 100%; }
.qr-code__actions { grid-area: actions; display: flex; flex-direction: column; gap: 8px; }
.qr-code__status { grid-area: status; margin: 12px 0 0; font-size: .86rem; font-weight: 700; }
.qr-code__status:empty { display: none; }
.qr-code__encoded { grid-area: encoded; display: flex; flex-direction: column; gap: 2px; margin: 8px 0 0; font-size: .78rem; }
.qr-code__encoded-label { color: var(--color-muted-foreground); }
.qr-code__encoded-value { font-family: var(--font-mono); overflow-wrap: anywhere; }
.qr-code__failed { grid-area: failed; }
.qr-code__help { grid-area: help; }
.qr-code__reminder { grid-area: reminder; margin: 10px 0 0; padding-top: 10px; border-top: 1px solid var(--color-border-subtle); font-size: .8rem; font-weight: 700; }

.qr-code__swatches { display: flex; flex-wrap: wrap; gap: 12px; }
.qr-code__swatch { display: inline-flex; align-items: center; gap: 10px; min-height: 44px; font-size: .86rem; font-weight: 700; cursor: pointer; }
.qr-code__swatch input { width: 44px; height: 44px; flex: 0 0 44px; padding: 2px; border: var(--rule) solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); cursor: pointer; }
.qr-code__swatch input[aria-invalid="true"] { border-color: var(--color-destructive); }
.qr-code__swatch input:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }
.qr-code__hex { color: var(--color-muted-foreground); font-family: var(--font-mono); font-size: .78rem; font-weight: 400; }
.qr-code__reset { margin-top: 8px; padding-inline: 0; text-decoration: underline; }

@media (min-width: 768px) {
  .qr-code { grid-template-columns: minmax(0, 1fr) minmax(220px, 280px); grid-template-areas: "content preview" "colors preview" "trademark trademark"; align-items: start; }
  /* Beside the fields there is room for one centred column: code, then what to do with it. */
  .qr-code__preview { grid-template-columns: minmax(0, 1fr); grid-template-areas: "stage" "status" "encoded" "actions" "failed" "help" "reminder"; justify-items: center; text-align: center; }
  .qr-code__stage { width: min(220px, 100%); }
  .qr-code__actions { flex-flow: row wrap; justify-content: center; margin-top: 12px; }
}
</style>
