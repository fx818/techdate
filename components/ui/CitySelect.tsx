'use client'

import { INDIAN_CITIES } from '@/lib/cities'

// Searchable city input: a native <datalist> typeahead over INDIAN_CITIES that
// also accepts free text (so any town not in the list can still be entered).
export function CitySelect({
  value,
  onChange,
  placeholder = 'City',
  className = 'input',
}: {
  value: string
  onChange: (city: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <>
      <input
        list="india-cities"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      <datalist id="india-cities">
        {INDIAN_CITIES.map(c => <option key={c} value={c} />)}
      </datalist>
    </>
  )
}
