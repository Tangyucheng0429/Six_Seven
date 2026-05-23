import { ref } from 'vue'

const DEFAULT_HINT = 'Please fill in all required fields.'

export function useFormValidation() {
  const shaking = ref(false)
  const hint = ref('')
  const errors = ref({})

  function hasError(key) {
    return key in errors.value
  }

  function fieldHint(key) {
    const msg = errors.value[key]
    return typeof msg === 'string' ? msg : 'Required'
  }

  function clearField(key) {
    if (!(key in errors.value)) return
    const next = { ...errors.value }
    delete next[key]
    errors.value = next
    if (!Object.keys(next).length) hint.value = ''
  }

  function triggerShake(message = DEFAULT_HINT) {
    hint.value = message
    shaking.value = false
    requestAnimationFrame(() => {
      shaking.value = true
      setTimeout(() => {
        shaking.value = false
      }, 500)
    })
  }

  /** @param {{ key: string, valid: boolean, message?: string }[]} checks */
  function validate(checks, message = DEFAULT_HINT) {
    const next = {}
    let ok = true
    for (const { key, valid, message: fieldMessage } of checks) {
      if (!valid) {
        next[key] = fieldMessage || 'Required'
        ok = false
      }
    }
    errors.value = next
    if (!ok) triggerShake(message)
    else hint.value = ''
    return ok
  }

  function reset() {
    shaking.value = false
    hint.value = ''
    errors.value = {}
  }

  return {
    shaking,
    hint,
    errors,
    hasError,
    fieldHint,
    clearField,
    validate,
    triggerShake,
    reset,
  }
}

export function isFilled(value) {
  return String(value ?? '').trim().length > 0
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim())
}
