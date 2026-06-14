"use client";

import type { CortexWalletState } from "@/lib/cortex/use-wallet";

const MARK = (
  <svg viewBox="0 0 120 120" fill="currentColor" aria-hidden="true">
    <circle cx="60" cy="60" r="9" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
      <path
        key={a}
        d="M54 43 L54 27 L49 17 L60 24 L71 17 L66 27 L66 43 L60 48 Z"
        transform={`rotate(${a} 60 60)`}
      />
    ))}
  </svg>
);

export function AuthScreen({
  state,
  onSkip,
}: {
  state: CortexWalletState;
  onSkip: () => void;
}) {
  const loading = !state.ready;
  const provisioning = state.provisioning;

  return (
    <div className="auth">
      <div className="auth-card">
        <span className="auth-mark">{MARK}</span>
        <div className="auth-brand">
          Cortex<sup className="tm">TM</sup>
        </div>

        {loading ? (
          <>
            <h1 className="auth-h1">Starting up…</h1>
            <p className="auth-lede">Getting your secure session ready.</p>
            <div className="auth-spinner" />
          </>
        ) : provisioning ? (
          <>
            <h1 className="auth-h1">Setting up your wallet…</h1>
            <p className="auth-lede">
              Creating a managed Sui wallet for you — no seed phrase, nothing to
              lose. This only happens once.
            </p>
            <div className="auth-spinner" />
            {state.error && <div className="auth-error">{state.error}</div>}
            <button className="auth-ghost" onClick={state.logout}>
              Cancel and sign out
            </button>
          </>
        ) : (
          <>
            <h1 className="auth-h1">Your memory, gently kept.</h1>
            <p className="auth-lede">
              Sign in to keep your notes, files and thoughts — sealed, stored on
              Walrus, and owned by you. New here? The same step creates your
              account.
            </p>
            <button className="auth-primary" onClick={state.login}>
              Sign in or create account
            </button>
            <button className="auth-ghost" onClick={onSkip}>
              Explore without an account
            </button>
            {state.error && <div className="auth-error">{state.error}</div>}
            <p className="auth-foot">
              Powered by Privy — log in with email or social. A managed Sui
              wallet is created for you automatically.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
