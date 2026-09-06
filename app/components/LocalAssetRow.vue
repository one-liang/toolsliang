<script setup lang="ts">
import { Pencil, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { localAssetCopy } from '@/features/shell/local-assets/content'
import type { LocaleCode } from '@/features/tools/catalog'
import { computed, nextTick, ref } from 'vue'

/**
 * One deletable row of the asset manager, whether the record is readable or
 * damaged. Deleting always asks first, and the confirmation lives in the row so
 * the question stays next to the thing it is about.
 */
const props = defineProps<{
  locale: LocaleCode
  id: string
  name: string
  meta: string
  pending: boolean
  /** A record this build cannot read keeps its delete control and loses the rest. */
  editable: boolean
}>()

const emit = defineEmits<{ ask: [], confirm: [], cancel: [], rename: [name: string] }>()
const copy = computed(() => localAssetCopy(props.locale))
const editing = ref(false)
const draftName = ref('')
const fieldId = computed(() => `local-asset-name-${props.id}`)
const canSave = computed(() => draftName.value.trim().length > 0)

async function startRename() {
  draftName.value = props.name
  editing.value = true
  await nextTick()
  document.getElementById(fieldId.value)?.focus()
}

/** Reached from both the submit event and the button click; the guard keeps it to one rename. */
function saveName() {
  if (!editing.value || !canSave.value) return

  editing.value = false
  emit('rename', draftName.value.trim())
}
</script>

<template>
  <li class="local-asset">
    <div class="local-asset__body">
      <p class="local-asset__name">{{ props.name }}</p>
      <p class="local-asset__meta">{{ props.meta }}</p>
    </div>
    <div class="local-asset__actions">
      <Button
        v-if="props.editable"
        variant="ghost"
        size="icon"
        data-asset-action="rename"
        :aria-label="copy.renameLabel(props.name)"
        @click="startRename"
      >
        <Pencil :size="18" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        data-asset-action="delete"
        :aria-label="copy.deleteLabel(props.name)"
        @click="emit('ask')"
      >
        <Trash2 :size="18" aria-hidden="true" />
      </Button>
    </div>

    <form v-if="editing" class="local-asset__rename" @submit.prevent="saveName">
      <label :for="fieldId">{{ copy.nameFieldLabel }}</label>
      <input
        :id="fieldId"
        v-model="draftName"
        class="ui-input"
        data-asset-field="name"
        type="text"
        maxlength="80"
        autocomplete="off"
      >
      <div class="local-asset__rename-actions">
        <Button type="submit" data-asset-action="save-name" :disabled="!canSave" @click="saveName">{{ copy.renameSave }}</Button>
        <Button type="button" variant="outline" data-asset-action="cancel-name" @click="editing = false">
          {{ copy.deleteCancel }}
        </Button>
      </div>
    </form>
    <div v-if="props.pending" class="local-assets__confirm">
      <p>{{ copy.deletePrompt(props.name) }}</p>
      <div class="local-assets__confirm-actions">
        <Button variant="destructive" data-asset-action="confirm-delete" @click="emit('confirm')">
          {{ copy.deleteConfirm }}
        </Button>
        <Button variant="outline" data-asset-action="cancel-delete" @click="emit('cancel')">
          {{ copy.deleteCancel }}
        </Button>
      </div>
    </div>
  </li>
</template>
