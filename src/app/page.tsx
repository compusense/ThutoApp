'use client';

import { AppLink } from '@/components/ui/app-link';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { LoginForm } from '@/components/auth/login-form';

/* ─────────────────────────────────────────────────────────────
   INLINE STYLES — self-contained, works alongside Tailwind
───────────────────────────────────────────────────────────── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Outfit:wght@300;400;500;600&display=swap');

  :root {
    --tl-midnight:    #060B18;
    --tl-deep:        #0B1225;
    --tl-indigo:      #0F1E40;
    --tl-terracotta:  #C4521A;
    --tl-ochre:       #D4953A;
    --tl-gold:        #E0B96A;
    --tl-sand:        #F2DEB8;
    --tl-text:        #EDE6D6;
    --tl-muted:       #7A8BA8;
    --tl-border:      rgba(224,185,106,0.14);
    --font-serif:     'Cormorant Garamond', Georgia, serif;
    --font-sans:      'Outfit', sans-serif;
  }

  .tl-root *, .tl-root *::before, .tl-root *::after {
    box-sizing: border-box;
    margin: 0; padding: 0;
  }

  .tl-root {
    font-family: var(--font-sans);
    min-height: 100dvh;
    display: grid;
    grid-template-columns: 1fr 1fr;
    background: var(--tl-midnight);
    overflow: hidden;
  }

  @media (max-width: 900px) {
    .tl-root { grid-template-columns: 1fr; }
    .tl-panel-left { display: none !important; }
  }

  /* ══ KEYFRAMES ══ */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes orbA {
    0%,100% { transform: translate(0,0) scale(1); }
    33%      { transform: translate(28px,18px) scale(1.06); }
    66%      { transform: translate(-14px,32px) scale(0.95); }
  }
  @keyframes orbB {
    0%,100% { transform: translate(0,0); }
    50%      { transform: translate(-22px,-18px); }
  }
  @keyframes breathe {
    0%,100% { opacity:1; transform:scale(1); box-shadow:0 0 0 0 rgba(196,82,26,.5); }
    50%      { opacity:.7; transform:scale(1.5); box-shadow:0 0 0 5px rgba(196,82,26,0); }
  }
  @keyframes shimmer {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(400%); }
  }
  @keyframes diamondPulse {
    0%,100% { opacity:0; transform:rotate(45deg) scale(.5); }
    50%      { opacity:.3; transform:rotate(45deg) scale(1); }
  }
  @keyframes barFill {
    from { width: 0; }
  }
  @keyframes scanLine {
    from { transform: translateY(-100%); }
    to   { transform: translateY(100vh); }
  }

  /* ══ LEFT PANEL ══ */
  .tl-panel-left {
    position: relative;
    overflow: hidden;
    background: var(--tl-midnight);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tl-bg-img {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    opacity: .07;
    filter: saturate(.3) brightness(.7);
  }

  .tl-atmosphere {
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 75% 55% at 30% 28%, rgba(196,82,26,.24) 0%, transparent 65%),
      radial-gradient(ellipse 55% 70% at 80% 75%, rgba(212,149,58,.13) 0%, transparent 60%),
      radial-gradient(ellipse 85% 85% at 50% 50%, rgba(15,30,64,.97) 20%, var(--tl-midnight) 100%);
  }

  .tl-texture {
    position: absolute; inset: 0;
    background-image: repeating-linear-gradient(
      -55deg,
      transparent 0, transparent 28px,
      rgba(224,185,106,.022) 28px, rgba(224,185,106,.022) 29px
    );
    pointer-events: none;
  }

  .tl-grain {
    position: absolute; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.04'/%3E%3C/svg%3E");
    opacity: .45;
    pointer-events: none;
  }

  /* Scan line */
  .tl-scan {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }
  .tl-scan::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgba(212,149,58,.08), transparent);
    animation: scanLine 8s linear infinite;
  }

  /* Orbs */
  .tl-orb {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
  }
  .tl-orb-1 {
    width: 340px; height: 340px;
    top: -90px; left: -90px;
    background: radial-gradient(circle, rgba(196,82,26,.2) 0%, transparent 70%);
    animation: orbA 18s ease-in-out infinite;
  }
  .tl-orb-2 {
    width: 210px; height: 210px;
    bottom: 8%; right: -50px;
    background: radial-gradient(circle, rgba(212,149,58,.15) 0%, transparent 70%);
    animation: orbB 22s ease-in-out infinite;
  }
  .tl-orb-3 {
    width: 160px; height: 160px;
    top: 42%; left: 8%;
    background: radial-gradient(circle, rgba(224,185,106,.09) 0%, transparent 70%);
    animation: orbA 14s ease-in-out infinite reverse;
  }

  /* Kente diamonds */
  .tl-diamond {
    position: absolute;
    width: 7px; height: 7px;
    background: var(--tl-gold);
    transform: rotate(45deg);
    opacity: 0;
    animation: diamondPulse ease-in-out infinite;
  }

  /* Content */
  .tl-left-content {
    position: relative;
    z-index: 10;
    padding: 3rem;
    max-width: 450px;
    animation: fadeUp .9s ease both;
  }

  .tl-badge {
    display: inline-flex;
    align-items: center;
    gap: .5rem;
    padding: .35rem .9rem;
    border: 1px solid rgba(224,185,106,.28);
    background: rgba(224,185,106,.055);
    font-size: .68rem;
    font-weight: 600;
    letter-spacing: .16em;
    text-transform: uppercase;
    color: var(--tl-gold);
    margin-bottom: 2rem;
  }

  .tl-badge-dot {
    width: 5px; height: 5px;
    background: var(--tl-terracotta);
    border-radius: 50%;
    animation: breathe 2.4s ease-in-out infinite;
  }

  .tl-left-title {
    font-family: var(--font-serif);
    font-size: clamp(3rem, 4.5vw, 4.5rem);
    font-weight: 700;
    line-height: .95;
    color: var(--tl-text);
    margin-bottom: .3rem;
  }

  .tl-left-em {
    display: block;
    font-style: italic;
    background: linear-gradient(135deg, var(--tl-ochre), var(--tl-gold));
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .tl-left-sub {
    font-size: .95rem;
    font-weight: 300;
    line-height: 1.75;
    color: rgba(237,230,214,.5);
    margin: 1.5rem 0 2.75rem;
    max-width: 370px;
  }

  /* Stat rows */
  .tl-stats { display: flex; flex-direction: column; gap: .9rem; }

  .tl-stat-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: .9rem 1.2rem;
    background: rgba(255,255,255,.025);
    border: 1px solid rgba(224,185,106,.09);
    backdrop-filter: blur(10px);
    animation: fadeUp .9s ease both;
  }
  .tl-stat-row:nth-child(1) { animation-delay: .15s; }
  .tl-stat-row:nth-child(2) { animation-delay: .25s; }
  .tl-stat-row:nth-child(3) { animation-delay: .35s; }

  .tl-stat-icon {
    width: 34px; height: 34px;
    background: rgba(196,82,26,.1);
    border: 1px solid rgba(196,82,26,.2);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; font-size: .95rem;
  }

  .tl-stat-body { flex: 1; }

  .tl-stat-value {
    font-family: var(--font-serif);
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--tl-text);
    line-height: 1;
  }

  .tl-stat-label {
    font-size: .68rem;
    letter-spacing: .07em;
    text-transform: uppercase;
    color: var(--tl-muted);
    margin-top: .18rem;
  }

  .tl-stat-bar {
    width: 44px; height: 2px;
    background: rgba(224,185,106,.1);
    flex-shrink: 0; overflow: hidden;
  }

  .tl-stat-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--tl-terracotta), var(--tl-gold));
    animation: barFill 1.4s ease both;
  }

  .tl-attribution {
    position: absolute;
    bottom: 2rem; left: 3rem;
    font-size: .68rem;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: rgba(122,139,168,.4);
    z-index: 10;
  }

  /* ══ RIGHT PANEL ══ */
  .tl-panel-right {
    position: relative;
    background: var(--tl-deep);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    overflow: hidden;
  }

  .tl-panel-right::before {
    content: '';
    position: absolute;
    top: -20%; right: -30%;
    width: 65%; height: 75%;
    background: radial-gradient(ellipse, rgba(212,149,58,.04) 0%, transparent 70%);
    pointer-events: none;
  }
  .tl-panel-right::after {
    content: '';
    position: absolute;
    bottom: -10%; left: -20%;
    width: 55%; height: 55%;
    background: radial-gradient(ellipse, rgba(196,82,26,.04) 0%, transparent 70%);
    pointer-events: none;
  }

  .tl-right-grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(224,185,106,.022) 1px, transparent 1px),
      linear-gradient(90deg, rgba(224,185,106,.022) 1px, transparent 1px);
    background-size: 48px 48px;
    pointer-events: none;
    -webkit-mask-image: radial-gradient(ellipse at 50% 50%, black 30%, transparent 78%);
    mask-image: radial-gradient(ellipse at 50% 50%, black 30%, transparent 78%);
  }

  .tl-form-wrapper {
    position: relative;
    z-index: 10;
    width: 100%;
    max-width: 396px;
    animation: fadeUp .8s ease .1s both;
  }

  /* Logo */
  .tl-form-logo {
    display: flex;
    justify-content: center;
    margin-bottom: 2rem;
    animation: fadeUp .7s ease .2s both;
  }

  .tl-form-logo-mark {
    font-family: var(--font-serif);
    font-size: 2.4rem;
    font-weight: 700;
    letter-spacing: .07em;
    background: linear-gradient(135deg, var(--tl-ochre), var(--tl-gold));
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    text-decoration: none;
  }

  .tl-form-heading {
    font-family: var(--font-serif);
    font-size: 2.1rem;
    font-weight: 600;
    color: var(--tl-text);
    text-align: center;
    margin-bottom: .4rem;
    line-height: 1.1;
    animation: fadeUp .7s ease .25s both;
  }

  .tl-form-sub {
    font-size: .875rem;
    font-weight: 300;
    color: var(--tl-muted);
    text-align: center;
    margin-bottom: 2.25rem;
    line-height: 1.65;
    animation: fadeUp .7s ease .3s both;
  }

  /* Google button */
  .tl-google-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: .75rem;
    padding: .875rem 1.5rem;
    background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.1);
    color: var(--tl-text);
    font-family: var(--font-sans);
    font-size: .9rem;
    font-weight: 500;
    cursor: pointer;
    transition: background .2s, border-color .2s, transform .15s, box-shadow .2s;
    position: relative;
    overflow: hidden;
    animation: fadeUp .7s ease .35s both;
  }

  .tl-google-btn::after {
    content: '';
    position: absolute;
    top: 0; left: -60%;
    width: 40%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.06), transparent);
    transform: skewX(-20deg);
    animation: shimmer 3.5s ease infinite;
  }

  .tl-google-btn:hover {
    background: rgba(255,255,255,.09);
    border-color: rgba(224,185,106,.28);
    transform: translateY(-1px);
    box-shadow: 0 8px 30px rgba(0,0,0,.35);
  }
  .tl-google-btn:active { transform: translateY(0); }

  .tl-google-icon { width: 20px; height: 20px; flex-shrink: 0; }

  /* Divider */
  .tl-divider {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 1.75rem 0;
    animation: fadeUp .7s ease .4s both;
  }
  .tl-divider-line {
    flex: 1; height: 1px;
    background: rgba(224,185,106,.1);
  }
  .tl-divider-text {
    font-size: .68rem;
    font-weight: 500;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: var(--tl-muted);
    flex-shrink: 0;
  }

  /* Form field overrides */
  .tl-form-wrap { animation: fadeUp .7s ease .45s both; }

  .tl-form-wrap input {
    background: rgba(255,255,255,.04) !important;
    border: 1px solid rgba(224,185,106,.12) !important;
    border-radius: 0 !important;
    color: var(--tl-text) !important;
    font-family: var(--font-sans) !important;
    font-size: .9rem !important;
    padding: .78rem 1rem !important;
    transition: border-color .2s, background .2s, box-shadow .2s !important;
    outline: none !important;
    width: 100% !important;
  }
  .tl-form-wrap input:focus {
    border-color: rgba(212,149,58,.45) !important;
    background: rgba(255,255,255,.065) !important;
    box-shadow: 0 0 0 3px rgba(212,149,58,.07) !important;
  }
  .tl-form-wrap input::placeholder { color: rgba(122,139,168,.5) !important; }

  .tl-form-wrap label {
    display: block !important;
    color: rgba(237,230,214,.7) !important;
    font-size: .73rem !important;
    font-weight: 500 !important;
    letter-spacing: .08em !important;
    text-transform: uppercase !important;
    margin-bottom: .4rem !important;
  }

  .tl-form-wrap button[type="submit"] {
    width: 100% !important;
    background: linear-gradient(135deg, var(--tl-terracotta), var(--tl-ochre)) !important;
    border: none !important;
    border-radius: 0 !important;
    color: #fff !important;
    font-family: var(--font-sans) !important;
    font-size: .9rem !important;
    font-weight: 600 !important;
    letter-spacing: .05em !important;
    padding: .875rem !important;
    cursor: pointer !important;
    transition: opacity .2s, transform .15s, box-shadow .2s !important;
    margin-top: .5rem !important;
    clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%) !important;
    position: relative !important;
    overflow: hidden !important;
  }
  .tl-form-wrap button[type="submit"]::after {
    content: '' !important;
    position: absolute !important;
    top: 0 !important; left: -60% !important;
    width: 40% !important; height: 100% !important;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.15), transparent) !important;
    transform: skewX(-20deg) !important;
    animation: shimmer 2.8s ease infinite !important;
  }
  .tl-form-wrap button[type="submit"]:hover {
    opacity: .92 !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 10px 32px rgba(196,82,26,.3) !important;
  }

  /* Role chips */
  .tl-roles {
    display: flex;
    gap: .45rem;
    justify-content: center;
    margin-top: 1.75rem;
    flex-wrap: wrap;
    animation: fadeUp .7s ease .55s both;
  }

  .tl-role-chip {
    padding: .24rem .6rem;
    font-size: .62rem;
    font-weight: 500;
    letter-spacing: .09em;
    text-transform: uppercase;
    color: rgba(122,139,168,.65);
    border: 1px solid rgba(224,185,106,.08);
    background: rgba(224,185,106,.03);
  }

  .tl-back-link {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: .4rem;
    margin-top: 1.5rem;
    font-size: .8rem;
    color: var(--tl-muted);
    text-decoration: none;
    transition: color .2s;
    animation: fadeUp .7s ease .6s both;
  }
  .tl-back-link:hover { color: var(--tl-gold); }
  .tl-back-arrow { transition: transform .2s; }
  .tl-back-link:hover .tl-back-arrow { transform: translateX(-3px); }

  /* Bottom accent bar */
  .tl-right-bottom {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg,
      transparent 0%,
      var(--tl-terracotta) 20%,
      var(--tl-ochre) 50%,
      var(--tl-gold) 80%,
      transparent 100%
    );
    opacity: .55;
  }
