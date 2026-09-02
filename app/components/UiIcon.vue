<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    name:
      | 'arrow-left'
      | 'arrow-right'
      | 'check'
      | 'chevron-left'
      | 'command'
      | 'copy'
      | 'heart'
      | 'home'
      | 'language'
      | 'menu'
      | 'moon'
      | 'search'
      | 'shield'
      | 'sparkle'
      | 'sun'
      | 'tool'
      | 'user'
    size?: number
    filled?: boolean
  }>(),
  { size: 20, filled: false },
)

const paths: Record<string, string[]> = {
  'arrow-left': ['M19 12H5', 'm12 19-7-7 7-7'],
  'arrow-right': ['M5 12h14', 'm12 5 7 7-7 7'],
  check: ['m5 12 4 4L19 6'],
  'chevron-left': ['m15 18-6-6 6-6'],
  command: ['M18 9a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3Z'],
  copy: ['M8 8h11v11H8z', 'M16 8V5H5v11h3'],
  heart: ['M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.7-7.5 1.1-1.1a5.5 5.5 0 0 0 0-7.8Z'],
  home: ['m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z'],
  language: ['M5 8l6 6', 'm4 14 6-6 2-3', 'M2 5h12', 'M7 2v3', 'm14 22-5-10-5 10', 'M14 18h6'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  moon: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z'],
  search: ['m21 21-4.35-4.35', 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z', 'm9 12 2 2 4-4'],
  sparkle: ['m12 3-1.2 3.8L7 8l3.8 1.2L12 13l1.2-3.8L17 8l-3.8-1.2Z', 'm5 14-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8Z'],
  sun: ['M12 3v2', 'M12 19v2', 'm4.22 4.22 1.42 1.42', 'm18.36 18.36 1.42 1.42', 'M3 12h2', 'M19 12h2', 'm4.22 19.78 1.42-1.42', 'm18.36 5.64 1.42-1.42', 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z'],
  tool: ['m14.7 6.3 3-3a5 5 0 0 1-6.6 6.6l-6.8 6.8a2.1 2.1 0 0 0 3 3l6.8-6.8a5 5 0 0 1 6.6-6.6l-3 3Z'],
  user: ['M20 21a8 8 0 0 0-16 0', 'M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z'],
}
</script>

<template>
  <svg
    aria-hidden="true"
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    :fill="props.filled ? 'currentColor' : 'none'"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path v-for="path in paths[props.name]" :key="path" :d="path" />
  </svg>
</template>
