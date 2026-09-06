<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Download, HardDrive, ShieldCheck, Trash2, TriangleAlert, Upload } from '@lucide/vue'
import LocalAssetRow from '@/components/LocalAssetRow.vue'
import { Button } from '@/components/ui/button'
import { localAssetCopy, localAssetErrorMessage, localAssetKindLabel } from '@/features/shell/local-assets/content'
import type { LocalAssetRecord } from '@/features/shell/local-assets/schema'
import { formatAssetBytes } from '@/features/shell/local-assets/usage'
import type { LocaleCode } from '@/features/tools/catalog'

const props = defineProps<{ locale: LocaleCode }>()
const { records, unreadable, usage, error, busy, ready, remove, rename, clearAll, exportAll, importFile } = useLocalAssets()

const copy = computed(() => localAssetCopy(props.locale))
const failure = computed(() => error.value ? localAssetErrorMessage(error.value, props.locale) : null)
const usedKinds = computed(() => usage.value.byKind.filter(kind => kind.count > 0))
const hasAssets = computed(() => records.value.length > 0)
/** The percentage is decoration; the same numbers are written out next to it. */
const quotaPercent = computed(() => Math.min(100, Math.round((usage.value.usedRatio ?? 0) * 100)))

const status = ref('')
const pendingDelete = ref<string | null>(null)
const pendingClear = ref(false)
const statusRegion = ref<HTMLElement | null>(null)

function size(bytes: number) {
  return formatAssetBytes(bytes, props.locale)
}

function describeAsset(record: LocalAssetRecord) {
  const updated = new Intl.DateTimeFormat(props.locale === 'en' ? 'en' : 'zh-TW', { dateStyle: 'medium' })
    .format(new Date(record.updatedAt))

  return [
    localAssetKindLabel(record.kind, props.locale),
    `${copy.value.sizeLabel} ${size(record.bytes)}`,
    `${copy.value.updatedLabel} ${updated}`,
  ].join(' · ')
}

/** A destructive control asks first, and the answer is where the keyboard lands. */
async function askDelete(id: string) {
  pendingClear.value = false
  pendingDelete.value = id
  await focusConfirmation('confirm-delete')
}

async function askClear() {
  pendingDelete.value = null
  pendingClear.value = true
  await focusConfirmation('confirm-clear')
}

async function focusConfirmation(action: string) {
  await nextTick()
  document.querySelector<HTMLElement>(`[data-asset-action="${action}"]`)?.focus()
}

function cancelPending() {
  pendingDelete.value = null
  pendingClear.value = false
}

/** After a row disappears the focus has nowhere to return to, so it moves to what changed. */
async function announce(message: string) {
  status.value = message
  await nextTick()
  statusRegion.value?.focus()
}

async function confirmDelete(id: string, name: string | null) {
  pendingDelete.value = null
  await remove(id)
  await announce(name ? copy.value.statusDeleted(name) : copy.value.statusCleared)
}

async function confirmRename(id: string, name: string) {
  await rename(id, name)
  await announce(copy.value.statusRenamed(name))
}

async function confirmClear() {
  pendingClear.value = false
  await clearAll()
  await announce(copy.value.statusCleared)
}

async function runExport() {
  const fileName = await exportAll()
  if (fileName) await announce(copy.value.statusExported(fileName))
}

async function runImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const outcome = await importFile(file)
  // The same file can be chosen again after a failure only if the input is cleared.
  input.value = ''
  if (outcome) await announce(copy.value.statusImported(outcome.added, outcome.replaced))
}
</script>

