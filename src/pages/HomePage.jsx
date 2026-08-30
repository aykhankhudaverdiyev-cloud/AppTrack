import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './HomePage.css';

/* ─── University logo with guaranteed fallback ────────────────── */
function SchoolLogo({ name, domain }) {
  const [failed, setFailed] = useState(false);
  const letter = name.charAt(0);
  if (failed) {
    return <span className="school-chip__letter">{letter}</span>;
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
      alt=""
      className="school-chip__logo"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/* ─── Data ─────────────────────────────────────────────────────── */
const SCHOOLS = [
  { name: 'MIT', domain: 'mit.edu' },
  { name: 'Stanford', domain: 'stanford.edu' },
  { name: 'Harvard', domain: 'harvard.edu' },
  { name: 'Oxford', domain: 'ox.ac.uk' },
  { name: 'Caltech', domain: 'caltech.edu' },
  { name: 'Yale', domain: 'yale.edu' },
  { name: 'Columbia', domain: 'columbia.edu' },
  { name: 'Princeton', domain: 'princeton.edu' },
  { name: 'Cambridge', domain: 'cam.ac.uk' },
  { name: 'ETH Zürich', domain: 'ethz.ch' },
  { name: 'NUS', domain: 'nus.edu.sg' },
  { name: 'Imperial', domain: 'imperial.ac.uk' },
  { name: 'UCL', domain: 'ucl.ac.uk' },
  { name: 'Cornell', domain: 'cornell.edu' },
  { name: 'LSE', domain: 'lse.ac.uk' },
  { name: 'UPenn', domain: 'upenn.edu' },
  { name: 'Duke', domain: 'duke.edu' },
  { name: 'NYU', domain: 'nyu.edu' },
  { name: 'UCLA', domain: 'ucla.edu' },
  { name: 'Berkeley', domain: 'berkeley.edu' },
  { name: 'Georgia Tech', domain: 'gatech.edu' },
  { name: 'McGill', domain: 'mcgill.ca' },
  { name: 'Toronto', domain: 'utoronto.ca' },
  { name: 'TU Munich', domain: 'tum.de' },
];

const STEPS = [
  { icon: '🔍', title: 'Find your target', desc: 'Search by university, major, or intake year.' },
  { icon: '📖', title: 'Read real examples', desc: 'Essays, rec letters, and profiles from admitted students.' },
  { icon: '✏️', title: 'Build yours', desc: 'Use real examples as inspiration for your own application.' },
  { icon: '🤝', title: 'Pay it forward', desc: 'Got accepted? Share your materials to help the next cohort.' },
];

const FEATURES = [
  { icon: '📄', title: 'Essays & Statements', desc: 'See what admitted students actually wrote.' },
  { icon: '✉️', title: 'Rec Letters', desc: 'Learn what a strong recommendation looks like.' },
  { icon: '📊', title: 'Full Profiles', desc: 'GPA, scores, activities — the complete picture.' },
  { icon: '🔍', title: 'Smart Filters', desc: 'Find exactly what matches your target school.' },
  { icon: '🔖', title: 'Save & Organize', desc: 'Bookmark and annotate as you research.' },
  { icon: '🌍', title: 'Global Community', desc: 'Students from 50+ countries sharing their journeys.' },
];

/* ─── Marquee ────────────────────────────────────────────────────── */
function Marquee() {
  const items = [...SCHOOLS, ...SCHOOLS];
  return (
    <div className="marquee-wrap" aria-hidden="true">
      <div className="marquee-track">
        {items.map((s, i) => (
          <span key={i} className="school-chip">
            <SchoolLogo name={s.name} domain={s.domain} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────── */
export default function HomePage() {
  const { user, profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const isLoggedIn = !!user;
  const dashPath = profile?.role === 'admin' ? '/admin' : '/student';

  const scrollTo = (e, id) => {
    e.preventDefault();
    setMenuOpen(false);
    document.querySelector(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const navLinks = [
    { label: 'How it works', href: '#how' },
    { label: 'Features', href: '#features' },
    { label: 'Preview', href: '#preview' },
  ];

  return (
    <div className="hp">

      {/* ── Navbar ── */}
      <nav className="nav">
        <Link to="/" className="nav__logo">app<span>track</span></Link>

        <ul className="nav__links">
          {navLinks.map((l) => (
            <li key={l.href}>
              <a href={l.href} onClick={(e) => scrollTo(e, l.href)}>{l.label}</a>
            </li>
          ))}
        </ul>

        <div className="nav__actions">
          {isLoggedIn ? (
            <>
              <Link to={dashPath} className="btn btn--ghost">Dashboard</Link>
              <button className="btn btn--primary" onClick={signOut}>Sign out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn--ghost">Log in</Link>
              <Link to="/register" className="btn btn--primary">Get started →</Link>
            </>
          )}
        </div>

        <button
          className={`hamburger ${menuOpen ? 'hamburger--open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
          aria-expanded={menuOpen}
        >
          <span /><span /><span />
        </button>

        <div className={`mobile-menu ${menuOpen ? 'mobile-menu--open' : ''}`}>
          <ul>
            {navLinks.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={(e) => scrollTo(e, l.href)}>{l.label}</a>
              </li>
            ))}
          </ul>
          <div className="mobile-menu__cta">
            {isLoggedIn ? (
              <>
                <Link to={dashPath} className="btn btn--primary btn--full" onClick={() => setMenuOpen(false)}>Dashboard</Link>
                <button className="btn btn--ghost btn--full" onClick={() => { signOut(); setMenuOpen(false); }}>Sign out</button>
              </>
            ) : (
              <>
                <Link to="/register" className="btn btn--primary btn--full" onClick={() => setMenuOpen(false)}>Get started</Link>
                <Link to="/login" className="btn btn--ghost btn--full" onClick={() => setMenuOpen(false)}>Log in</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero__content">
          <h1>
            Real applications.<br />
            <span>Real results.</span>
          </h1>
          <p>
            Read the actual essays, recommendation letters, and profiles
            of students who got into top universities. No fluff — just what worked.
          </p>
          <div className="hero__buttons">
            <Link to="/register" className="btn btn--primary btn--lg">
              Start exploring →
            </Link>
            <a href="#how" onClick={(e) => scrollTo(e, '#how')} className="btn btn--ghost btn--lg">
              How it works
            </a>
          </div>
        </div>
        <div className="hero__glow" aria-hidden="true" />
      </section>

      {/* ── Marquee ── */}
      <div className="marquee-section">
        <Marquee />
      </div>

      {/* ── How it works ── */}
      <section className="section" id="how">
        <h2 className="section__title">How it works</h2>
        <div className="steps">
          {STEPS.map((s, i) => (
            <div key={i} className="step">
              <div className="step__icon">{s.icon}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="section section--alt" id="features">
        <h2 className="section__title">What you get</h2>
        <div className="features">
          {FEATURES.map((f, i) => (
            <div key={i} className="feature">
              <span className="feature__icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Preview ── */}
      <section className="section" id="preview">
        <h2 className="section__title">What you'll see inside</h2>
        <p className="section__sub">Real content is available after sign-up. Here's a taste.</p>

        <div className="previews">
          <div className="preview-card">
            <div className="preview-card__badge">Example</div>
            <span className="preview-card__icon">📄</span>
            <h3>Motivation Essay</h3>
            <p className="preview-card__field">Computer Science · Fall Intake</p>
            <p className="preview-card__text">
              "Every strong essay starts with a personal story. See how admitted students
              structure their narratives and connect them to their goals…"
            </p>
          </div>

          <div className="preview-card">
            <div className="preview-card__badge">Example</div>
            <span className="preview-card__icon">✉️</span>
            <h3>Recommendation Letter</h3>
            <p className="preview-card__field">Professor Endorsement</p>
            <p className="preview-card__text">
              "Great recommendations go beyond grades. See how professors highlight
              character, initiative, and intellectual curiosity…"
            </p>
          </div>

          <div className="preview-card">
            <div className="preview-card__badge">Example</div>
            <span className="preview-card__icon">📊</span>
            <h3>Full Profile</h3>
            <p className="preview-card__field">GPA · Scores · Activities · Outcome</p>
            <p className="preview-card__text">
              "Numbers alone don't tell the story. See complete profiles to understand
              what made each application stand out…"
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta">
        <div className="cta__inner">
          <h2>Ready to start?</h2>
          <p>Free to use. Built by students, for students.</p>
          <div className="cta__buttons">
            <Link to="/register" className="btn btn--white btn--lg">Create free account</Link>
            <a href="#how" onClick={(e) => scrollTo(e, '#how')} className="btn btn--outline btn--lg">Learn more</a>
          </div>
        </div>
      </section>

      {/* ── Footer (tamam — sadəcə logo + copyright) ── */}
      <footer className="footer">
        <Link to="/" className="footer__logo">app<span>track</span></Link>
        <span className="footer__copy">© {new Date().getFullYear()} AppTrack — Real materials, real students.</span>
      </footer>
    </div>
  );
}