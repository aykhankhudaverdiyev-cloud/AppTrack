with open("src/pages/StudentDashboard.jsx", "r") as f:
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
                  <div className="empty-state__icon">🎓</div>
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

new_licenses = """        {activeTab === 'licenses' && (
          <section className="students-section">
            <div className="section-head section-head--stack">
              <div>
                <h3>My Certifications</h3>
                <p className="section-head__sub">
                  Add credentials with score, issuer, and visibility.
                </p>
              </div>
              <button
                className="solid-btn solid-btn--sm"
                type="button"
                onClick={() => setLicenseModal({ open: true, license: null })}
              >
                <span className="btn-plus">+</span> Add
              </button>
            </div>

            <div className="cert-list">
              {(me.licenses || []).map((license) => (
                <div key={license.id} className="cert-item">
                  <div className="cert-item__logo">
                    {(license.name || "C").trim()[0]?.toUpperCase()}
                  </div>

                  <div className="cert-item__body">
                    <div className="cert-item__row">
                      <h4 className="cert-item__name">{license.name}</h4>
                      <div className="cert-item__actions">
                        <button
                          type="button"
                          className="icon-btn"
                          title="Edit"
                          onClick={() => setLicenseModal({ open: true, license })}
                        >
                          \u270E
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn--danger"
                          title="Delete"
                          onClick={() => handleDeleteLicense(license.id)}
                        >
                          \uD83D\uDDD1
                        </button>
                      </div>
                    </div>

                    {license.issuer && <p className="cert-item__issuer">{license.issuer}</p>}

                    {(license.issueMonth || license.issueYear || license.expireMonth || license.expireYear || license.score) && (
                      <p className="cert-item__meta">
                        {(license.issueMonth || license.issueYear) && (
                          <span>
                            Issued {[license.issueMonth, license.issueYear].filter(Boolean).join(" ")}
                          </span>
                        )}
                        {(license.expireMonth || license.expireYear) && (
                          <span>
                            {" "}\u00B7 Expires {[license.expireMonth, license.expireYear].filter(Boolean).join(" ")}
                          </span>
                        )}
                        {license.score && <span>{" "}\u00B7 Score {license.score}</span>}
                      </p>
                    )}

                    {license.credentialId && (
                      <p className="cert-item__cred">Credential ID {license.credentialId}</p>
                    )}

                    <div className="cert-item__foot">
                      <VisibilityToggle
                        value={license.visibility}
                        onChange={(v) => handleLicenseVisibility(license.id, v)}
                      />
                      {license.credentialUrl && (
                        <a
                          className="pill-link"
                          href={license.credentialUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Show credential \u2197
                        </a>
                      )}
                      {(license.media || []).map((m) => (
                        <span key={m.id} className="pill-link pill-link--file">
                          {m.url ? (
                            <a href={m.url} target="_blank" rel="noreferrer">\uD83D\uDCC4 {m.name}</a>
                          ) : (
                            <>\uD83D\uDCC4 {m.name}</>
                          )}
                          <button
                            type="button"
                            className="chip-x"
                            onClick={() => handleLicenseMediaRemove(m.id)}
                            title="Remove"
                          >
                            \u2715
                          </button>
                        </span>
                      ))}
                      <label
                        htmlFor={"license-media-upload-" + license.id}
                        className="pill-link pill-link--upload"
                      >
                        + Upload PDF
                      </label>
                      <input
                        id={"license-media-upload-" + license.id}
                        type="file"
                        accept="application/pdf"
                        className="file-input-hidden"
                        onChange={(e) => {
                          handleLicenseMediaUpload(license.id, e.target.files?.[0])
                          e.target.value = ""
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {!(me.licenses || []).length && (
                <div className="empty-state empty-state--cert">
                  <div className="empty-state__icon">🎓</div>
                  <h4>No certifications yet</h4>
                  <p>Add IELTS, SAT, GRE, or other credentials with score and evidence.</p>
                  <button
                    type="button"
                    className="solid-btn solid-btn--sm"
                    onClick={() => setLicenseModal({ open: true, license: null })}
                  >
                    Add certification
                  </button>
                </div>
              )}
            </div>
          </section>
        )}"""

# Replace
new_content = content[:start] + new_applications + content[lic_end:]

with open("src/pages/StudentDashboard.jsx", "w") as f:
    f.write(new_content)

print("Done!")
