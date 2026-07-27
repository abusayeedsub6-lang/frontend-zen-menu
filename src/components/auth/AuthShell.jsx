import { Outlet } from 'react-router-dom';

export default function AuthShell({ children }) {
  return (
    <div className="auth-page">
      <div className="auth-atmosphere" aria-hidden="true">
        <div className="auth-glow auth-glow--one" />
        <div className="auth-glow auth-glow--two" />
        <div className="auth-grain" />
      </div>

      <div className="auth-layout">
        <section className="auth-brand-panel">
          <p className="auth-brand-mark">Zen Menu</p>
          <h1 className="auth-brand-headline">Run your restaurant from one calm place.</h1>
          <p className="auth-brand-copy">
            Orders, menus, and staff — designed to stay out of the way when service gets busy.
          </p>
        </section>

        <section className="auth-panel" aria-labelledby="auth-form-title">
          <div className="auth-panel-inner">
            <p className="auth-brand-mobile">Zen Menu</p>
            {children ?? <Outlet />}
          </div>
        </section>
      </div>
    </div>
  );
}