<template>
  <section class="local-assets" :aria-busy="busy ? 'true' : 'false'" :aria-label="copy.title">
    <p class="local-assets__boundary">
      <ShieldCheck :size="18" aria-hidden="true" />
      <span>{{ copy.boundary }}</span>
    </p>

    <div v-if="failure" class="local-assets__error" role="alert">
      <TriangleAlert :size="18" aria-hidden="true" />
      <div>
        <p class="local-assets__error-title">{{ failure.title }}</p>
        <p>{{ failure.recovery }}</p>
      </div>
    </div>

    <section class="local-assets__usage" :aria-label="copy.usageTitle">
      <h2>{{ copy.usageTitle }}</h2>
      <p class="local-assets__total">
        <HardDrive :size="18" aria-hidden="true" />
        <span>{{ copy.usageTotal }}：{{ size(usage.totalBytes) }}</span>
      </p>
      <ul v-if="usedKinds.length" class="local-assets__kinds">
        <li v-for="kind in usedKinds" :key="kind.kind">
          {{ localAssetKindLabel(kind.kind, props.locale) }}：{{ kind.count }}／{{ size(kind.bytes) }}
        </li>
      </ul>
      <template v-if="usage.quotaBytes !== null && usage.deviceUsedBytes !== null">
        <p class="local-assets__quota">{{ copy.usageQuota(size(usage.deviceUsedBytes), size(usage.quotaBytes)) }}</p>
        <div class="local-assets__quota-bar" aria-hidden="true">
          <span :style="{ width: `${quotaPercent}%` }" />
        </div>
      </template>
      <p v-else class="local-assets__quota">{{ copy.usageNoEstimate }}</p>
    </section>

    <div class="local-assets__actions">
      <div v-if="hasAssets" class="local-assets__action">
        <Button variant="outline" data-asset-action="export" @click="runExport">
          <Download :size="17" aria-hidden="true" />
          {{ copy.exportAction }}
        </Button>
        <p class="field-help">{{ copy.exportHint }}</p>
      </div>
      <div class="local-assets__action local-assets__import">
        <label for="local-asset-import">
          <Upload :size="17" aria-hidden="true" />
          {{ copy.importAction }}
        </label>
        <input
          id="local-asset-import"
          type="file"
          accept="application/json,.json"
          @change="runImport"
        >
        <p class="field-help">{{ copy.importHint }}</p>
      </div>
      <div v-if="hasAssets" class="local-assets__action">
        <Button variant="destructive" data-asset-action="clear" @click="askClear">
          <Trash2 :size="17" aria-hidden="true" />
          {{ copy.clearAll }}
        </Button>
      </div>
    </div>

    <div v-if="pendingClear" class="local-assets__confirm">
      <p>{{ copy.clearAllPrompt }}</p>
      <div class="local-assets__confirm-actions">
        <Button variant="destructive" data-asset-action="confirm-clear" @click="confirmClear">{{ copy.clearAllConfirm }}</Button>
        <Button variant="outline" data-asset-action="cancel-clear" @click="cancelPending">{{ copy.deleteCancel }}</Button>
      </div>
    </div>

    <p ref="statusRegion" class="local-assets__status" role="status" tabindex="-1">{{ status }}</p>

    <section class="local-assets__list" :aria-label="copy.listTitle">
      <h2>{{ copy.listTitle }}</h2>
      <template v-if="hasAssets">
        <ul>
          <LocalAssetRow
            v-for="record in records"
            :id="record.id"
            :key="record.id"
            :locale="props.locale"
            :name="record.name"
            :meta="describeAsset(record)"
            :pending="pendingDelete === record.id"
            editable
            @ask="askDelete(record.id)"
            @confirm="confirmDelete(record.id, record.name)"
            @cancel="cancelPending"
            @rename="name => confirmRename(record.id, name)"
          />
        </ul>
      </template>
      <template v-else-if="ready">
        <p class="local-assets__empty">{{ copy.empty }}</p>
        <p class="field-help">{{ copy.emptyHint }}</p>
      </template>
    </section>

    <section v-if="unreadable.length" class="local-assets__unreadable" :aria-label="copy.unreadableTitle">
      <h2>{{ copy.unreadableTitle }}</h2>
      <ul>
        <LocalAssetRow
          v-for="item in unreadable"
          :id="item.id"
          :key="item.id"
          :locale="props.locale"
          :name="item.name ?? item.id"
          :meta="item.reason === 'corrupt' ? copy.unreadableCorrupt : copy.unreadableVersion"
          :pending="pendingDelete === item.id"
          :editable="false"
          @ask="askDelete(item.id)"
          @confirm="confirmDelete(item.id, item.name ?? item.id)"
          @cancel="cancelPending"
        />
      </ul>
    </section>
  </section>
</template>
