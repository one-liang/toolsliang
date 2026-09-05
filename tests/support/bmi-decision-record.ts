import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { bmiUnitFactors } from '@/features/tools/bmi-calculator/domain/reference'

/**
 * The BMI decision record is the single source the modules answer to. Both the
 * reference test (which recomputes the vectors independently) and the
 * calculator test (which runs them through the shipped calculator) read the
 * tables from here, so the parsing rules cannot drift between the two.
 */
export const bmiDecisionRecord = readFileSync(
  resolve(process.cwd(), 'docs/research/001-bmi-formula-and-health-sources.md'),
  'utf8',
)

interface DocumentedResult {
  /** Height and weight normalized to the units the published formula takes. */
  heightMetres: number
  weightKilograms: number
  documentedBmi: number
  documentedDisplay: string
  documentedCategory: string
}

export interface DocumentedMetricVector extends DocumentedResult {
  heightCentimetres: number
}

export interface DocumentedImperialVector extends DocumentedResult {
  feet: number
  inches: number
  pounds: number
}

/** Rows of the decision record's metric vector table (section 5.5). */
export function parseMetricVectors(): DocumentedMetricVector[] {
  const pattern = /^\| (\d+(?:\.\d+)?) cm \| (\d+(?:\.\d+)?) kg \| (\d+\.\d+) \| (\d+\.\d) \| `([a-z-]+)` \|/gm

  return [...bmiDecisionRecord.matchAll(pattern)].map(([, height, weight, bmi, display, category]) => ({
    heightCentimetres: Number(height),
    heightMetres: Number(height) / 100,
    weightKilograms: Number(weight),
    documentedBmi: Number(bmi),
    documentedDisplay: display!,
    documentedCategory: category!,
  }))
}

/** Rows of the decision record's imperial vector table (section 5.6). */
export function parseImperialVectors(): DocumentedImperialVector[] {
  const pattern = /^\| (\d+) ft (\d+(?:\.\d+)?) in \| (\d+(?:\.\d+)?) lb \|[^|]+\| (\d+\.\d+) \| (\d+\.\d) \| `([a-z-]+)` \|/gm

  return [...bmiDecisionRecord.matchAll(pattern)].map(([, feet, inches, pounds, bmi, display, category]) => ({
    feet: Number(feet),
    inches: Number(inches),
    pounds: Number(pounds),
    heightMetres: Number(feet) * bmiUnitFactors.footToMetre + Number(inches) * bmiUnitFactors.inchToMetre,
    weightKilograms: Number(pounds) * bmiUnitFactors.poundToKilogram,
    documentedBmi: Number(bmi),
    documentedDisplay: display!,
    documentedCategory: category!,
  }))
}
