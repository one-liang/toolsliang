<script setup lang="ts">
import { computed } from 'vue'
import { getDocumentDemo } from '@/features/landing/demos'
import type { LocaleCode } from '@/features/tools/catalog'

const props = defineProps<{ locale: LocaleCode }>()
const form = getDocumentDemo()

const text = computed(() => props.locale === 'en'
  ? { amount: 'Amount', sign: 'Signature', signArt: 'Illustration: a handwritten signature placed on the form' }
  : { amount: '金額', sign: '簽名', signArt: '示意圖：手寫簽名放在表單上' })

const handles = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const
</script>

<template>
  <!-- The signature tool's stage (#111, #92): the page on warm paper, the signature in the tool's own selection frame. -->
  <div class="ui-card nb-snap nb-doc" data-demo="signature">
    <div class="nb-doc__stage">
      <div class="nb-doc__page">
        <div class="nb-doc__top" aria-hidden="true">
          <span class="nb-doc__tag">PDF</span>
          <span class="nb-doc__lines"><span /><span /></span>
        </div>
        <dl class="nb-doc__amount">
          <dt>{{ text.amount }}</dt>
          <dd>
            <span class="nb-doc__words">{{ form.wording }}</span>
            <span class="nb-doc__figure">NT$ {{ form.amount }}</span>
          </dd>
        </dl>
        <div class="nb-doc__body" aria-hidden="true">
          <span v-for="line in 6" :key="line" />
        </div>
        <div class="nb-doc__sign">
          <span class="pdf-signature__placement pdf-signature__placement--selected nb-doc__placement" data-signature-placement>
            <svg class="nb-doc__signature" viewBox="66 126 196 60" role="img" :aria-label="text.signArt">
              <path
                data-signature-stroke
                d="M74 170 C 84 140, 100 134, 98 158 C 96 178, 82 180, 92 162 C 104 142, 120 148, 116 168 C 114 180, 128 172, 136 158 C 142 148, 150 152, 148 166 C 146 178, 158 174, 166 160 C 174 146, 186 144, 184 162 C 182 176, 196 174, 206 156 C 214 142, 226 148, 222 164 C 220 174, 232 172, 246 152 M92 176 C 140 170, 200 168, 254 162"
                fill="none"
                stroke="#0b0b0b"
                stroke-width="3.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span v-for="handle in handles" :key="handle" :class="['pdf-signature__handle', `pdf-signature__handle--${handle}`]" aria-hidden="true" />
          </span>
          <span class="nb-doc__line">{{ text.sign }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
