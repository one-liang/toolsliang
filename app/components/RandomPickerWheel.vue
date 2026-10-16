<script setup lang="ts">
import { computed } from 'vue'
import {
  wheelDividerWidth,
  wheelHubDotRadius,
  wheelHubRadius,
  wheelLabelStyle,
  wheelPointerPath,
  wheelRadius,
  wheelViewBox,
  type WheelSlice,
} from '@/features/tools/random-picker/domain/wheel'

/**
 * The one wheel toolsliang draws (#106): the random picker spins it and the
 * landing demo shows it at rest, so the two cannot look different again. It
 * only draws what it is given. The slices, the rotation and the drawn slice
 * all come from `domain/wheel.ts`; nothing here can choose a result.
 *
 * The disc turns through a CSS variable rather than its transform, so the
 * picker can ease it with a transition and the landing can tween the variable
 * without either fighting the other's transform.
 */
const props = withDefaults(defineProps<{
  slices: WheelSlice[]
  /** Degrees clockwise; the drawn slice is under the pointer once this is its stop rotation. */
  rotation: number
  label: string
  /** Stood out of the wheel and outlined, so the result never depends on colour alone. */
  wonIndex?: number
  /** Zero draws the rotation at once, which is also what reduced motion asks for. */
  spinDurationMs?: number
}>(), {
  wonIndex: undefined,
  spinDurationMs: 0,
})

const resting = computed(() => props.slices.filter(slice => slice.index !== props.wonIndex))
const won = computed(() => props.slices.find(slice => slice.index === props.wonIndex))
const fontSize = computed(() => wheelLabelStyle(props.slices.length).fontSize)
// Only a zero duration does not stop a spin already under way; dropping the
// transition does, so skipping lands the wheel on its result at once.
const discStyle = computed(() => ({
  '--wheel-rotation': `${props.rotation}deg`,
  'transition-property': props.spinDurationMs ? 'transform' : 'none',
  'transition-duration': `${props.spinDurationMs}ms`,
}))
</script>

<template>
  <svg
    class="picker-wheel"
    :viewBox="wheelViewBox"
    role="img"
    :aria-label="label"
    :style="{ '--wheel-divider': `${wheelDividerWidth(slices.length)}px` }"
  >
    <g class="picker-wheel__disc" data-wheel :style="discStyle">
      <path
        v-for="slice in resting"
        :key="slice.index"
        :d="slice.path"
        :class="['picker-wheel__slice', `picker-wheel__slice--${slice.fill}`]"
      />
      <!-- One rim over every resting slice; the drawn slice carries its own, since it stands outside this one. -->
      <circle class="picker-wheel__rim" :r="wheelRadius" />
      <text
        v-for="slice in resting"
        :key="slice.index"
        class="picker-wheel__label"
        :font-size="fontSize"
        :transform="slice.labelTransform"
      >{{ slice.label }}</text>
      <g
        v-if="won"
        class="picker-wheel__won"
        data-wheel-won
        :style="{ '--wheel-won-x': won.wonOffset.x, '--wheel-won-y': won.wonOffset.y }"
      >
        <path :d="won.path" :class="['picker-wheel__slice', `picker-wheel__slice--${won.fill}`]" />
        <text class="picker-wheel__label" :font-size="fontSize" :transform="won.labelTransform">{{ won.label }}</text>
      </g>
    </g>
    <circle class="picker-wheel__hub" :r="wheelHubRadius" />
    <circle class="picker-wheel__hub-dot" :r="wheelHubDotRadius" />
    <path class="picker-wheel__pointer" :d="wheelPointerPath" />
  </svg>
</template>
