import { Suspense, lazy, useState } from 'react';
import { Routes, Route } from 'react-router-dom';

const ComposerShell = lazy(() => import('../ComposerShell'));

function LoadingComposer() {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#111417',
      color: '#d6ff53',
      fontSize: '18px',
      fontFamily: 'Inter, ui-sans-serif, system-ui'
    }}>
      Loading Composer...
    </div>
  );
}

function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <h1>Open Media</h1>
        <p className="landing-subtitle">Open-source toolkit for AI filmmakers</p>
      </header>
      <main className="landing-cards">
        <article className="landing-card">
          <div className="landing-card-header">
            <h2>3D Shot Composer</h2>
          </div>
          <p className="landing-card-desc">Create and compose cinematic shots using 3D characters and objects.</p>
          <a href="/library.html" className="landing-btn landing-btn-primary">
            Open Composer
          </a>
        </article>
        <article className="landing-card landing-card-disabled">
          <div className="landing-card-header">
            <h2>2D Sketchboarding</h2>
            <span className="landing-badge">Coming Soon</span>
          </div>
          <p className="landing-card-desc">Storyboarding and sketch planning tools.</p>
          <button className="landing-btn landing-btn-disabled" disabled>
            Coming Soon
          </button>
        </article>
      </main>
    </div>
  );
}

export function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/composer" element={
          <Suspense fallback={<LoadingComposer />}>
            <ComposerShell />
          </Suspense>
        } />
      </Routes>
    </div>
  );
}