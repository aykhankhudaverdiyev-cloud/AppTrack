/* eslint-disable react-refresh/only-export-components -- dev-only entry, never hot-reloaded into the app */
/** ============================================================================
 * educationPreview — design-review entry for the Education page
 * ============================================================================
 * Renders the real page container, top-of-screen chrome (profile card, six
 * stat cards, navigation card) and the real EducationSection + panel, with
 * the data layer aliased to src/preview/educationMockApi.js.
 *
 * Run: npm run dev:education  (vite.preview.config.js)
 * Never linked from the app or included in `npm run build`.
 * ============================================================================ */

import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import EducationSection from '../components/academic/EducationSection'
import '../pages/StudentDashboard.css'
import '../index.css'

const STATS = [
  { label: 'Profile', value: '7%', icon: '📈', tone: 'indigo', hint: 'completion score' },
  { label: 'Applications', value: '0', icon: '📄', tone: 'sky', hint: 'total tracked' },
  { label: 'Submitted', value: '0', icon: '✅', tone: 'emerald', hint: 'applications sent' },
  { label: 'Certifications', value: '0', icon: '🏆', tone: 'amber', hint: 'earned so far' },
  { label: 'Recommenders', value: '0', icon: '✉️', tone: 'violet', hint: 'writing for you' },
  { label: 'App Progress', value: '0%', icon: '⚡', tone: 'rose', hint: 'in progress' },
]

const NAV = [
  { label: 'Main', tabs: ['Overview', 'My Profile'] },
  { label: 'Academic', tabs: ['Education', 'Test Scores', 'Honors & Awards'], active: 'Education' },
  { label: 'Activities', tabs: ['Activities', 'Projects'] },
  { label: 'Admissions', tabs: ['Applications', 'Documents', 'Recommendations', 'Portfolio'] },
]

function Preview() {
  return (
    <div className="student-shell">
      <main className="dashboard-content">
        <section className="new-hero-card">
          <div className="new-hero-card__body">
            <div className="new-hero-card__avatar">
              <div className="preview-avatar">AK</div>
              <div className="new-hero-card__avatar-online" />
            </div>
            <div className="new-hero-card__main">
              <div className="new-hero-card__info">
                <div className="new-hero-card__name-row">
                  <h3 className="new-hero-card__name">Aykhan Khudaverdiyev</h3>
                  <span className="new-hero-card__edit-btn" aria-hidden="true">✎</span>
                </div>
                <p className="new-hero-card__sub">Computer Science</p>
                <div className="new-hero-card__privacy-row">
                  <div className="new-hero-card__privacy-item">
                    <span className="new-hero-card__privacy-label">🔒 Profile:</span>
                    <span className="preview-visibility">🌐 Public</span>
                  </div>
                  <div className="new-hero-card__privacy-item">
                    <span className="new-hero-card__privacy-label">👁️ Photo:</span>
                    <span className="preview-visibility">🌐 Public</span>
                  </div>
                </div>
              </div>
              <div className="new-hero-card__actions">
                <button type="button" className="ghost-btn new-hero-card__preview-btn">👁️ Preview Public View</button>
              </div>
            </div>
          </div>
        </section>

        <section className="new-stats-grid">
          {STATS.map((stat) => (
            <div key={stat.label} className={`new-stat-card new-stat-card--${stat.tone}`}>
              <div className="new-stat-card__icon-wrap"><span>{stat.icon}</span></div>
              <p className="new-stat-card__value">{stat.value}</p>
              <p className="new-stat-card__label">{stat.label}</p>
              <p className="new-stat-card__hint">{stat.hint}</p>
            </div>
          ))}
        </section>

        <section className="new-tabs-wrap">
          <div className="new-tabs-scroll">
            {NAV.map((group) => (
              <div key={group.label} className="new-tab-group">
                <div className="new-tab-group__label">{group.label}</div>
                <div className="new-tab-group__pills">
                  {group.tabs.map((tab) => (
                    <button key={tab} type="button"
                      className={`new-tab-pill ${group.active === tab ? 'new-tab-pill--active' : ''}`}>
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <EducationSection userId="00000000-0000-4000-8000-000000000001" />
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <MemoryRouter initialEntries={['/student?tab=education']}>
    <Preview />
  </MemoryRouter>,
)
