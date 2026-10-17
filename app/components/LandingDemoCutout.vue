<script setup lang="ts">
import { computed } from 'vue'
import type { LocaleCode } from '@/features/tools/catalog'
import { workbenchJobLabels } from '@/features/tools/product-image-workbench/content'

const props = defineProps<{ locale: LocaleCode }>()

const text = computed(() => props.locale === 'en'
  ? {
      art: 'Illustration: the same portrait before and after its background is removed',
      before: 'Original',
      after: 'Transparent output',
      jobs: 'For every photo',
    }
  : {
      art: '示意圖：同一張人像去背前後的對照',
      before: '原圖',
      after: '透明背景結果',
      jobs: '每張都要做的事',
    })

const jobs = computed(() => (['cutout', 'compose', 'compress'] as const).map(job => workbenchJobLabels[job][props.locale]))

/*
 * The portrait is drawn as two pictures, the second without its scene, so the
 * remover's own frames (#109) show them exactly as they show a real cutout:
 * the checkerboard behind the transparent one comes from the tool's styles.
 */
const person = '<rect x="106" y="128" width="28" height="34" fill="#fff" stroke="#0b0b0b" stroke-width="3"/>'
  + '<path d="M46 246 C 52 190, 88 160, 120 160 C 152 160, 188 190, 194 246 Z" fill="#ff7f5c" stroke="#0b0b0b" stroke-width="3"/>'
  + '<path d="M101 162 Q 120 180 139 162" fill="none" stroke="#0b0b0b" stroke-width="3" stroke-linecap="round"/>'
  + '<ellipse cx="120" cy="100" rx="35" ry="40" fill="#fff" stroke="#0b0b0b" stroke-width="3"/>'
  + '<path d="M85 100 C 82 68, 102 54, 123 56 C 146 58, 159 74, 155 98 C 143 84, 123 79, 103 86 C 94 90, 88 95, 85 100 Z" fill="#0b0b0b"/>'
const scene = '<rect width="240" height="240" fill="#86bbff"/>'
  + '<circle cx="190" cy="50" r="24" fill="#ffd23f" stroke="#0b0b0b" stroke-width="2.5"/>'
  + '<path d="M-10 190 C 40 156, 84 160, 130 184 S 214 206, 250 168 V 250 H -10 Z" fill="#63dca8" stroke="#0b0b0b" stroke-width="2.5"/>'
const picture = (body: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 240 240">${body}</svg>`)}`
const frames = [
  { id: 'before', src: picture(scene + person), alpha: false },
  { id: 'after', src: picture(person), alpha: true },
] as const
</script>

<template>
  <div class="ui-card nb-snap nb-cutout" data-demo="cutout">
    <div class="nb-cutout__pair" role="img" :aria-label="text.art">
      <figure
        v-for="frame in frames"
        :key="frame.id"
        class="image-background-remover__frame"
        :data-cutout-frame="frame.id"
        aria-hidden="true"
      >
        <div :class="['image-background-remover__view', { 'image-background-remover__view--alpha': frame.alpha }]">
          <img :src="frame.src" alt="" width="480" height="480" decoding="async">
        </div>
        <figcaption><strong>{{ frame.alpha ? text.after : text.before }}</strong></figcaption>
      </figure>
    </div>
    <!-- The workbench's own job list, all three ticked; a picture of it, so it takes no clicks. -->
    <p class="sr-only">{{ locale === 'en' ? `${text.jobs}: ${jobs.join(', ')}` : `${text.jobs}：${jobs.join('、')}` }}</p>
    <fieldset class="workbench__jobs nb-cutout__jobs" inert aria-hidden="true">
      <legend>{{ text.jobs }}</legend>
      <div class="choice-group">
        <label v-for="job in jobs" :key="job" class="choice-option" data-step>
          <input type="checkbox" checked tabindex="-1">
          {{ job }}
        </label>
      </div>
    </fieldset>
  </div>
</template>
