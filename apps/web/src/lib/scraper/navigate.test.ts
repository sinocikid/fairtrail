import { describe, it, expect } from 'vitest';
import { buildGoogleFlightsUrl } from './navigate';

describe('buildGoogleFlightsUrl', () => {
  const base = {
    origin: 'JFK',
    destination: 'LAX',
    dateFrom: new Date('2026-06-15T00:00:00Z'),
    dateTo: new Date('2026-06-22T00:00:00Z'),
  };

  it('includes &curr= when currency is set', () => {
    const url = buildGoogleFlightsUrl({ ...base, currency: 'EUR' });
    expect(url).toContain('&curr=EUR');
  });

  it('omits &curr= when currency is null', () => {
    const url = buildGoogleFlightsUrl({ ...base, currency: null });
    expect(url).not.toContain('&curr=');
  });

  it('omits &curr= when currency is undefined', () => {
    const url = buildGoogleFlightsUrl({ ...base });
    expect(url).not.toContain('&curr=');
  });

  it('includes &gl= when country is set', () => {
    const url = buildGoogleFlightsUrl({ ...base, country: 'DE' });
    expect(url).toContain('&gl=DE');
  });

  it('includes both &curr= and &gl= when both are set', () => {
    const url = buildGoogleFlightsUrl({ ...base, currency: 'EUR', country: 'DE' });
    expect(url).toContain('&curr=EUR');
    expect(url).toContain('&gl=DE');
  });

  it('omits both &curr= and &gl= when both are null', () => {
    const url = buildGoogleFlightsUrl({ ...base, currency: null, country: null });
    expect(url).not.toContain('&curr=');
    expect(url).not.toContain('&gl=');
    expect(url).toContain('&hl=en');
  });
});
