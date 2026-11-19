import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './section.css'

export default function TagSelect({ label, value, options, onChange }) {
  const id = useId()
  const trigger = useRef(null)
  const list = useRef(null)
  const [position, setPosition] = useState(null)
  const [active, setActive] = useState(0)
  const selected = options.findIndex((option) => option.value === value)
  const open = position !== null

  const locate = () => {
    const rect = trigger.current.getBoundingClientRect()
    const width = Math.min(Math.max(rect.width, 224), window.innerWidth - 16)
    const below = window.innerHeight - rect.bottom - 14
    const above = rect.top - 14
    const flip = below < Math.min(options.length * 36 + 10, 240) && above > below
    return {
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), width,
      maxHeight: Math.min(300, Math.max(40, flip ? above : below)),
      ...(flip ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
    }
  }

  useEffect(() => {
    if (!open) return
    const outside = (event) => {
      if (!trigger.current?.contains(event.target) && !list.current?.contains(event.target)) setPosition(null)
    }
    const dismiss = (event) => {
      if (!list.current?.contains(event?.target)) setPosition(null)
    }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', dismiss)
    window.addEventListener('scroll', dismiss, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('scroll', dismiss, true)
    }
  }, [open])

  useEffect(() => {
    const popup = list.current
    const option = popup?.children[active]
    if (!open || !option) return
    const box = option.getBoundingClientRect()
    const viewport = popup.getBoundingClientRect()
    if (box.top < viewport.top) popup.scrollTop -= viewport.top - box.top
    else if (box.bottom > viewport.bottom) popup.scrollTop += box.bottom - viewport.bottom
  }, [open, active])

  const show = (index = Math.max(0, selected)) => {
    setActive(index)
    setPosition(locate())
  }
  const choose = (index) => {
    if (options[index]) onChange(options[index].value)
    setPosition(null)
    trigger.current?.focus()
  }
  const onKeyDown = (event) => {
    const { key } = event
    if (key === 'Tab') { setPosition(null); return }
    if (key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      setPosition(null)
    } else if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault()
      if (!open) show(selected >= 0 ? selected : key === 'ArrowUp' ? options.length - 1 : 0)
      else setActive((index) => (index + (key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
    } else if (open && (key === 'Enter' || key === ' ')) {
      event.preventDefault()
      choose(active)
    } else if (open && (key === 'Home' || key === 'End')) {
      event.preventDefault()
      setActive(key === 'Home' ? 0 : options.length - 1)
    }
  }

  return (
    <>
      <button type="button" className="tag-select" ref={trigger} role="combobox" aria-label={label}
        aria-expanded={open} aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onKeyDown={onKeyDown} onBlur={() => setPosition(null)} onClick={() => open ? setPosition(null) : show()}>
        <span>{options[selected]?.label ?? 'Select'}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>
      {open && createPortal(
        <div className="tag-select__list" id={id} ref={list} style={position} role="listbox" aria-label={label}>
          {options.map((option, index) => (
            <div key={option.value} id={`${id}-${index}`} role="option" aria-selected={index === selected}
              className={`tag-select__option${index === active ? ' tag-select__option--active' : ''}`}
              onMouseDown={(event) => event.preventDefault()} onClick={() => choose(index)}>
              {option.label}{index === selected && <span aria-hidden="true">✓</span>}
            </div>
          ))}
        </div>, document.body,
      )}
    </>
  )
}
