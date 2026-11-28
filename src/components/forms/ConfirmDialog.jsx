import { useEffect, useRef, useState } from 'react'
import './forms.css'

export default function ConfirmDialog({
  open, title = 'Delete this entry?', message, children,
  confirmLabel = 'Delete', cancelLabel = 'Cancel', danger = true,
  confirmDisabled = false, cancelDisabled = false, onConfirm, onCancel,
  secondaryAction, wide = false,
}) {
  const cancelRef = useRef(null)
  const previousFocus = useRef(null)
  const onCancelRef = useRef(onCancel)
  useEffect(() => { onCancelRef.current = onCancel }, [onCancel])
  const [visible, setVisible] = useState(open)
  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement
      // Mount immediately after opening; keep the closing animation independent of callbacks.
      let active = true
      queueMicrotask(() => { if (active) setVisible(true) })
      return () => { active = false }
    }
    const timer = setTimeout(() => setVisible(false), 150)
    previousFocus.current?.focus?.()
    return () => clearTimeout(timer)
  }, [open])
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => { if (event.key === 'Escape') { event.stopImmediatePropagation(); event.preventDefault(); onCancelRef.current?.() } }
    document.addEventListener('keydown', onKey, true)
    cancelRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, visible])
  if (!visible && !open) return null
  return (
    <div className={`confirm-overlay${!open ? ' confirm-overlay--closing' : ''}`} onClick={onCancel} role="presentation">
      <div className={`confirm-box${wide ? ' confirm-box--wide' : ''}`} role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3 className="confirm-title">{danger ? '⚠️ ' : ''}{title}</h3>
        {message && <p className="confirm-message">{message}</p>}
        {children}
        <div className="confirm-actions">
          <button type="button" ref={cancelRef} className="confirm-cancel" disabled={cancelDisabled} onClick={onCancel}>{cancelLabel}</button>
          {secondaryAction && <button type="button" className="confirm-cancel" disabled={secondaryAction.disabled} onClick={secondaryAction.onClick}>{secondaryAction.label}</button>}
          <button type="button" className={danger ? 'confirm-danger' : 'confirm-primary'} disabled={confirmDisabled} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
