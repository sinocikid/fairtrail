'use client';

import { useState } from 'react';
import type { Airport } from '@/lib/scraper/parse-query';
import { currencySymbol } from '@/lib/currency';
import styles from './ConfirmationCard.module.css';

export interface ParsedQuery {
  origin: string;
  originName: string;
  destination: string;
  destinationName: string;
  origins: Airport[];
  destinations: Airport[];
  dateFrom: string;
  dateTo: string;
  outboundDates?: string[];
  returnDates?: string[];
  flexibility: number;
  maxPrice: number | null;
  maxStops: number | null;
  preferredAirlines: string[];
  timePreference: string;
  cabinClass: string;
  tripType: string;
  currency: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function hasFilters(p: ParsedQuery): boolean {
  return !!(
    p.maxPrice ||
    p.maxStops !== null ||
    p.preferredAirlines.length > 0 ||
    p.timePreference !== 'any' ||
    p.cabinClass !== 'economy'
  );
}

function computeExpiry(dateTo: string, flexibility: number): string {
  const d = new Date(dateTo + 'T00:00:00');
  d.setDate(d.getDate() + flexibility);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const POPULAR_COUNTRIES = [
  { code: 'US', flag: '\u{1F1FA}\u{1F1F8}', name: 'US' },
  { code: 'GB', flag: '\u{1F1EC}\u{1F1E7}', name: 'UK' },
  { code: 'DE', flag: '\u{1F1E9}\u{1F1EA}', name: 'DE' },
  { code: 'FR', flag: '\u{1F1EB}\u{1F1F7}', name: 'FR' },
  { code: 'JP', flag: '\u{1F1EF}\u{1F1F5}', name: 'JP' },
  { code: 'IN', flag: '\u{1F1EE}\u{1F1F3}', name: 'IN' },
  { code: 'BR', flag: '\u{1F1E7}\u{1F1F7}', name: 'BR' },
  { code: 'AU', flag: '\u{1F1E6}\u{1F1FA}', name: 'AU' },
  { code: 'CA', flag: '\u{1F1E8}\u{1F1E6}', name: 'CA' },
  { code: 'MX', flag: '\u{1F1F2}\u{1F1FD}', name: 'MX' },
];

export function ConfirmationCard({
  parsed,
  onTrack,
  onEdit,
  loading,
  actionLabel = 'Show available flights',
  loadingLabel = 'Checking Google Flights...',
  vpnCountries,
  onVpnCountriesChange,
}: {
  parsed: ParsedQuery;
  onTrack: () => void;
  onEdit: () => void;
  loading: boolean;
  actionLabel?: string;
  loadingLabel?: string;
  vpnCountries?: string[];
  onVpnCountriesChange?: (countries: string[]) => void;
}) {
  const [vpnOpen, setVpnOpen] = useState(false);

  const toggleCountry = (code: string) => {
    if (!onVpnCountriesChange || !vpnCountries) return;
    if (vpnCountries.includes(code)) {
      onVpnCountriesChange(vpnCountries.filter((c) => c !== code));
    } else {
      onVpnCountriesChange([...vpnCountries, code]);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.route}>
        <div className={styles.airportGroup}>
          {parsed.origins.map((a) => (
            <div key={a.code} className={styles.airport}>
              <span className={styles.code}>{a.code}</span>
              <span className={styles.city}>{a.name}</span>
            </div>
          ))}
        </div>
        <div className={styles.arrow}>
          {parsed.tripType === 'one_way' ? (
            <svg width="32" height="16" viewBox="0 0 32 16" fill="none">
              <path d="M0 8h28M22 2l6 6-6 6" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          ) : (
            <svg width="32" height="16" viewBox="0 0 32 16" fill="none">
              <path d="M0 5h28M22 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
              <path d="M32 11H4M10 15l-4-4 4-4" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          )}
        </div>
        <div className={styles.airportGroup}>
          {parsed.destinations.map((a) => (
            <div key={a.code} className={styles.airport}>
              <span className={styles.code}>{a.code}</span>
              <span className={styles.city}>{a.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.filters}>
        <span className={styles.tag}>
          {parsed.tripType === 'one_way' ? 'One way' : 'Round trip'}
        </span>
      </div>

      <div className={styles.details}>
        {parsed.outboundDates || parsed.returnDates ? (
          <>
            {parsed.outboundDates && (
              <div className={styles.dateRange}>
                <span className={styles.label}>
                  {parsed.tripType === 'one_way' ? 'Departure' : 'Outbound'}
                </span>
                <span className={styles.value}>
                  {parsed.outboundDates.map(formatDate).join(', ')}
                </span>
              </div>
            )}
            {parsed.returnDates && (
              <div className={styles.dateRange}>
                <span className={styles.label}>Return</span>
                <span className={styles.value}>
                  {parsed.returnDates.map(formatDate).join(', ')}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className={styles.dateRange}>
            <span className={styles.label}>Travel window</span>
            <span className={styles.value}>
              {formatDate(parsed.dateFrom)} &mdash; {formatDate(parsed.dateTo)}
            </span>
          </div>
        )}

        {parsed.flexibility > 0 && (
          <div className={styles.flexibility}>
            <span className={styles.label}>Flexibility</span>
            <span className={styles.value}>&plusmn; {parsed.flexibility} days</span>
          </div>
        )}

        <div className={styles.expiry}>
          <span className={styles.label}>Link expires</span>
          <span className={styles.value}>
            {computeExpiry(parsed.dateTo, parsed.flexibility)}
          </span>
        </div>
      </div>

      <p className={styles.trackingInfo}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        Prices checked daily &middot; Shareable chart &middot; Tracking ends {computeExpiry(parsed.dateTo, parsed.flexibility)}
      </p>

      {hasFilters(parsed) && (
        <div className={styles.filters}>
          {parsed.maxPrice && (
            <span className={styles.tag}>Under {currencySymbol(parsed.currency ?? 'USD')}{parsed.maxPrice}</span>
          )}
          {parsed.maxStops !== null && (
            <span className={styles.tag}>
              {parsed.maxStops === 0 ? 'Nonstop only' : `Max ${parsed.maxStops} stop${parsed.maxStops > 1 ? 's' : ''}`}
            </span>
          )}
          {parsed.preferredAirlines.length > 0 && (
            <span className={styles.tag}>{parsed.preferredAirlines.join(', ')}</span>
          )}
          {parsed.timePreference !== 'any' && (
            <span className={styles.tag}>{parsed.timePreference}</span>
          )}
          {parsed.cabinClass !== 'economy' && (
            <span className={styles.tag}>{parsed.cabinClass.replace('_', ' ')}</span>
          )}
        </div>
      )}

      {onVpnCountriesChange && (
        <div className={styles.vpnSection}>
          <button
            className={styles.vpnToggle}
            onClick={() => setVpnOpen(!vpnOpen)}
            type="button"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Compare prices from different countries
            <span className={styles.vpnChevron} data-open={vpnOpen}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
            {vpnCountries && vpnCountries.length > 0 && (
              <span className={styles.vpnCount}>{vpnCountries.length}</span>
            )}
          </button>
          {vpnOpen && (
            <div className={styles.vpnPicker}>
              <p className={styles.vpnHint}>
                Test the myth: does VPN location change flight prices? Select countries to compare.
              </p>
              <div className={styles.vpnGrid}>
                {POPULAR_COUNTRIES.map((c) => (
                  <button
                    key={c.code}
                    className={`${styles.vpnChip} ${vpnCountries?.includes(c.code) ? styles.vpnChipActive : ''}`}
                    onClick={() => toggleCountry(c.code)}
                    type="button"
                  >
                    {c.flag} {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className={styles.actions}>
        <button
          className={styles.trackButton}
          onClick={onTrack}
          disabled={loading}
        >
          {loading ? loadingLabel : actionLabel}
        </button>
        <button
          className={styles.editButton}
          onClick={onEdit}
          disabled={loading}
        >
          Edit
        </button>
      </div>
    </div>
  );
}
