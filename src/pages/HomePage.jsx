import React, { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './HomePage.css';

/*─── Tilt Card─────────────────────────────────────────────────── */
function TiltCard({ children, className, intensity = 12, onClick }) {
  const ref = useRef(null);

  const handleMouseMove = useCallback((e) => {
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform =
      `perspective(900px) rotateY(${x * intensity}deg) rotateX(${-y * intensity}deg) scale3d(1.03,1.03,1.03)`;
    el.style.boxShadow = `${-x * 14}px ${y * 14}px 50px rgba(124,58,237,0.18),0 30px 60px rgba(15,23,42,0.12)`;
  }, [intensity]);

  const handleMouseLeave = useCallback(() => {
    const el = ref.current;
    el.style.transform = '';el.style.boxShadow = '';
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

/* ─── Data───────────────────────────────────────────────────────── */
const SCHOOLS = [
  'MIT', 'Stanford', 'Harvard', 'Oxford', 'Caltech',
  'Yale', 'Columbia', 'Princeton', 'Cambridge', 'ETH Zürich',
  'NUS', 'Imperial', 'UCL', 'Cornell', 'LSE',
];

const STEPS = [
  { num: '01', icon: '🔍', title: 'Search by school', desc: 'Filter by university, major, intake year, and outcome to find applications that match your exact target.' },
  { num: '02', icon: '📄', title: 'Read real materials', desc: 'Essays, recommendation letters, personal statements, and CVs — all voluntarily shared by admitted students.' },
  { num: '03', icon: '✏️', title: 'Improve your own', desc: 'Bookmark, annotate, and draw inspiration as you draft your own application materials.' },
  { num: '04', icon: '🤝', title: 'Give back', desc: 'Once you are in, share your journey to help the next generation of applicants.' },
];

const FEATURES = [
  { icon: '📄', title: 'Motivation Essays', desc: 'Real essays for real programs. See the structure and narrative that got people accepted.', color: '#7c3aed', tint: 'rgba(124,58,237,0.1)' },
  { icon: '✉️', title: 'Recommendation Letters', desc: 'Understand what strong endorsements look like and how to guide your recommenders.', color: '#0e7490', tint: 'rgba(6,182,212,0.12)' },
  { icon: '📊', title: 'Full Profiles', desc: 'GPA, test scores, activities, and decision — the complete picture of each acceptance.', color: '#15803d', tint: 'rgba(34,197,94,0.12)' },
  { icon: '🔍', title: 'Smart Filters', desc: 'Filter by school, major, region, scholarship status, round, and outcome.', color: '#b45309', tint: 'rgba(249,115,22,0.12)' },
  { icon: '🔖', title: 'Bookmarks & Notes', desc: 'Save and annotate your favourites as you research and draft your applications.', color: '#7c3aed', tint: 'rgba(124,58,237,0.1)' },
  { icon: '🤝', title: 'Peer Reviews', desc: 'Get candid feedback on your draft essay from students who have been there.', color: '#0e7490', tint: 'rgba(6,182,212,0.12)' },
];

const SAMPLES = [
  {
    school: 'MIT', schoolLetter: 'M',
    type: 'Motivation Essay',
    title: 'Computer Science & AI',
    term: 'Fall 2024',
    excerpt: '"I was twelve when I held a broken circuit board and wondered why it had stopped talking to the world. That question has never left me…"',
    meta: 'GPA 3.95· SAT 1560',
    decision: 'Accepted',
    decisionColor: 'green',
  },
  {
    school: 'Stanford', schoolLetter: 'S',
    type: 'Personal Statement',
    title: 'Human Biology',
    term: 'Fall 2025',
    excerpt: '"Translating between my grandmother and her doctor taught me that medicine is never just science — it is language, culture, and trust…"',
    meta: 'GPA 4.0 · ACT 35',
    decision: 'Accepted',
    decisionColor: 'green',
  },
  {
    school: 'Oxford', schoolLetter: 'O',
    type: 'Recommendation Letter',
    title: 'PPE Programme',
    term: 'Oct 2024',
    excerpt: '"In three years of teaching, I have rarely encountered a student who argues with both the rigour of a scholar and the curiosity of a child…"',
    meta: 'A*A*A Predicted',
    decision: 'Accepted',
    decisionColor: 'green',
  },
];

const STATS = [
  { value: '12K+', label: 'Materials shared' },
  { value: '4,800', label: 'Students helped' },
  { value: '340+', label: 'Universities' },
  { value: '92%', label: 'Found it useful' },
];

/* ─── Marquee ────────────────────────────────────────────────────── */
function Marquee() {
  const doubled = [...SCHOOLS, ...SCHOOLS];
  return (
    <div className="hp-marquee-outer" aria-hidden="true">
      <div className="hp-marquee-track">
        {doubled.map((s, i) => (
          <span key={i} className="hp-school-pill">{s}</span>
        ))}
      </div>
    </div>
  );
}

/* ─── Hero Visual (floating3-D cards) ──────────────────────────── */
function HeroVisual() {
  return (
    <div className="hp-hero-scene" aria-hidden="true">
      {/* Ambient orbs */}
      <div className="hp-orb hp-orb--purple" />
      <div className="hp-orb hp-orb--cyan" />
      <div className="hp-orb hp-orb--green" />

      {/* Floating card 1 — application */}
      <div className="hp-float-card hp-float-card--1">
        <div className="hp-float-card__stripe" />
        <div className="hp-fc-top">
          <div className="hp-fc-logo">M</div>
          <div className="hp-fc-id">
            <strong>MIT</strong>
            <span>Computer Science · Fall 2024</span>
          </div>
          <span className="hp-fc-badge hp-fc-badge--green">✓ Accepted</span>
        </div>
        <div className="hp-fc-meta">
          <div className="hp-fc-chip">📄Essay</div>
          <div className="hp-fc-chip">✉️ Rec Letter</div>
          <div className="hp-fc-chip">📊 Transcript</div>
        </div>
        <p className="hp-fc-excerpt">"I was twelve when I held a broken circuit board and wondered why it had stopped talking to the world…"</p>
        <div className="hp-fc-foot">
          <span>GPA 3.95 · SAT 1560</span>
          <span className="hp-fc-views">👁2.4k views</span>
        </div>
      </div>

      {/* Floating card 2 — certification */}
      <div className="hp-float-card hp-float-card--2">
        <div className="hp-float-card__stripe hp-float-card__stripe--cyan" />
        <div className="hp-fc-top">
          <div className="hp-fc-logo hp-fc-logo--cyan">I</div>
          <div className="hp-fc-id">
            <strong>IELTS Academic</strong>
            <span>British Council · 2024</span>
          </div>
        </div>
        <div className="hp-fc-score-row">
          <div className="hp-fc-score-block">
            <span>Overall</span>
            <strong>8.5</strong>
          </div>
          <div className="hp-fc-score-block">
            <span>Writing</span>
            <strong>8.0</strong>
          </div>
          <div className="hp-fc-score-block">
            <span>Speaking</span>
            <strong>9.0</strong>
          </div>
        </div>
        <div className="hp-fc-foot">
          <span className="hp-fc-badge hp-fc-badge--purple">🌐 Public</span>
          <span className="hp-fc-views">📄 Certificate attached</span>
        </div>
      </div>

      {/* Floating badge */}
      <div className="hp-float-badge">
        <span className="hp-float-badge__icon">🎓</span>
        <div>
          <strong>340+ universities</strong>
          <span>Applications available</span>
        </div>
      </div>

      {/* Floating stat chip */}
      <div className="hp-float-chip">
        <span>✨</span>
        <span>12,000+ materials shared</span>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
export default function HomePage() {
  const { user, profile, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (email.trim()) setSubmitted(true);
  }

  const isLoggedIn = !!user;
  const isAdmin = profile?.role === 'admin';
  const dashboardPath = isAdmin ? '/admin' : '/student';

  return (
    <div className="hp-root">

      {/* ── Nav ── */}
      <nav className="hp-nav">
        <Link to="/" className="hp-logo">
          app<span className="hp-logo__accent">track</span>
        </Link>
        <ul className="hp-nav-links">
          <li><a href="#how">How it works</a></li>
          <li><a href="#features">Features</a></li>
          <li><a href="#browse">Browse</a></li></ul>
        <div className="hp-nav-actions">
          {isLoggedIn ? (
            <>
              <Link to={dashboardPath} className="hp-btn hp-btn-ghost">Dashboard</Link>
              <button type="button" className="hp-btn hp-btn-primary" onClick={signOut}>Sign out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="hp-btn hp-btn-ghost">Log in</Link>
              <Link to="/register" className="hp-btn hp-btn-primary">Get started</Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hp-hero">
        <div className="hp-hero-ambient">
          <div className="hp-hero-orb hp-hero-orb--1" />
          <div className="hp-hero-orb hp-hero-orb--2" /></div>

        <div className="hp-hero-left">
          <div className="hp-hero-badge">
            <span className="hp-hero-badge__dot" />
            ✨12,000+ real application materials
          </div>

          <h1 className="hp-hero-title">
            Get into your<br />
            <span className="hp-hero-title__grad">dream school</span><br />
            with real insights
          </h1>

          <p className="hp-hero-sub">
            Browse actual essays, recommendation letters, and strategies from students who got in. Learn what works — and what doesn't.
          </p>

          <div className="hp-hero-actions">
            <a href="#browse" className="hp-btn hp-btn-primary hp-btn-lg">
              <span>Explore applications</span>
              <span className="hp-btn-arrow">→</span>
            </a><a href="/register" className="hp-btn hp-btn-ghost hp-btn-lg">Share your journey</a>
          </div>

          <div className="hp-hero-stats">
            {STATS.map((s) => (
              <div key={s.label} className="hp-hero-stat">
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="hp-hero-right">
          <HeroVisual />
        </div>
      </section>

      {/* ── Schools Marquee ── */}
      <div className="hp-marquee-section">
        <p className="hp-marquee-label">Applications from students admitted to</p>
        <Marquee />
      </div>

      {/* ── How It Works ── */}
      <section className="hp-section" id="how">
        <p className="hp-section-label">How it works</p>
        <h2 className="hp-section-title">Four steps to a stronger application</h2>
        <p className="hp-section-sub">
          AppTrack connects you with real materials from students who have been exactly where you are.
        </p>

        <div className="hp-steps">
          {STEPS.map((step, i) => (
            <TiltCard key={step.num} className="hp-step-card" intensity={10}>
              <div className="hp-step-card__top">
                <span className="hp-step-num">{step.num}</span>
                <span className="hp-step-icon">{step.icon}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
              <div className="hp-step-card__line" style={{ animationDelay: `${i * 0.15}s` }} />
            </TiltCard>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="hp-section hp-section--alt" id="features">
        <p className="hp-section-label">Features</p>
        <h2 className="hp-section-title">Everything you need to apply smarter</h2>
        <p className="hp-section-sub">Not just essays — the full picture of what a winning application looks like.</p>

        <div className="hp-features-grid">
          {FEATURES.map((f, i) => (
            <TiltCard key={f.title} className="hp-feature-card" intensity={8}>
              <div
                className="hp-feature-icon"
                style={{ background: f.tint, color: f.color }}
              >
                {f.icon}
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <div
                className="hp-feature-card__glow"
                style={{ background: `radial-gradient(circle at 50% 100%, ${f.tint} 0%, transparent 70%)` }}
              />
            </TiltCard>
          ))}
        </div>
      </section>

      {/* ── Browse / Sample Cards ── */}
      <section className="hp-section" id="browse">
        <p className="hp-section-label">Browse</p>
        <h2 className="hp-section-title">Real applications, real outcomes</h2>
        <p className="hp-section-sub">A glimpse of what's waiting for you inside.</p>

        <div className="hp-sample-grid">
          {SAMPLES.map((s, i) => (
            <TiltCard key={s.title} className="hp-sample-card" intensity={9}>
              <div className="hp-sample-card__stripe" />
              <div className="hp-sample-top">
                <div className="hp-sample-logo">{s.schoolLetter}</div>
                <div className="hp-sample-id">
                  <strong>{s.school}</strong>
                  <span>{s.title}</span>
                </div><span className={`hp-decision hp-decision--${s.decisionColor}`}>
                  ✓ {s.decision}
                </span>
              </div>

              <div className="hp-sample-type-row">
                <span className="hp-doc-tag">{s.type}</span>
                <span className="hp-term-tag">{s.term}</span>
              </div>

              <p className="hp-sample-excerpt">{s.excerpt}</p>

              <div className="hp-sample-foot">
                <span>{s.meta}</span>
                <button className="hp-sample-read" type="button">Read →</button>
              </div>
            </TiltCard>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="hp-cta-section">
        <div className="hp-cta-orb hp-cta-orb--1" />
        <div className="hp-cta-orb hp-cta-orb--2" />

        <TiltCard className="hp-cta-box" intensity={6}>
          <div className="hp-cta-box__inner">
            <div className="hp-cta-badge">🚀 Join thousands of students</div>
            <h2>Your dream school is closer<br />than you think</h2>
            <p>Get early access to AppTrack and start learning from students who made it.</p>

            {submitted ? (
              <div className="hp-cta-success">
                🎉 You're on the list! We'll reach out soon.
              </div>
            ) : (
              <form className="hp-cta-form" onSubmit={handleSubmit}>
                <input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required aria-label="Email address"
                />
                <button type="submit" className="hp-btn hp-btn-primary hp-btn-lg">
                  Get early access
                </button>
              </form>
            )}

            <div className="hp-cta-trust">
              <span>🔒 No spam, ever</span>
              <span>·</span>
              <span>✓ Free to join</span>
              <span>·</span>
              <span>🎓 Student-built</span>
            </div>
          </div>
        </TiltCard>
      </section>

      {/* ── Footer ── */}
      <footer className="hp-footer">
        <a href="/" className="hp-logo hp-logo--sm">
          app<span className="hp-logo__accent">track</span>
        </a>
        <div className="hp-footer-links">
          <a href="#">About</a>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Contact</a>
        </div>
        <span className="hp-footer-copy">© 2026 AppTrack. Made for students, by students.</span>
      </footer></div>
  );
}
