<script setup lang="ts">
const { t } = usePrototype()
const amount = ref('12850')
const copied = ref(false)

const digits = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖']
const units = ['', '拾', '佰', '仟']
const bigUnits = ['', '萬', '億', '兆']

const sectionToChinese = (value: number) => {
  let result = ''
  let zeroPending = false
  for (let position = 0; position < 4; position += 1) {
    const digit = value % 10
    if (digit === 0) {
      if (result) zeroPending = true
    } else {
      result = `${zeroPending ? '零' : ''}${digits[digit]}${units[position]}${result}`
      zeroPending = false
    }
    value = Math.floor(value / 10)
  }
  return result
}

const uppercaseAmount = computed(() => {
  const sanitized = amount.value.replace(/[^\d.]/g, '')
  const value = Math.max(0, Math.min(Number(sanitized || 0), 999_999_999_999))
  if (!Number.isFinite(value)) return '請輸入有效金額'
  const integer = Math.floor(value)
  const decimal = Math.round((value - integer) * 100)
  let remaining = integer
  let sectionIndex = 0
  let integerText = ''
  let needsZero = false
  while (remaining > 0) {
    const section = remaining % 10000
    if (section === 0) {
      if (integerText) needsZero = true
    } else {
      const sectionText = sectionToChinese(section)
      integerText = `${sectionText}${bigUnits[sectionIndex]}${needsZero ? '零' : ''}${integerText}`
      needsZero = section < 1000
    }
    remaining = Math.floor(remaining / 10000)
    sectionIndex += 1
  }
  const jiao = Math.floor(decimal / 10)
  const fen = decimal % 10
  const decimalText = decimal === 0 ? '整' : `${jiao ? `${digits[jiao]}角` : ''}${fen ? `${digits[fen]}分` : ''}`
  return `新臺幣${integerText || '零'}元${decimalText}`
})

const copyResult = async () => {
  copied.value = true
  if (navigator.clipboard) await navigator.clipboard.writeText(uppercaseAmount.value)
  window.setTimeout(() => (copied.value = false), 1400)
}
</script>

<template>
  <section class="tool-workspace" aria-labelledby="workspace-title">
    <header class="tool-workspace__header">
      <div>
        <p class="eyebrow">{{ t('代表性工具工作區', 'REPRESENTATIVE WORKSPACE') }}</p>
        <h2 id="workspace-title">{{ t('新臺幣國字大寫', 'NTD uppercase converter') }}</h2>
      </div>
      <span class="local-chip"><UiIcon name="shield" />{{ t('只在本機', 'Local only') }}</span>
    </header>

    <div class="tool-workspace__body">
      <div class="amount-field">
        <label for="amount">{{ t('輸入新臺幣金額', 'Enter an amount in NTD') }}</label>
        <div>
          <span>NT$</span>
          <input id="amount" v-model="amount" inputmode="decimal" autocomplete="off">
          <button type="button" @click="amount = ''">{{ t('清除', 'Clear') }}</button>
        </div>
        <p>{{ t('可輸入整數或小數，最多至兆位。', 'Enter a whole or decimal amount, up to trillions.') }}</p>
      </div>

      <div class="result-panel" aria-live="polite">
        <div>
          <span>{{ t('轉換結果', 'RESULT') }}</span>
          <button type="button" @click="copyResult">
            <UiIcon :name="copied ? 'check' : 'copy'" />
            {{ copied ? t('已複製', 'Copied') : t('複製', 'Copy') }}
          </button>
        </div>
        <output>{{ uppercaseAmount }}</output>
      </div>
    </div>

    <footer>
      <span><i />{{ t('輸入與結果都不會離開這個頁面', 'Input and result never leave this page') }}</span>
      <button type="button">{{ t('查看填寫規則', 'View formatting rules') }} <UiIcon name="arrow-right" /></button>
    </footer>
  </section>
</template>
