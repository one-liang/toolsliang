<script setup lang="ts">
import { CalendarCheck, ChevronLeft, ChevronRight } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  describeCivilDate,
  describeDayFlag,
  describeDayMark,
  describeLunarDate,
  describeLunarDayMark,
  describeMonthName,
  describeOfficialDay,
  describeSolarTerm,
  describeYearOption,
  getTaiwanCalendarCaveats,
  getTaiwanCalendarCopy,
  officialDayKindLabels,
  weekdayFullNames,
  weekdayNames,
} from '@/features/tools/taiwan-calendar/content'
import { citedEditions, getMonthGrid, type CalendarDay } from '@/features/tools/taiwan-calendar/domain/calendar'
import { officialDayKinds } from '@/features/tools/taiwan-calendar/domain/reference'
import {
  taiwanCalendarDatasets,
  taiwanCalendarReferenceVersion,
} from '@/features/tools/taiwan-calendar/domain/sources'
import { selectableYears } from '@/features/tools/taiwan-calendar/domain/years'

/**
 * The calendar reads a baked year and shows it. It decides nothing about dates:
 * every kind, lunar date and solar term on screen came out of the year module,
 * and a year the module cannot supply is refused in the reviewed words rather
 * than drawn as an empty grid. Moving between months, years and days is the
 * shared month view, so both calendar tools navigate identically.
 *
 * The same year can be read a month at a time or all twelve months at once, the
 * way the DGPA prints its office calendar. Both views are the same days and the
 * same roving tab stop; the year view only trades the day's detail for the whole
 * year, and opening a day there brings it up in the month view.
 *
 * Nothing about the visit leaves the tab. The year and the view are component
 * state, never a URL, and the year modules are static assets of this build, so
 * opening a year makes no request that could say which year someone is reading.
 */

type CalendarView = 'month' | 'year'

const { locale, withLocale } = useAppLocale()
const text = computed(() => getTaiwanCalendarCopy(locale.value))
const {
  year, month, calendar, refusalMessage, loading, today, selectedDate, selectedDay, weeks,
  monthLabel, state, canGoBack, canGoForward, readToday, showYear, showToday, stepMonth,
  selectDate, moveFocus, requestFocus, isTabStop,
} = useCalendarMonth({ locale })

const view = ref<CalendarView>('month')
const viewOptions = computed(() => [
  { id: 'month' as const, label: text.value.monthView },
  { id: 'year' as const, label: text.value.yearView },
])

const monthDays = computed(() => weeks.value.flat().filter((day): day is CalendarDay => Boolean(day)))
/** The agenda is the same month read as a list: holidays, adjusted days and terms. */
const markedDays = computed(() => monthDays.value.filter(day =>
  day.solarTerm || (day.official.kind !== 'workday' && day.official.kind !== 'weekend')))
/** Only expanded while the year view is on screen: twelve grids nobody is reading cost nothing. */
const yearMonths = computed(() => calendar.value && view.value === 'year'
  ? Array.from({ length: 12 }, (_, index) => ({ month: index + 1, weeks: getMonthGrid(calendar.value!, index + 1) }))
  : [])
const revised = computed(() => Object.values(calendar.value?.layers ?? {}).some(layer => layer.status === 'revised'))
const caveats = computed(() => getTaiwanCalendarCaveats(locale.value, { revised: revised.value }))
/**
 * Every reviewed dataset, paired with what this year cites from it. The licence
 * makes attribution a condition rather than a courtesy, and the cross-check
 * source earns its line even though no layer is built from it — a year is only
 * published because it agreed with that second opinion.
 */
const citedSources = computed(() => {
  const editions = calendar.value ? citedEditions(calendar.value.layers) : []

  return taiwanCalendarDatasets.map(dataset => ({
    dataset,
    editions: editions.filter(edition => edition.datasetId === dataset.id),
  }))
})
/**
 * What stays on screen under the calendar: who published each layer, which
 * edition this year is built from, and the licence it is used under. The Open
 * Government Data Licence lapses without that attribution, so it is never
 * folded away; only the dates, the cross-check and the disclaimers are.
 */
