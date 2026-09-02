<script setup lang="ts">
import { Check, Clipboard, RotateCcw } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { convertNtd } from '@/features/tools/ntd-uppercase/domain/convert'

const { locale } = useAppLocale()
const amount = ref('12850.50')
const copied = ref(false)
const resultState = computed(() => {
  try {
    return { conversion: convertNtd(amount.value), error: '' }
  }
  catch (caught) {
    return {
      conversion: null,
      error: caught instanceof Error ? caught.message : '無法轉換此金額。',
    }
  }
})
const conversion = computed(() => resultState.value.conversion)
const error = computed(() => resultState.value.error)

async function copyResult() {
  if (!conversion.value) return
  await navigator.clipboard.writeText(conversion.value.uppercase)
  copied.value = true
  window.setTimeout(() => { copied.value = false }, 1600)
}

function reset() {
  amount.value = ''
  copied.value = false
}
</script>

<template>
  <Card class="tool-workspace" :aria-busy="false">
    <div class="tool-workspace__grid">
      <div class="field-group">
        <label for="ntd-amount">{{ locale === 'en' ? 'Amount (NTD)' : '輸入金額（新台幣）' }}</label>
        <Input
          id="ntd-amount"
          v-model="amount"
          inputmode="decimal"
          autocomplete="off"
          aria-describedby="ntd-help ntd-error"
          :aria-invalid="Boolean(error)"
          placeholder="例如：12,850.50"
        />
        <p id="ntd-help" class="field-help">
          {{ locale === 'en' ? 'Up to two decimal places. Conversion runs in this browser.' : '最多兩位小數；轉換只在此瀏覽器執行。' }}
        </p>
        <p v-if="error" id="ntd-error" class="field-error" role="alert">{{ error }}</p>
      </div>

      <div class="result-panel" aria-live="polite">
        <span class="result-panel__label">{{ locale === 'en' ? 'Result' : '轉換結果' }}</span>
        <strong>{{ conversion?.uppercase ?? '—' }}</strong>
        <span v-if="conversion" class="result-panel__amount">NT$ {{ conversion.normalized }}</span>
      </div>
    </div>

    <div class="tool-workspace__actions">
      <Button :disabled="!conversion" @click="copyResult">
        <Check v-if="copied" :size="18" aria-hidden="true" />
        <Clipboard v-else :size="18" aria-hidden="true" />
        {{ copied ? (locale === 'en' ? 'Copied' : '已複製') : (locale === 'en' ? 'Copy result' : '複製結果') }}
      </Button>
      <Button variant="outline" @click="reset">
        <RotateCcw :size="18" aria-hidden="true" />
        {{ locale === 'en' ? 'Clear' : '清除' }}
      </Button>
    </div>
  </Card>
</template>
