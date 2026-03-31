import type { Browser, BrowserContext } from 'playwright';
import type { CountryProfile } from './country-profiles';

// Chrome-only user agents — Google blocks non-Chrome heavily
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
];

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1366, height: 768 },
  { width: 1680, height: 1050 },
  { width: 1280, height: 800 },
];

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export interface LaunchBrowserOptions {
  proxyUrl?: string; // When set, DNS is forced through the SOCKS5 proxy
}

export async function launchBrowser(options: LaunchBrowserOptions = {}): Promise<Browser> {
  const { chromium } = await import('playwright');

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--window-size=1440,900',
    // Docker Desktop (macOS/Windows) runs in a VM where Chromium's GPU
    // crashes. These extra flags are safe everywhere but only needed in VMs.
    // Always include them -- the perf cost is negligible for headless scraping.
    '--single-process',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--in-process-gpu',
    // WebRTC leak prevention -- block ICE candidates from exposing real IP
    '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
    '--enforce-webrtc-ip-permission-check',
  ];

  // When proxying via SOCKS5, force DNS resolution through the proxy to prevent leaks.
  // Extract the proxy hostname to exclude it from the rule (it must resolve normally).
  if (options.proxyUrl) {
    try {
      const proxyHost = new URL(options.proxyUrl.replace('socks5://', 'http://')).hostname;
      args.push(`--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE ${proxyHost}`);
    } catch {
      args.push('--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost');
    }
  }

  return chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || undefined,
    args,
  });
}

export interface StealthContextOptions {
  countryProfile?: CountryProfile;
  proxyUrl?: string; // e.g. 'socks5://expressvpn:1080'
}

const DEFAULT_TIMEZONES = ['America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin'];

export async function createStealthContext(browser: Browser, options: StealthContextOptions = {}): Promise<BrowserContext> {
  const profile = options.countryProfile;
  const viewport = randomPick(VIEWPORTS);
  const proxy = options.proxyUrl ? { server: options.proxyUrl } : undefined;
  const context = await browser.newContext({
    userAgent: randomPick(USER_AGENTS),
    viewport,
    locale: profile?.locale ?? 'en-US',
    timezoneId: profile ? randomPick(profile.timezones) : randomPick(DEFAULT_TIMEZONES),
    geolocation: profile?.geolocation,
    permissions: profile?.geolocation ? ['geolocation'] : [],
    proxy,
    extraHTTPHeaders: {
      'Accept-Language': profile?.acceptLanguage ?? 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
    },
  });

  // Comprehensive anti-detection: webdriver, chrome.runtime, plugins, languages
  const profileLocale = profile?.locale ?? null;
  await context.addInitScript((locale: string | null) => {
    // Hide webdriver flag
    Object.defineProperty(navigator, 'webdriver', { get: () => false });

    // Mock chrome.runtime (missing in headless = bot signal)
    if (!(window as unknown as Record<string, unknown>).chrome) {
      Object.defineProperty(window, 'chrome', {
        value: { runtime: {}, loadTimes: () => ({}), csi: () => ({}) },
        writable: false,
      });
    }

    // Mock plugins (empty in headless = bot signal)
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', description: 'Portable Document Format', filename: 'internal-pdf-viewer', length: 1 },
        { name: 'Chrome PDF Viewer', description: '', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', length: 1 },
        { name: 'Native Client', description: '', filename: 'internal-nacl-plugin', length: 2 },
      ],
    });

    // Mock languages to match country profile (should align with Accept-Language header)
    Object.defineProperty(navigator, 'languages', {
      get: () => locale ? [locale, locale.split('-')[0]!, 'en'].filter((v, i, a) => a.indexOf(v) === i) : ['en-US', 'en'],
    });

    // Mock permissions query (headless returns inconsistent results)
    const originalQuery = window.navigator.permissions.query.bind(window.navigator.permissions);
    Object.defineProperty(window.navigator.permissions, 'query', {
      value: (params: PermissionDescriptor) =>
        params.name === 'notifications'
          ? Promise.resolve({ state: 'prompt', onchange: null } as PermissionStatus)
          : originalQuery(params),
    });

    // Mock connection info
    Object.defineProperty(navigator, 'connection', {
      get: () => ({
        effectiveType: '4g',
        rtt: 50,
        downlink: 10,
        saveData: false,
      }),
    });

    // Hardware concurrency (headless sometimes reports 1)
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => 4 + Math.floor(Math.random() * 5), // 4-8 cores
    });

    // Device memory (headless sometimes missing)
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => 8,
    });

    // WebRTC leak prevention -- stub RTCPeerConnection to prevent real IP exposure
    // Chrome flags handle the network layer; this catches any JS-level WebRTC enumeration
    const OriginalRTC = window.RTCPeerConnection;
    if (OriginalRTC) {
      (window as unknown as Record<string, unknown>).RTCPeerConnection = class extends OriginalRTC {
        constructor(config?: RTCConfiguration) {
          // Strip STUN/TURN servers that could reveal the real IP
          const sanitized = { ...config, iceServers: [] };
          super(sanitized);
        }
      };
    }
  }, profileLocale);

  return context;
}