const editionLine = computed(() => {
  const en = locale.value === 'en'
  const separator = en ? '; ' : '、'
  const credited = citedSources.value.filter(cited => cited.editions.length)
  const licences = [...new Map(credited.map(cited => [cited.dataset.licenceUrl, cited.dataset])).values()]
  const line: Array<{ text: string, href?: string, emphasis?: boolean }> = [
    { text: `${text.value.dataVersionLabel}${en ? ': ' : '：'}` },
  ]

  credited.forEach((cited, index) => {
    line.push(
      { text: `${index ? separator : ''}${cited.dataset.publisher[locale.value]}${en ? ', “' : '「'}` },
      { text: cited.editions.map(edition => edition.edition).join(separator), href: cited.dataset.url },
      { text: en ? '”' : '」' },
    )
    if (cited.editions.some(edition => edition.status === 'revised')) line.push({ text: text.value.revisedTag, emphasis: true })
  })
  line.push({ text: `${en ? '. ' : '。'}${text.value.licencePrefix}` })
  licences.forEach((dataset, index) => line.push(
    ...index ? [{ text: separator }] : [],
    { text: dataset.licence[locale.value], href: dataset.licenceUrl },
  ))
  line.push({ text: text.value.licenceSuffix })

  return line
})
const legend = computed(() => officialDayKinds.map(kind => ({ kind, label: officialDayKindLabels[kind][locale.value] })))
const gridCaption = computed(() => `${monthLabel.value}・${text.value.gridLabel}`)
const yearGridLabel = computed(() => `${describeYearOption(year.value, locale.value)}・${text.value.yearGridLabel}`)

onMounted(readToday)

/** A day picked in the year view opens in the month view, with focus on it. */
function openDay(date: string) {
  view.value = 'month'
  selectDate(date)
  requestFocus(date)
}

function dayLabel(day: CalendarDay) {
  const parts = [
    describeCivilDate(day.date, day.rocYear, locale.value),
    weekdayFullNames[locale.value][day.isoWeekday % 7]!,
    describeLunarDate(day.lunar, locale.value),
    day.solarTerm ? describeSolarTerm(day.solarTerm, locale.value) : '',
    describeOfficialDay(day.official, locale.value),
    day.date === today.value ? text.value.todayBadge : '',
  ]

  return parts.filter(Boolean).join(locale.value === 'en' ? ', ' : '，')
}

/**
 * The short line under a day number. A solar term takes the space when there is
 * one: it is the rarer fact, and the lunar date is one row away in the detail.
 */
function dayFootnote(day: CalendarDay) {
  return day.solarTerm ? day.solarTerm.name : describeLunarDayMark(day.lunar, locale.value)
}

function dayMark(day: CalendarDay) {
  return describeDayMark(day.official, locale.value)
}

function dayFlag(day: CalendarDay) {
  return describeDayFlag(day.official, locale.value)
}
</script>

