<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import { computed } from 'vue'
import {
  bmiDemoInput,
  calendarBreakParts,
  describeCalendarBreak,
  getBmiDemo,
  getCalendarDemo,
  getNtdDemo,
} from '@/features/landing/demos'
import { copy, getTool, type LocaleCode } from '@/features/tools/catalog'

const props = defineProps<{ locale: LocaleCode, label: string }>()

const ntd = getNtdDemo()
const calendar = getCalendarDemo()
const bmi = computed(() => getBmiDemo(props.locale))
const breakParts = computed(() => calendarBreakParts(calendar.breakHoliday, calendar.breakLength, props.locale))

const weekdays = computed(() => props.locale === 'en'
  ? ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  : ['日', '一', '二', '三', '四', '五', '六'])

const text = computed(() => props.locale === 'en'
  ? {
      cheque: 'Cheque',
      month: `February ${calendar.year}`,
      breakLine: describeCalendarBreak(calendar.breakHoliday, calendar.breakLength, 'en'),
    }
  : {
      cheque: '支票用途',
      month: `${calendar.year} 年 ${calendar.month} 月`,
      breakLine: describeCalendarBreak(calendar.breakHoliday, calendar.breakLength, 'zh-tw'),
    })

function toolName(slug: string) {
  const tool = getTool(slug)
  return tool ? copy(tool.name, props.locale) : slug
}
</script>

<template>
  <div class="nb-deck" role="group" :aria-label="label" data-motion="deck">
    <article class="nb-slip nb-fill--document" data-slip>
      <div class="nb-slip__head">
        <NuxtLink class="nb-slip__link" :to="`/${locale}/tools/ntd-uppercase/`">{{ toolName('ntd-uppercase') }}</NuxtLink>
        <span class="nb-slip__go" aria-hidden="true"><ArrowRight :size="17" :stroke-width="2.5" /></span>
      </div>
      <p class="nb-slip__input"><span>{{ text.cheque }}</span><span>NT$ {{ ntd.amount }}</span></p>
      <p class="nb-slip__output" data-ntd-output>{{ ntd.wording }}</p>
    </article>

    <article class="nb-slip nb-fill--time-calendar" data-slip>
      <div class="nb-slip__head">
        <NuxtLink class="nb-slip__link" :to="`/${locale}/tools/taiwan-calendar/`">{{ toolName('taiwan-calendar') }}</NuxtLink>
        <span class="nb-slip__go" aria-hidden="true"><ArrowRight :size="17" :stroke-width="2.5" /></span>
      </div>
      <div class="nb-slip__calendar">
        <div>
          <p class="nb-slip__input">{{ text.month }}</p>
          <div class="nb-cal" aria-hidden="true">
            <span v-for="(weekday, index) in weekdays" :key="`dow-${index}`" class="nb-cal__dow">{{ weekday }}</span>
            <template v-for="(week, weekIndex) in calendar.weeks" :key="`week-${weekIndex}`">
              <span
                v-for="(cell, dayIndex) in week"
                :key="cell?.date ?? `pad-${weekIndex}-${dayIndex}`"
                :class="['nb-cal__day', { 'nb-cal__day--off': cell?.off, 'nb-cal__day--break': cell?.inBreak }]"
                :data-break="cell?.inBreak ? '' : undefined"
              >{{ cell?.day }}</span>
            </template>
          </div>
        </div>
        <p class="nb-calbreak" data-break>
          <span class="sr-only">{{ text.breakLine }}</span>
          <span aria-hidden="true"><strong class="nb-calbreak__count">{{ breakParts.count }}</strong><span class="nb-calbreak__unit">{{ breakParts.unit }}</span></span>
          <span class="nb-calbreak__name" aria-hidden="true">{{ breakParts.name }}</span>
        </p>
      </div>
    </article>

    <article class="nb-slip nb-fill--calculation" data-slip>
      <div class="nb-slip__head">
        <NuxtLink class="nb-slip__link" :to="`/${locale}/tools/bmi-calculator/`">{{ toolName('bmi-calculator') }}</NuxtLink>
        <span class="nb-slip__go" aria-hidden="true"><ArrowRight :size="17" :stroke-width="2.5" /></span>
      </div>
      <p class="nb-slip__bmi">
        <span class="nb-slip__input">{{ bmiDemoInput.heightCentimetres }} cm · {{ bmiDemoInput.weightKilograms }} kg</span>
        <span class="nb-slip__reading"><strong class="nb-slip__number" :data-count-to="bmi.display">{{ bmi.display }}</strong><span class="nb-slip__caption">{{ bmi.categoryName }}</span></span>
      </p>
    </article>
  </div>
</template>
