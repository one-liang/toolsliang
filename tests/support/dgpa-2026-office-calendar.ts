/**
 * The 2026 (ROC 115) government agency office calendar as the DGPA announced
 * it, written down from the announcement rather than read from the baked year,
 * so the year view is held to what the authority published and not to itself.
 *
 * Source: DGPA press release 「修正 114 年並核定 115 年政府行政機關辦公日曆表」
 * (https://www.dgpa.gov.tw/information?uid=82&pid=12574): 120 days off, nine
 * stretches of three days or more, and no makeup workday — the directions
 * revised on 2025-06-13 deleted 補行上班. Every day not listed here follows its
 * weekday: Saturday and Sunday off, Monday to Friday at work.
 */
export const dgpa2026DaysOffTotal = 120

export const dgpa2026Holidays: Array<{ name: string, from: string, to: string }> = [
  { name: '開國紀念日', from: '2026-01-01', to: '2026-01-01' },
  { name: '春節', from: '2026-02-14', to: '2026-02-22' },
  { name: '和平紀念日', from: '2026-02-27', to: '2026-03-01' },
  { name: '兒童節及清明節', from: '2026-04-03', to: '2026-04-06' },
  { name: '勞動節', from: '2026-05-01', to: '2026-05-03' },
  { name: '端午節', from: '2026-06-19', to: '2026-06-21' },
  { name: '中秋節及孔子誕辰紀念日／教師節', from: '2026-09-25', to: '2026-09-28' },
  { name: '國慶日', from: '2026-10-09', to: '2026-10-11' },
  { name: '臺灣光復暨金門古寧頭大捷紀念日', from: '2026-10-24', to: '2026-10-26' },
  { name: '行憲紀念日', from: '2026-12-25', to: '2026-12-27' },
]

export const dgpa2026MakeupWorkdays: string[] = []

/** Every date of 2026 the announcement gives off, weekends included. */
export function dgpa2026DaysOff(): Set<string> {
  const off = new Set<string>()
  for (let time = Date.UTC(2026, 0, 1); time < Date.UTC(2027, 0, 1); time += 86_400_000) {
    const weekday = new Date(time).getUTCDay()
    if (weekday === 0 || weekday === 6) off.add(new Date(time).toISOString().slice(0, 10))
  }
  for (const holiday of dgpa2026Holidays) {
    for (let time = Date.parse(`${holiday.from}T00:00:00Z`); time <= Date.parse(`${holiday.to}T00:00:00Z`); time += 86_400_000) {
      off.add(new Date(time).toISOString().slice(0, 10))
    }
  }
  return off
}
