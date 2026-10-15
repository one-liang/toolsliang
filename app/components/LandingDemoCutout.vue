<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import { computed, useId } from 'vue'
import type { LocaleCode } from '@/features/tools/catalog'

const props = defineProps<{ locale: LocaleCode }>()
const id = useId()

const text = computed(() => props.locale === 'en'
  ? {
      art: 'Illustration: the same portrait before and after its background is removed',
      before: 'Original',
      after: 'Transparent PNG',
      steps: 'Product image workbench steps',
      items: ['Cutout', 'Compliant size', 'Frame & Logo'],
    }
  : {
      art: '示意圖：同一張人像去背前後的對照',
      before: '原圖',
      after: '透明 PNG',
      steps: '商品圖工作台流程',
      items: ['去背', '合規尺寸', '框版 Logo'],
    })

const frames = ['before', 'after'] as const
</script>

<template>
  <div class="nb-cutout" data-demo="cutout">
    <div class="nb-cutout__pair" role="img" :aria-label="text.art">
      <template v-for="(frame, index) in frames" :key="frame">
        <ArrowRight v-if="index > 0" class="nb-cutout__arrow" :stroke-width="2.5" aria-hidden="true" />
        <figure class="nb-cutout__frame" aria-hidden="true">
          <svg class="nb-cutout__art" viewBox="0 0 240 240">
            <defs v-if="frame === 'after'">
              <pattern :id="`${id}-checker`" width="20" height="20" patternUnits="userSpaceOnUse">
                <rect width="20" height="20" fill="#fff" />
                <rect width="10" height="10" fill="#e6e4de" />
                <rect x="10" y="10" width="10" height="10" fill="#e6e4de" />
              </pattern>
              <clipPath :id="`${id}-scene`">
                <rect data-scene-clip x="240" y="0" width="240" height="240" />
              </clipPath>
            </defs>
            <rect v-if="frame === 'after'" width="240" height="240" :fill="`url(#${id}-checker)`" />
            <g :clip-path="frame === 'after' ? `url(#${id}-scene)` : undefined">
              <rect width="240" height="240" fill="#86bbff" />
              <circle cx="190" cy="50" r="24" fill="#ffd23f" stroke="#0b0b0b" stroke-width="2.5" />
              <path d="M-10 190 C 40 156, 84 160, 130 184 S 214 206, 250 168 V 250 H -10 Z" fill="#63dca8" stroke="#0b0b0b" stroke-width="2.5" />
            </g>
            <rect x="106" y="128" width="28" height="34" fill="#fff" stroke="#0b0b0b" stroke-width="3" />
            <path d="M46 246 C 52 190, 88 160, 120 160 C 152 160, 188 190, 194 246 Z" fill="#ff7f5c" stroke="#0b0b0b" stroke-width="3" />
            <path d="M101 162 Q 120 180 139 162" fill="none" stroke="#0b0b0b" stroke-width="3" stroke-linecap="round" />
            <ellipse cx="120" cy="100" rx="35" ry="40" fill="#fff" stroke="#0b0b0b" stroke-width="3" />
            <path d="M85 100 C 82 68, 102 54, 123 56 C 146 58, 159 74, 155 98 C 143 84, 123 79, 103 86 C 94 90, 88 95, 85 100 Z" fill="#0b0b0b" />
            <g v-if="frame === 'after'" transform="translate(172 12)" data-png-tag>
              <rect width="56" height="26" rx="13" fill="#0b0b0b" />
              <text x="28" y="17.5" text-anchor="middle" fill="#fff" font-size="12.5" font-weight="800" letter-spacing="1">PNG</text>
            </g>
          </svg>
          <figcaption class="nb-cutout__caption">{{ frame === 'before' ? text.before : text.after }}</figcaption>
        </figure>
      </template>
    </div>
    <ol class="nb-steps" :aria-label="text.steps">
      <li v-for="(item, index) in text.items" :key="item">
        <span class="nb-steps__chip is-lit" data-step>{{ item }}</span>
        <ArrowRight v-if="index < text.items.length - 1" class="nb-steps__arrow" :stroke-width="2.5" aria-hidden="true" />
      </li>
    </ol>
  </div>
</template>
