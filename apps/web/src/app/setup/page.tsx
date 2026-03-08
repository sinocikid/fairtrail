'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { EXTRACTION_PROVIDERS } from '@/lib/scraper/ai-registry';

interface SetupStatus {
  setupComplete: boolean;
  detectedProviders: string[];
  currentProvider: string | null;
  currentModel: string | null;
}

export default function SetupPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [step, setStep] = useState(0);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/setup/status')
      .then((r) => r.json())
      .then((data: SetupStatus) => {
        if (data.setupComplete) {
          window.location.href = '/';
          return;
        }
        setStatus(data);
        if (data.detectedProviders.length > 0) {
          const defaultProvider = data.detectedProviders[0]!;
          setProvider(defaultProvider);
          const providerConfig = EXTRACTION_PROVIDERS[defaultProvider];
          if (providerConfig?.models[0]) {
            setModel(providerConfig.models[0].id);
          }
        }
      });
  }, []);

  const handleSubmit = async () => {
    setError('');

    if (step === 0) {
      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      setStep(1);
      return;
    }

    if (!provider || !model) {
      setError('Select a provider and model');
      return;
    }

    setLoading(true);
    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPassword: password, provider, model }),
    });

    if (res.ok) {
      window.location.href = '/';
    } else {
      const data = await res.json();
      setError(data.error || 'Setup failed');
      setLoading(false);
    }
  };

  if (!status) {
    return (
      <main className={styles.root}>
        <div className={styles.card}>
          <p className={styles.loading}>Loading...</p>
        </div>
      </main>
    );
  }

  const providerEntries = Object.entries(EXTRACTION_PROVIDERS);

  return (
    <main className={styles.root}>
      <div className={styles.card}>
        <h1 className={styles.title}>Fairtrail Setup</h1>
        <p className={styles.subtitle}>
          {step === 0
            ? 'Set your admin password'
            : 'Choose your LLM provider'}
        </p>

        <div className={styles.steps}>
          <span className={`${styles.step} ${step >= 0 ? styles.active : ''}`}>1. Password</span>
          <span className={styles.stepDivider}>/</span>
          <span className={`${styles.step} ${step >= 1 ? styles.active : ''}`}>2. Provider</span>
        </div>

        {step === 0 && (
          <div className={styles.fields}>
            <input
              type="password"
              className={styles.input}
              placeholder="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <input
              type="password"
              className={styles.input}
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        )}

        {step === 1 && (
          <div className={styles.fields}>
            <div className={styles.providers}>
              {providerEntries.map(([key, config]) => {
                const detected = status.detectedProviders.includes(key);
                return (
                  <button
                    key={key}
                    className={`${styles.providerCard} ${provider === key ? styles.selected : ''} ${!detected ? styles.unavailable : ''}`}
                    onClick={() => {
                      setProvider(key);
                      if (config.models[0]) setModel(config.models[0].id);
                    }}
                  >
                    <span className={styles.providerName}>{config.displayName}</span>
                    <span className={styles.providerStatus}>
                      {detected ? 'Ready' : 'No key'}
                    </span>
                  </button>
                );
              })}
            </div>

            {provider && EXTRACTION_PROVIDERS[provider] && (
              <select
                className={styles.input}
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                {EXTRACTION_PROVIDERS[provider]!.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.costPer1kInput === 0 ? ' (free)' : ` ($${m.costPer1kInput}/1k in)`}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          {step > 0 && (
            <button
              className={styles.backButton}
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          )}
          <button
            className={styles.button}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Setting up...' : step === 0 ? 'Next' : 'Complete Setup'}
          </button>
        </div>
      </div>
    </main>
  );
}
