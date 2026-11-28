import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import ProofBlock from './section/ProofBlock'
import FileIcon from './section/FileIcon'
import { formatSize, openDocument } from '../Services/documentsApi'

export default function DocumentGroup({ studentId, application, category, readOnly = false, allowVisibility = true }) {
  const [status, setStatus] = useState('not_started')
  const [storedLabel, setStoredLabel] = useState(category.label)
  const [statusBusy, setStatusBusy] = useState(!readOnly)
  const [statusError, setStatusError] = useState('')
  const [statusLoaded, setStatusLoaded] = useState(false)
  const docs = application.documents?.[category.key] || []

  useEffect(() => {
    if (readOnly) return undefined
    let active = true
    supabase.from('application_requirements').select('status,label').eq('user_id', studentId)
      .eq('application_id', application.id).eq('req_key', category.key).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (error) setStatusError('Could not load the requirement status.')
        else { setStatus(data?.status || 'not_started'); setStoredLabel(data?.label || category.label); setStatusLoaded(true) }
        setStatusBusy(false)
      }).catch(() => { if (active) { setStatusError('Could not load the requirement status.'); setStatusBusy(false) } })
    return () => { active = false }
  }, [studentId, application.id, category.key, readOnly])

  const changeStatus = async (next) => {
    const previous = status
    setStatus(next); setStatusBusy(true); setStatusError('')
    try {
      const { error } = await supabase.from('application_requirements').upsert({
        user_id: studentId, application_id: application.id, req_key: category.key,
        label: storedLabel, status: next,
      }, { onConflict: 'application_id,req_key' })
      if (error) throw error
    } catch { setStatus(previous); setStatusError('Could not save the requirement status. Please try again.') }
    finally { setStatusBusy(false) }
  }

  return <section className="doc-group">
    <header className="doc-group__head">
      <div className="doc-group__title"><span className="doc-group__icon" style={{ background: category.tint, color: category.color }}>{category.emoji || '📄'}</span>
        <div className="doc-group__label"><h5>{category.label}</h5><p>{category.hint || ''}</p></div></div>
      {!readOnly && <select aria-label={`${category.label} status`} value={status} disabled={statusBusy || !statusLoaded} onChange={(event) => changeStatus(event.target.value)}>
        <option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="done">Ready</option><option value="submitted">Submitted</option><option value="waived">Waived</option>
      </select>}
    </header>
    {statusError && <p role="alert">{statusError}</p>}
    <div className="doc-group__body">
      {readOnly ? docs.map((doc) => <div className="doc-chip" key={doc.id}>
        <FileIcon doc={doc} /><div className="doc-chip__info"><strong>{doc.title || doc.name}</strong><span>{formatSize(doc.size_bytes || doc.size)}</span></div>
        <button type="button" className="mini-btn" onClick={() => openDocument(doc).catch(() => setStatusError('Could not open this file.'))}>View</button>
      </div>) : <ProofBlock section="application" itemId={application.id} userId={studentId} label={category.key} title="Files" allowVisibility={allowVisibility} />}
    </div>
  </section>
}