<template>
  <Card class="tool-workspace calendar-workspace" :data-calendar-state="state" :data-calendar-view="view">
    <div class="calendar-toolbar">
      <div class="calendar-toolbar__year">
        <label for="calendar-year">{{ text.yearLabel }}</label>
        <!-- The native control keeps its own height in some engines, so the
             appearance is replaced to guarantee a 44px touch target. The chevron
             is painted by the stylesheet rather than overlaid as an element,
             which would obscure part of that target. -->
        <select
          id="calendar-year"
          class="ui-input calendar-year"
          :value="year"
          aria-describedby="calendar-year-help"
          @change="showYear(Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="option in selectableYears" :key="option" :value="option">
            {{ describeYearOption(option, locale) }}
          </option>
        </select>
      </div>

      <fieldset class="calendar-view">
        <legend>{{ text.viewLabel }}</legend>
        <div class="choice-group">
          <label v-for="option in viewOptions" :key="option.id" class="choice-option calendar-view__option">
            <input v-model="view" type="radio" name="calendar-view" :value="option.id">
            <span>{{ option.label }}</span>
          </label>
        </div>
      </fieldset>

      <div v-if="view === 'month'" class="calendar-toolbar__months">
        <Button
          variant="outline"
          class="calendar-prev-month"
          :disabled="!canGoBack"
          :aria-label="text.previousMonth"
          @click="stepMonth(-1)"
        >
          <ChevronLeft :size="18" aria-hidden="true" />
        </Button>
        <p class="calendar-month-label" aria-live="polite">{{ monthLabel }}</p>
        <Button
          variant="outline"
          class="calendar-next-month"
          :disabled="!canGoForward"
          :aria-label="text.nextMonth"
          @click="stepMonth(1)"
        >
          <ChevronRight :size="18" aria-hidden="true" />
        </Button>
      </div>

      <Button v-if="today" class="calendar-today" @click="showToday">
        <CalendarCheck :size="18" aria-hidden="true" />
        {{ text.todayLabel }}
      </Button>
    </div>
    <p id="calendar-year-help" class="field-help calendar-year-help">{{ text.yearHint }}</p>

    <p class="calendar-status" role="status">
      <span v-if="loading">{{ text.loadingLabel }}</span>
      <span v-else-if="refusalMessage" class="calendar-refusal">{{ refusalMessage }}</span>
    </p>

    <div v-if="calendar && view === 'month'" class="calendar-body">
      <table class="calendar-grid" :data-month="month">
        <caption>{{ gridCaption }}<span class="calendar-grid__hint">{{ text.gridHint }}</span></caption>
        <thead>
          <tr>
            <th v-for="(name, index) in weekdayNames[locale]" :key="name" scope="col">
              <abbr :title="weekdayFullNames[locale][index]">{{ name }}</abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(week, index) in weeks" :key="index">
            <td v-for="(day, position) in week" :key="position">
              <button
                v-if="day"
                type="button"
                class="calendar-day"
                :class="{
                  'calendar-day--today': day.date === today,
                  'calendar-day--selected': day.date === selectedDate,
                }"
                :data-date="day.date"
                :data-kind="day.official.kind"
                :tabindex="isTabStop(day.date) ? 0 : -1"
                :aria-label="dayLabel(day)"
                :aria-pressed="day.date === selectedDate"
                :aria-current="day.date === today ? 'date' : undefined"
                @click="selectDate(day.date)"
                @keydown.left.right.up.down.prevent="moveFocus(day.date, ($event as KeyboardEvent).key)"
              >
                <span class="calendar-day__number">{{ day.dayOfMonth }}</span>
                <span class="calendar-day__lunar">{{ dayFootnote(day) }}</span>
                <span v-if="dayMark(day)" class="calendar-day__mark">{{ dayMark(day) }}</span>
                <span v-if="day.date === today" class="calendar-day__today">{{ text.todayBadge }}</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="calendar-side">
        <section class="calendar-detail" :aria-label="text.detailLabel">
          <h2 class="calendar-detail__title">{{ text.detailLabel }}</h2>
          <p v-if="!selectedDay" class="calendar-detail__empty">{{ text.detailEmpty }}</p>
          <dl v-else>
            <div>
              <dt>{{ text.dateLabel }}</dt>
              <dd>{{ describeCivilDate(selectedDay.date, selectedDay.rocYear, locale) }}</dd>
            </div>
            <div>
              <dt>{{ text.weekdayLabel }}</dt>
              <dd>{{ weekdayFullNames[locale][selectedDay.isoWeekday % 7] }}</dd>
            </div>
            <div>
              <dt>{{ text.lunarLabel }}</dt>
              <dd>{{ describeLunarDate(selectedDay.lunar, locale) }}</dd>
            </div>
            <div v-if="selectedDay.solarTerm">
              <dt>{{ text.solarTermLabel }}</dt>
              <dd>{{ describeSolarTerm(selectedDay.solarTerm, locale) }}</dd>
            </div>
            <div>
              <dt>{{ text.officialLabel }}</dt>
              <dd>{{ describeOfficialDay(selectedDay.official, locale) }}</dd>
            </div>
            <div v-if="selectedDay.official.label">
              <dt>{{ text.sourceNoteLabel }}</dt>
              <dd class="calendar-detail__note">{{ selectedDay.official.label }}</dd>
            </div>
          </dl>
        </section>

        <section class="calendar-agenda-panel" :aria-label="text.agendaLabel">
          <h2 class="calendar-detail__title">{{ text.agendaLabel }}</h2>
          <p v-if="!markedDays.length" class="calendar-detail__empty">{{ text.agendaEmpty }}</p>
          <ul v-else class="calendar-agenda">
            <li v-for="day in markedDays" :key="day.date" class="calendar-agenda__item" :data-date="day.date">
              <button type="button" class="calendar-agenda__button" @click="selectDate(day.date)">
                <span class="calendar-agenda__date">{{ day.month }}/{{ day.dayOfMonth }}</span>
                <span class="calendar-agenda__text">
                  <template v-if="day.solarTerm">{{ describeSolarTerm(day.solarTerm, locale) }}</template>
                  <template v-if="day.solarTerm && dayMark(day)">・</template>
                  <template v-if="dayMark(day)">{{ dayMark(day) }}</template>
                </span>
              </button>
            </li>
          </ul>
        </section>
      </div>
    </div>

    <section
      v-if="calendar && view === 'year'"
      class="calendar-year-view"
      :aria-label="yearGridLabel"
      aria-describedby="calendar-year-grid-hint"
    >
      <p id="calendar-year-grid-hint" class="calendar-year-view__hint">{{ text.yearGridHint }}</p>
      <div class="calendar-months">
        <table v-for="item in yearMonths" :key="item.month" class="calendar-mini" :data-month="item.month">
          <caption>{{ describeMonthName(item.month, locale) }}</caption>
          <thead>
            <tr>
              <th v-for="(name, index) in weekdayNames[locale]" :key="name" scope="col">
                <abbr :title="weekdayFullNames[locale][index]">{{ name }}</abbr>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(week, index) in item.weeks" :key="index">
              <td v-for="(day, position) in week" :key="position">
                <button
                  v-if="day"
                  type="button"
                  class="calendar-day calendar-day--compact"
                  :class="{
                    'calendar-day--today': day.date === today,
                    'calendar-day--selected': day.date === selectedDate,
                  }"
                  :data-date="day.date"
                  :data-kind="day.official.kind"
                  :tabindex="isTabStop(day.date) ? 0 : -1"
                  :aria-label="dayLabel(day)"
                  :aria-current="day.date === today ? 'date' : undefined"
                  @click="openDay(day.date)"
                  @keydown.left.right.up.down.prevent="moveFocus(day.date, ($event as KeyboardEvent).key)"
                >
                  <span class="calendar-day__number">{{ day.dayOfMonth }}</span>
                  <span class="calendar-day__lunar">{{ dayFootnote(day) }}</span>
                  <span
                    v-if="dayFlag(day)"
                    class="calendar-day__flag"
                    :data-flag="day.official.kind === 'makeup-workday' ? 'work' : 'off'"
                  >{{ dayFlag(day) }}</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="calendar" class="calendar-legend" :aria-label="text.legendLabel">
      <h2 class="calendar-detail__title">{{ text.legendLabel }}</h2>
      <ul v-if="view === 'month'">
        <li v-for="item in legend" :key="item.kind" :data-kind="item.kind">
          <span class="calendar-legend__swatch" aria-hidden="true" />
          {{ item.label }}
        </li>
      </ul>
      <!-- The DGPA's table paints every day off alike, so the year view's key is
           its two colours plus the two flags that say what the colour cannot. -->
      <ul v-else>
        <li data-legend="workday">
          <span class="calendar-legend__swatch" aria-hidden="true" />
          {{ text.workdayLegend }}
        </li>
        <li data-legend="day-off">
          <span class="calendar-legend__swatch" aria-hidden="true" />
          {{ text.dayOffLegend }}
        </li>
        <li data-legend="off">
          <span class="calendar-legend__flag" data-flag="off">{{ text.offMark }}</span>
          {{ text.offMarkLegend }}
        </li>
        <li data-legend="work">
          <span class="calendar-legend__flag" data-flag="work">{{ text.workMark }}</span>
          {{ text.workMarkLegend }}
        </li>
      </ul>
    </section>

    <footer v-if="calendar" class="calendar-edition">
      <p class="calendar-edition__line">
        <template v-for="(segment, index) in editionLine" :key="index">
          <a v-if="segment.href" :href="segment.href" target="_blank" rel="noopener noreferrer">{{ segment.text }}</a>
          <strong v-else-if="segment.emphasis" class="calendar-edition__revised">{{ segment.text }}</strong>
          <template v-else>{{ segment.text }}</template>
        </template>
      </p>
      <p class="calendar-working-day-link">
        {{ text.workingDayLinkPrefix }}<NuxtLink :to="withLocale('/tools/working-day-calculator/')">{{ text.workingDayLinkText }}</NuxtLink>{{ text.workingDayLinkSuffix }}
      </p>

      <details class="calendar-edition__details">
        <summary>{{ text.editionDetailsLabel }}</summary>
        <p v-if="revised" class="calendar-revised">{{ text.revisedLabel }}</p>

        <section class="calendar-caveats" :aria-label="text.caveatsTitle">
          <h2 class="calendar-detail__title">{{ text.caveatsTitle }}</h2>
          <ul>
            <li
              v-for="caveat in caveats"
              :key="caveat.key"
              :class="{ 'calendar-caveats__emphasised': caveat.emphasised }"
            >{{ caveat.text }}</li>
          </ul>
        </section>

        <section class="calendar-sources" :aria-label="text.sourcesTitle">
          <h2 class="calendar-detail__title">{{ text.sourcesTitle }}</h2>
          <dl>
            <div v-for="cited in citedSources" :key="cited.dataset.id" :data-dataset="cited.dataset.id">
              <dt>{{ cited.dataset.publisher[locale] }}</dt>
              <dd>
                <a :href="cited.dataset.url" target="_blank" rel="noopener noreferrer">{{ cited.dataset.name[locale] }}</a>
                <span v-for="edition in cited.editions" :key="edition.checksum" class="calendar-sources__edition">
                  {{ text.dataVersionLabel }}：{{ edition.edition }}
                  ・{{ text.publishedAtLabel }} <time :datetime="edition.publishedAt">{{ edition.publishedAt }}</time>
                  ・{{ text.retrievedAtLabel }} <time :datetime="edition.retrievedAt">{{ edition.retrievedAt }}</time>
                </span>
                <span v-if="!cited.editions.length">{{ text.crossCheckLabel }}</span>
                <span>
                  {{ text.licenceLabel }}：
                  <a :href="cited.dataset.licenceUrl" target="_blank" rel="noopener noreferrer">{{ cited.dataset.licence[locale] }}</a>
                </span>
              </dd>
            </div>
          </dl>
          <p class="calendar-sources__contract">{{ text.dataContractLabel }}：{{ taiwanCalendarReferenceVersion }}</p>
        </section>
      </details>
    </footer>
  </Card>
</template>
