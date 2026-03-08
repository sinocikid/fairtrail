import { launchBrowser, createStealthContext } from './browser';
import { getAirlineUrl } from './airline-urls';

export interface FlightSearchParams {
  origin: string;
  destination: string;
  dateFrom: Date;
  dateTo: Date;
  cabinClass?: string;
}

export type NavigationSource = 'google_flights' | 'airline_direct';

export interface NavigationResult {
  html: string;
  url: string;
  resultsFound: boolean;
  source: NavigationSource;
}

function buildGoogleFlightsUrl(params: FlightSearchParams): string {
  const dateFrom = params.dateFrom.toISOString().split('T')[0];
  const dateTo = params.dateTo.toISOString().split('T')[0];

  return `https://www.google.com/travel/flights?q=flights+from+${params.origin}+to+${params.destination}+on+${dateFrom}+to+${dateTo}&curr=USD&hl=en`;
}

export async function navigateGoogleFlights(
  params: FlightSearchParams
): Promise<NavigationResult> {
  const browser = await launchBrowser();

  try {
    const context = await createStealthContext(browser);
    const page = await context.newPage();
    const url = buildGoogleFlightsUrl(params);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });

    // Wait for flight results to load
    await page.waitForTimeout(3000);

    // Dismiss consent/cookie dialog — Google renders two identical "Accept all"
    // buttons; without .first() Playwright strict mode throws on the ambiguity
    try {
      const consentButton = page.locator('button:has-text("Accept all")').first();
      if (await consentButton.isVisible({ timeout: 2000 })) {
        await consentButton.click();
        await page.waitForTimeout(3000);
      }
    } catch {
      // No consent dialog — continue
    }

    // Wait for flight results — look for price elements
    let resultsFound = false;
    try {
      await page.waitForSelector('[data-gs]', { timeout: 15_000 });
      resultsFound = true;
    } catch {
      // Selector not found — page may be blocked, CAPTCHA'd, or empty
    }

    const html = await page.content();

    await context.close();
    return { html, url, resultsFound, source: 'google_flights' };
  } finally {
    await browser.close();
  }
}

export async function navigateAirlineDirect(
  params: FlightSearchParams,
  airlineName: string
): Promise<NavigationResult> {
  const url = getAirlineUrl(airlineName, params);
  if (!url) {
    throw new Error(`No URL pattern for airline: ${airlineName}`);
  }

  const browser = await launchBrowser();

  try {
    const context = await createStealthContext(browser);
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });

    // Airline sites are slower — wait for dynamic content to render
    await page.waitForTimeout(5000);

    // Dismiss cookie/consent dialogs common on airline sites
    try {
      for (const label of ['Accept all', 'Accept', 'I agree', 'Accept cookies', 'OK', 'Got it']) {
        const btn = page.locator(`button:has-text("${label}")`).first();
        if (await btn.isVisible({ timeout: 1000 })) {
          await btn.click();
          await page.waitForTimeout(2000);
          break;
        }
      }
    } catch {
      // No consent dialog — continue
    }

    // Heuristic: check if any price-like content loaded (currency symbols or digits)
    let resultsFound = false;
    try {
      await page.waitForFunction(
        () => {
          const text = document.body?.innerText ?? '';
          return /\$\s?\d|€\s?\d|£\s?\d|USD|EUR|GBP|\d+\.\d{2}/.test(text);
        },
        { timeout: 15_000 }
      );
      resultsFound = true;
    } catch {
      // No price content detected — page may be blocked or empty
    }

    const html = await page.content();

    await context.close();
    return { html, url, resultsFound, source: 'airline_direct' };
  } finally {
    await browser.close();
  }
}
