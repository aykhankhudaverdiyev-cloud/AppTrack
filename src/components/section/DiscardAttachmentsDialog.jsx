import ConfirmDialog from '../forms/ConfirmDialog'

export default function DiscardAttachmentsDialog({ attachments }) {
  const { uploads, discardAction, setDiscardAction, discard, busy, error } = attachments
  return <ConfirmDialog open={Boolean(discardAction)} wide title="Discard this entry?" cancelLabel="Keep editing"
    cancelDisabled={busy} confirmDisabled={busy} confirmLabel={uploads.length ? 'Discard and delete files' : 'Discard'}
    onCancel={() => { if (!busy) setDiscardAction(null) }}
    secondaryAction={uploads.length ? { label: 'Discard, keep files', disabled: busy, onClick: () => discard(false) } : undefined}
    onConfirm={() => discard(true)}>
    {uploads.length ? <div className="confirm-message">You uploaded {uploads.length} file{uploads.length === 1 ? '' : 's'} in this form:
      <ul>{uploads.slice(0, 3).map((file) => <li key={file.id}>{file.title}</li>)}</ul>
      {uploads.length > 3 && <span>+{uploads.length - 3} more</span>}
      <p>Files used elsewhere will be kept.</p>
    </div> : <p className="confirm-message">Your draft changes will be lost. Existing files will be kept.</p>}
    {error && <p role="alert">{error}</p>}
  </ConfirmDialog>
}
