<script setup lang="ts">
import { RefreshCw, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'

const { applyUpdate, copy, dismiss, prompt, visible } = usePwaUpdate()
</script>

<template>
  <div
    v-if="visible"
    class="pwa-update"
    :class="{ 'pwa-update--urgent': prompt.tone === 'urgent' }"
    :role="prompt.tone === 'urgent' ? 'alert' : 'status'"
    data-pwa-update
    :data-pwa-update-blocked="prompt.blockedByWork ? 'true' : 'false'"
  >
    <div class="pwa-update__copy">
      <strong>{{ copy.title }}</strong>
      <p>{{ copy.body }}</p>
    </div>
    <div class="pwa-update__actions">
      <Button data-pwa-update-confirm @click="applyUpdate">
        <RefreshCw :size="18" aria-hidden="true" />
        {{ copy.confirmLabel }}
      </Button>
      <Button variant="ghost" data-pwa-update-dismiss @click="dismiss">
        <X :size="18" aria-hidden="true" />
        {{ copy.dismissLabel }}
      </Button>
    </div>
  </div>
</template>
