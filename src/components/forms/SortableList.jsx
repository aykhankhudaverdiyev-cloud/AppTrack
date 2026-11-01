/**
 * ============================================================================
 * SortableList — drag-to-reorder + keyboard buttons (principles #8, #10)
 * ============================================================================
 * Ranking matters: Common App takes the TOP 10 activities, honors Top 5.
 * HTML5 drag & drop for mouse; visible ↑/↓ buttons for keyboard and phones.
 *
 * <SortableList items={items} onReorder={setItems} renderItem={(item) => ...} />
 * ============================================================================
 */
import { useState } from 'react'
import './forms.css'

export default function SortableList({ items, onReorder, renderItem, getKey = (item, i) => item.id ?? i }) {
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)

  const move = (from, to) => {
    if (to < 0 || to >= items.length || from === to) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onReorder?.(next)
  }

  return (
    <ol className="sortable-list">
      {items.map((item, index) => {
        const key = getKey(item, index)
        return (
          <li
            key={key}
            className={`sortable-item${dragIndex === index ? ' sortable-dragging' : ''}${overIndex === index && dragIndex !== null && dragIndex !== index ? ' sortable-over' : ''}`}
            draggable
            onDragStart={(e) => {
              setDragIndex(index)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setOverIndex(index)
            }}
            onDragLeave={() => setOverIndex((v) => (v === index ? null : v))}
            onDrop={(e) => {
              e.preventDefault()
              if (dragIndex !== null) move(dragIndex, index)
              setDragIndex(null)
              setOverIndex(null)
            }}
            onDragEnd={() => {
              setDragIndex(null)
              setOverIndex(null)
            }}
          >
            <span className="sortable-grip" aria-hidden="true" title="Drag to reorder">⋮⋮</span>
            <span className="sortable-rank" aria-label={`Rank ${index + 1}`}>{index + 1}</span>
            <div className="sortable-content">{renderItem?.(item, index)}</div>
            <span className="sortable-buttons">
              <button
                type="button"
                className="sortable-btn"
                aria-label="Move up"
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="sortable-btn"
                aria-label="Move down"
                disabled={index === items.length - 1}
                onClick={() => move(index, index + 1)}
              >
                ↓
              </button>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
