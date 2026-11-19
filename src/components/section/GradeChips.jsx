import ChipGroup from './ChipGroup'

const GRADES = [9, 10, 11, 12].map((grade) => ({ value: grade, label: String(grade) }))

export default function GradeChips({ value, onChange, error, required, fieldKey }) {
  return <ChipGroup label="Grade levels" fieldKey={fieldKey} options={GRADES} value={value} required={required}
    equal labelHint="US grade levels" error={error} onChange={(grades) => onChange([...grades].sort((a, b) => a - b))} />
}
