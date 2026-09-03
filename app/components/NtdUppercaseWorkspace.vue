<script setup lang="ts">
import { Check, Clipboard, RotateCcw } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { convertNtd } from '@/features/tools/ntd-uppercase/domain/convert'

const { locale } = useAppLocale()
const digitReference = [
  { first: ['0', '零'], second: ['5', '伍'] },
  { first: ['1', '壹'], second: ['6', '陸'] },
  { first: ['2', '貳'], second: ['7', '柒'] },
  { first: ['3', '參'], second: ['8', '捌'] },
  { first: ['4', '肆'], second: ['9', '玖'] },
] as const
const amount = ref('')
const copied = ref(false)
const resultState = computed(() => {
  if (!amount.value.trim()) return { conversion: null, error: '' }

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
          :aria-describedby="error ? 'ntd-help ntd-error' : 'ntd-help'"
          :aria-invalid="Boolean(error)"
          :placeholder="locale === 'en' ? 'e.g. 12,850.50' : '例如：12,850.50'"
        />
        <p id="ntd-help" class="field-help">
          {{ locale === 'en' ? 'Up to two decimal places.' : '最多兩位小數。' }}
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
      <Button class="tool-workspace__copy" :disabled="!conversion" @click="copyResult">
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

  <section class="tool-reference" aria-labelledby="ntd-digit-reference">
    <div class="tool-section-heading">
      <p class="eyebrow">{{ locale === 'en' ? 'Quick reference' : '快速對照' }}</p>
      <h2 id="ntd-digit-reference">{{ locale === 'en' ? 'Number to formal Chinese numeral' : '數字與國字對照' }}</h2>
      <p>{{ locale === 'en' ? 'Use this table to see how each digit appears in the converted result.' : '可先從單一數字了解轉換結果使用的國字大寫。' }}</p>
    </div>

    <div class="tool-reference__table">
      <table>
        <caption class="sr-only">{{ locale === 'en' ? 'Number and formal Chinese numeral reference' : '數字與國字大寫對照' }}</caption>
        <thead>
          <tr>
            <th scope="col">{{ locale === 'en' ? 'Number' : '數字' }}</th>
            <th scope="col">{{ locale === 'en' ? 'Formal Chinese numeral' : '國字大寫' }}</th>
            <th scope="col">{{ locale === 'en' ? 'Number' : '數字' }}</th>
            <th scope="col">{{ locale === 'en' ? 'Formal Chinese numeral' : '國字大寫' }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in digitReference" :key="item.first[0]">
            <td>{{ item.first[0] }}</td>
            <td>{{ item.first[1] }}</td>
            <td>{{ item.second[0] }}</td>
            <td>{{ item.second[1] }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
