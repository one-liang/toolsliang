<script setup lang="ts">
import { Separator, type SeparatorProps } from 'reka-ui'

withDefaults(defineProps<SeparatorProps>(), {
  orientation: 'horizontal',
  decorative: true,
})
</script>

<template>
  <Separator data-slot="separator" class="ui-separator" v-bind="$props" />
</template>
