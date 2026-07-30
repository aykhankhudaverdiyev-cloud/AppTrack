import codecs

with codecs.open("src/pages/StudentDashboard.jsx", "r", encoding="utf-8") as f:
    content = f.read()

start = 30113
end = 30579
lic_start = 35157
lic_end = 35613

new_applications = """        {activeTab === 'applications' && (
          <section className="students-section">
            <div className="section-head section-head--stack">
              <div>
                <h3>My Applications</h3>
                <p className="section-head__sub">
                  Create, edit, and organize each application and its documents.
                </p>
              </div>
              <button
                className="solid-btn solid-btn--sm"
                type="button"
                onClick={() => setAppModal({ open: true, application: null })}
              >
                <span className="btn-plus">+</span> New application
              </button>
            </div>

            <div className="application-list">
              {(me.applications || []).map((application) => {
                const expanded = expandedApplications.includes(application.id)
                return (
                  <div
                    key={application.id}
                    className={"application-card " + (expanded ? "application-card--open" : "")}
                  >
                    <button
                      type="button"
                      className="application-card__top"
                      onClick={() => toggleApplicationExpanded(application.id)}
                    >
                      <div className="application-card__id">
                        <div className="application-card__logo">
                          {application.university?.[0] || "U"}
                        </div>
                        <div className="application-card__id-text">
                          <h4>{application.university}</h4>
                          <p>{application.program || application.major || "General Application"}</p>
                        </div>
                      </div>
                      <div className="application-card__top-meta">
                        <VisibilityChip value={application.visibility} />
                        <StatusBadge variant={statusVariant(application.status)}>
                          {application.status}
                        </StatusBadge>
                        <span className="chevron">{expanded ? "\u25BE" : "\u25B8"}</span>
                      </div>
                    </button>

                    {expanded && (
                      <div className="application-card__expand">
                        <div className="application-toolbar">
                          <VisibilityToggle
                            value={application.visibility}
                            onChange={(v) => handleApplicationVisibility(application.id, v)}
                          />
                          <div className="application-toolbar__actions">
                            <button
                              type="button"
                              className="mini-btn"
                              onClick={() => setAppModal({ open: true, application })}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="mini-btn mini-btn--danger"
                              onClick={() => handleDeleteApplication(application.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        <div className="application-card__meta">
                          <div className="meta-cell">
                            <span>Term</span>
                            <strong>{application.term || "\u2014"}</strong>
                          </div>
                          <div className="meta-cell">
                            <span>Major</span>
                            <strong>{application.major || "\u2014"}</strong>
                          </div>
                          <div className="meta-cell">
                            <span>Decision</span>
                            <strong>{application.decision || "\u2014"}</strong>
                          </div>
                          <div className="meta-cell">
                            <span>Recommendation</span>
                            <strong>{application.recommendation || "\u2014"}</strong>
                          </div>
                          <div className="meta-cell">
                            <span>Deadline</span>
                            <strong>{application.deadline || "\u2014"}</strong>
                          </div>
                          <div className="meta-cell">
                            <span>Status</span>
                            <strong>{application.status || "\u2014"}</strong>
                          </div>
                        </div>

                        {application.notes && (
                          <div className="application-notes">
                            <span>Notes</span>
                            <p>{application.notes}</p>
                          </div>
                        )}

                        <div className="doc-groups">
                          {DOC_CATEGORIES.map((category) => (
                            <DocumentGroup
                              key={category.key}
                              application={application}
                              category={category}
                              onUpload={handleApplicationDocumentUpload}
                              onRemove={handleApplicationDocumentRemove}
                              onVisibilityChange={handleDocumentVisibility}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {!(me.applications || []).length && (
                <div className="empty-state empty-state--cert">
                  <div className="empty-state__icon">\uD83C\uDFA9</div>
                  <h4>No applications yet</h4>
                  <p>Create your first university application.</p>
                  <button
                    type="button"
                    className="solid-btn solid-btn--sm"
                    onClick={() => setAppModal({ open: true, application: null })}
                  >
                    New application
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'licenses'"""

# Replace
new_content = content[:start] + new_applications + content[lic_end:]

with codecs.open("src/pages/StudentDashboard.jsx", "w", encoding="utf-8") as f:
    f.write(new_content)

print("Done!")
