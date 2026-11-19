import { useRef, useState } from 'react'

const FIELD = '[data-form-field]'
const CONTROL = 'input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled)'

function nativeError(input) {
  if (!input.validity || input.validity.valid) return ''
  return input.dataset.validationMessage || input.validationMessage
}

/** Keep validation rules independent of when a panel reveals their errors. */
export function usePanelValidation(ruleErrors, requiredFields) {
  const form = useRef(null)
  const [blurred, setBlurred] = useState({})
  const [nativeErrors, setNativeErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)

  const updateNative = (target, key) => {
    const error = nativeError(target)
    setNativeErrors((previous) => ({ ...previous, [key]: error }))
  }
  const fields = () => Array.from(form.current?.querySelectorAll(FIELD) || [])
  const focusField = (key) => {
    const field = fields().find((element) => element.dataset.formField === key)
    const control = field?.matches(CONTROL) ? field : field?.querySelector(CONTROL)
    control?.scrollIntoView({ block: 'center', inline: 'nearest' })
    control?.focus({ preventScroll: true })
  }

  const invalidFields = { ...ruleErrors }
  for (const [key, error] of Object.entries(nativeErrors)) if (error) invalidFields[key] = error
  const errors = Object.fromEntries(Object.entries(invalidFields).filter(([key]) => submitted || blurred[key]))

  return {
    errors, invalidFields, requiredFields, submitted, focusField,
    formProps: {
      ref: form,
      noValidate: true,
      onChangeCapture: ({ target }) => {
        const field = target.closest(FIELD)
        if (field && target.validity) updateNative(target, field.dataset.formField)
      },
      onBlurCapture: ({ target, relatedTarget }) => {
        const field = target.closest(FIELD)
        if (!field || (relatedTarget && (field.contains(relatedTarget) || relatedTarget.closest?.(FIELD)?.dataset.formField === field.dataset.formField))) return
        const key = field.dataset.formField
        if (target.validity) updateNative(target, key)
        setBlurred((previous) => ({ ...previous, [key]: true }))
      },
    },
    validateSubmit() {
      const elements = fields()
      const currentNative = {}
      for (const field of elements) {
        const input = field.validity ? field : field.querySelector('input, textarea, select')
        if (input) currentNative[field.dataset.formField] = nativeError(input)
      }
      setNativeErrors(currentNative)
      setSubmitted(true)
      const invalid = { ...ruleErrors, ...Object.fromEntries(Object.entries(currentNative).filter(([, message]) => message)) }
      const first = elements.find((field) => invalid[field.dataset.formField])?.dataset.formField
      if (first) requestAnimationFrame(() => focusField(first))
      return !Object.keys(invalid).length
    },
  }
}