`;

/* ─── Kente diamond positions ─────────────────────────────── */
const DIAMONDS = [
  { top: '11%', left: '7%',  delay: '0s',    dur: '4s'   },
  { top: '27%', left: '71%', delay: '1.3s',  dur: '5.5s' },
  { top: '54%', left: '19%', delay: '2.2s',  dur: '3.8s' },
  { top: '69%', left: '61%', delay: '0.6s',  dur: '6s'   },
  { top: '84%', left: '34%', delay: '3.1s',  dur: '4.5s' },
  { top: '39%', left: '84%', delay: '1.9s',  dur: '5.2s' },
  { top: '16%', left: '51%', delay: '2.9s',  dur: '4.2s' },
  { top: '91%', left: '77%', delay: '0.8s',  dur: '3.6s' },
];

/* ─── Google SVG ───────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg className="tl-google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

/* ─── Page ────────────────────────────────────────────────── */
export default function LoginPage() {
  const loginBg = PlaceHolderImages.find((p) => p.id === 'login-background');

  const handleGoogleSignIn = () => {
    // Replace with your auth provider call, e.g.:
    // signIn('google', { callbackUrl: '/dashboard' });
    signIn('google', { callbackUrl: '/dashboard' });
  };

  return (
    <>
      <style>{css}</style>
      <div className="tl-root">

        {/* ══════════════════════════════════
            LEFT — cinematic brand panel
        ══════════════════════════════════ */}
        <div className="tl-panel-left">
          {loginBg && (
            <img src={loginBg.imageUrl} alt="" className="tl-bg-img" aria-hidden="true" />
          )}
          <div className="tl-atmosphere" />
          <div className="tl-texture" />
          <div className="tl-grain" />
          <div className="tl-scan" />

          {/* Ambient orbs */}
          <div className="tl-orb tl-orb-1" />
          <div className="tl-orb tl-orb-2" />
          <div className="tl-orb tl-orb-3" />

          {/* Kente-inspired diamond accents */}
          {DIAMONDS.map((d, i) => (
            <div
              key={i}
              className="tl-diamond"
              style={{
                top: d.top, left: d.left,
                animationDelay: d.delay,
                animationDuration: d.dur,
              }}
            />
          ))}

          {/* Copy */}
          <div className="tl-left-content">
            <div className="tl-badge">
              <span className="tl-badge-dot" />
              Thuto · Setswana for Education
            </div>

            <h1 className="tl-left-title">
              Where
              <em className="tl-left-em">Learning</em>
              Begins.
            </h1>

            <p className="tl-left-sub">
              A modern school management platform built for Botswana — from student
              registries and AI-powered lesson planning to real-time math battles
              and regional analytics.
            </p>

            <div className="tl-stats">
              {[
                { icon: '🎓', value: '12,400+', label: 'Students Enrolled',     bar: '90%' },
                { icon: '🏫', value: '340',     label: 'Schools Connected',     bar: '68%' },
                { icon: '🤖', value: '1,290',   label: 'AI Lessons This Week',  bar: '52%' },
              ].map((s) => (
                <div className="tl-stat-row" key={s.label}>
                  <div className="tl-stat-icon">{s.icon}</div>
                  <div className="tl-stat-body">
                    <div className="tl-stat-value">{s.value}</div>
                    <div className="tl-stat-label">{s.label}</div>
                  </div>
                  <div className="tl-stat-bar">
                    <div className="tl-stat-fill" style={{ width: s.bar }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="tl-attribution">Botswana · Est. 2024</div>
        </div>

        {/* ══════════════════════════════════
            RIGHT — login form
        ══════════════════════════════════ */}
        <div className="tl-panel-right">
          <div className="tl-right-grid" />

          <div className="tl-form-wrapper">

            {/* Wordmark */}
            <div className="tl-form-logo">
              <AppLink href="/" className="tl-form-logo-mark">
                Thuto
              </AppLink>
            </div>

            <h2 className="tl-form-heading">Welcome back</h2>
            <p className="tl-form-sub">
              Sign in to access your portal.<br />
              Your classroom is waiting.
            </p>

            {/* Google sign-in */}
            <button
              type="button"
              className="tl-google-btn"
              onClick={handleGoogleSignIn}
            >
              <GoogleIcon />
              Continue with Google
            </button>

            {/* Divider */}
            <div className="tl-divider">
              <div className="tl-divider-line" />
              <span className="tl-divider-text">or use credentials</span>
              <div className="tl-divider-line" />
            </div>

            {/* Email + password form */}
            <div className="tl-form-wrap">
              <LoginForm />
            </div>

            {/* Role chips */}
            <div className="tl-roles">
              {['Super Admin', 'School Head', 'Teacher', 'Student'].map((r) => (
                <span key={r} className="tl-role-chip">{r}</span>
              ))}
            </div>

            {/* Back link */}
            <AppLink href="/" className="tl-back-link">
              <span className="tl-back-arrow">←</span>
              Back to home
            </AppLink>

          </div>

          <div className="tl-right-bottom" />
        </div>

      </div>
    </>
  );
}
