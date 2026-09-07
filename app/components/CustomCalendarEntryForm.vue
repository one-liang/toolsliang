<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import {
  customEntryIssueMessage,
  customEntryMarkHints,
  customEntryMarkLabels,
  getCustomCalendarCopy,
} from '@/features/tools/custom-calendar/content'
import {
  customEntryMarks,
  type CustomCalendarEntry,
  type CustomCalendarEntryDraft,
  type CustomEntryField,
  type CustomEntryIssue,
} from '@/features/tools/custom-calendar/domain/entries'
import type { LocaleCode } from '@/features/tools/catalog'

/**
 * The form is the only way an entry is created or changed, and it is complete
 * without a pointer: native date inputs, a radio group for what the day counts
 * as, and one error list tied to the fields it refuses. Nothing typed here
 * leaves the form until the visitor saves, and saving only reaches the device.
 */
const props = defineProps<{
  locale: LocaleCode
  date: string
  entry?: CustomCalendarEntry
  issues: CustomEntryIssue[]
  busy: boolean
}>()

const emit = defineEmits<{
  submit: [draft: CustomCalendarEntryDraft]
  cancel: []
}>()

const text = computed(() => getCustomCalendarCopy(props.locale))
const draft = ref<CustomCalendarEntryDraft>(startingDraft())
const marks = customEntryMarks.map(mark => ({
  value: mark,
  label: customEntryMarkLabels[mark][props.locale],
  hint: customEntryMarkHints[mark][props.locale],
}))

watch(() => [props.entry?.id, props.date], () => {
  draft.value = startingDraft()
})

function startingDraft(): CustomCalendarEntryDraft {
  const entry = props.entry
  return entry
    ? { startDate: entry.startDate, endDate: entry.endDate, mark: entry.mark, title: entry.title, note: entry.note }
    : { startDate: props.date, endDate: props.date, mark: 'note', title: '', note: '' }
}

function messagesFor(field: CustomEntryField) {
  return props.issues.filter(issue => issue.field === field).map(issue => customEntryIssueMessage(issue, props.locale))
}

function invalid(field: CustomEntryField) {
  return props.issues.some(issue => issue.field === field) ? 'true' : undefined
}

/** An end date follows the start until the visitor moves it themselves. */
function changeStart(value: string) {
  const sameDay = draft.value.endDate === draft.value.startDate
  draft.value.startDate = value
  if (sameDay || draft.value.endDate < value) draft.value.endDate = value
}
</script>

<template>
  <form class="custom-calendar-form" novalidate @submit.prevent="emit('submit', { ...draft })">
    <h3 class="custom-calendar-form__legend">{{ props.entry ? text.formEditLegend : text.formNewLegend }}</h3>

    <div v-if="props.issues.length" class="custom-calendar-form__error" role="alert">
      <p class="custom-calendar-form__error-title">{{ text.formErrorTitle }}</p>
      <ul>
        <li v-for="issue in props.issues" :key="`${issue.field}-${issue.code}`">
          {{ customEntryIssueMessage(issue, props.locale) }}
        </li>
      </ul>
    </div>

    <div class="custom-calendar-field">
      <label for="custom-entry-title">{{ text.formTitleLabel }}</label>
      <input
        id="custom-entry-title"
        v-model="draft.title"
        class="ui-input"
        type="text"
        autocomplete="off"
        :aria-invalid="invalid('title')"
        aria-describedby="custom-entry-title-help"
      >
      <p id="custom-entry-title-help" class="field-help">
        {{ text.formTitleHint }}
        <span v-for="message in messagesFor('title')" :key="message" class="custom-calendar-field__error">{{ message }}</span>
      </p>
    </div>

    <fieldset class="custom-calendar-field custom-calendar-marks">
      <legend>{{ text.formMarkLabel }}</legend>
      <div class="custom-calendar-marks__options">
        <label v-for="option in marks" :key="option.value" class="custom-calendar-mark-option">
          <input
            v-model="draft.mark"
            type="radio"
            name="custom-entry-mark"
            :value="option.value"
          >
          <span class="custom-calendar-mark-option__label">{{ option.label }}</span>
          <span class="custom-calendar-mark-option__hint">{{ option.hint }}</span>
        </label>
      </div>
      <p class="field-help">{{ text.formMarkHint }}</p>
    </fieldset>

    <div class="custom-calendar-field custom-calendar-dates">
      <div>
        <label for="custom-entry-start">{{ text.formStartLabel }}</label>
        <input
          id="custom-entry-start"
          class="ui-input"
          type="date"
          :value="draft.startDate"
          :aria-invalid="invalid('dates')"
          aria-describedby="custom-entry-dates-help"
          @input="changeStart(($event.target as HTMLInputElement).value)"
        >
      </div>
      <div>
        <label for="custom-entry-end">{{ text.formEndLabel }}</label>
        <input
          id="custom-entry-end"
          v-model="draft.endDate"
          class="ui-input"
          type="date"
          :aria-invalid="invalid('dates')"
          aria-describedby="custom-entry-dates-help"
        >
      </div>
      <p id="custom-entry-dates-help" class="field-help">
        {{ text.formDatesHint }}
        <span v-for="message in messagesFor('dates')" :key="message" class="custom-calendar-field__error">{{ message }}</span>
      </p>
    </div>

    <div class="custom-calendar-field">
      <label for="custom-entry-note">{{ text.formNoteLabel }}</label>
      <textarea
        id="custom-entry-note"
        v-model="draft.note"
        class="ui-input custom-calendar-note"
        rows="3"
        :aria-invalid="invalid('note')"
        aria-describedby="custom-entry-note-help"
      />
      <p id="custom-entry-note-help" class="field-help">
        {{ text.formNoteHint }}
        <span v-for="message in messagesFor('note')" :key="message" class="custom-calendar-field__error">{{ message }}</span>
      </p>
    </div>

    <div class="custom-calendar-form__actions">
      <Button type="submit" data-entry-action="save" :disabled="props.busy">{{ text.formSave }}</Button>
      <Button type="button" variant="outline" data-entry-action="cancel" @click="emit('cancel')">{{ text.formCancel }}</Button>
    </div>
  </form>
</template>
