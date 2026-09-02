<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    name:
      | 'arrow-left'
      | 'arrow-right'
      | 'calendar'
      | 'calculator'
      | 'check'
      | 'chevron-left'
      | 'command'
      | 'copy'
      | 'file-text'
      | 'heart'
      | 'home'
      | 'image'
      | 'language'
      | 'menu'
      | 'moon'
      | 'search'
      | 'shield'
      | 'shuffle'
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
  calendar: ['M6 2v4', 'M18 2v4', 'M3 9h18', 'M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z'],
  calculator: ['M5 2h14a1 1 0 0 1 1 1v18H4V3a1 1 0 0 1 1-1Z', 'M7 6h10v4H7z', 'M8 14h.01', 'M12 14h.01', 'M16 14h.01', 'M8 18h.01', 'M12 18h.01', 'M16 18h.01'],
  check: ['m5 12 4 4L19 6'],
  'chevron-left': ['m15 18-6-6 6-6'],
  command: ['M18 9a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3Z'],
  copy: ['M8 8h11v11H8z', 'M16 8V5H5v11h3'],
  'file-text': ['M6 2h8l4 4v16H6z', 'M14 2v5h5', 'M9 13h6', 'M9 17h6'],
  heart: ['M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.7-7.5 1.1-1.1a5.5 5.5 0 0 0 0-7.8Z'],
  home: ['m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z'],
  image: ['M4 3h16a1 1 0 0 1 1 1v16H3V4a1 1 0 0 1 1-1Z', 'm3 16 5-5 4 4 3-3 6 6', 'M15.5 8.5h.01'],
  language: ['M5 8l6 6', 'm4 14 6-6 2-3', 'M2 5h12', 'M7 2v3', 'm14 22-5-10-5 10', 'M14 18h6'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  moon: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z'],
  search: ['m21 21-4.35-4.35', 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z', 'm9 12 2 2 4-4'],
  shuffle: ['M16 3h5v5', 'm4 20 5-5-9-9', 'M21 16v5h-5', 'm15 15 6 6', 'm4 4 5 5'],
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
