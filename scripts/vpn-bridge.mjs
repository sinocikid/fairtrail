#!/usr/bin/env node

/**
 * VPN Bridge -- runs on the macOS host to let Docker containers control ExpressVPN.
 *
 * Docker Desktop routes container traffic through the host's network, so when
 * ExpressVPN is connected on the Mac, container Playwright traffic goes through
 * the VPN automatically. This script exposes the same REST API as the Docker
 * sidecar so the container can switch countries.
 *
 * Usage:
 *   node scripts/vpn-bridge.mjs
 *   # Listens on port 8000 (same as sidecar)
 *
 * The container reaches this via EXPRESSVPN_API_URL=http://host.docker.internal:8000
 */

import { createServer } from 'http';
import { execFile } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execFile);
const PORT = 8000;

const LOCATIONS = {
  usny: 'USA - New York',
  uklo: 'UK - London',
  defra1: 'Germany - Frankfurt - 3',
  frpa2: 'France - Paris - 2',
  esma: 'Spain - Madrid',
  itco: 'Italy - Cosenza',
  nlam: 'Netherlands - Amsterdam',
  ie: 'Ireland',
  jpto: 'Japan - Tokyo',
  kr2: 'South Korea',
  inuk: 'India (via UK)',
  ausy: 'Australia - Sydney',
  cato: 'Canada - Toronto',
  mx: 'Mexico',
  br: 'Brazil',
  ar: 'Argentina',
  co: 'Colombia',
  th: 'Thailand',
  sgcb: 'Singapore - CBD',
  hk2: 'Hong Kong - 2',
  smart: 'Smart Location',
};

async function osascript(script) {
  const { stdout } = await exec('osascript', ['-e', script], { timeout: 15000 });
  return stdout.trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getStatus() {
  try {
    const firstItem = await osascript(`
      tell application "System Events"
        tell process "ExpressVPN"
          tell menu bar item 1 of menu bar 2
            click
            delay 0.3
            set itemName to name of menu item 1 of menu 1
            key code 53
            return itemName
          end tell
        end tell
      end tell
    `);
    const connected = firstItem.startsWith('Connected to:');
    let location = null;
    if (connected) {
      location = await osascript(`
        tell application "System Events"
          tell process "ExpressVPN"
            tell menu bar item 1 of menu bar 2
              click
              delay 0.3
              set locName to name of menu item 2 of menu 1
              key code 53
              return locName
            end tell
          end tell
        end tell
      `);
    }
    return { connected, location };
  } catch {
    return { connected: false, location: null };
  }
}

async function connect(alias) {
  const location = LOCATIONS[alias];
  if (!location) return false;

  console.log(`[vpn-bridge] connecting to ${location} (${alias})...`);
  try {
    await osascript(`
      tell application "System Events"
        tell process "ExpressVPN"
          tell menu bar item 1 of menu bar 2
            click
            delay 0.5
            set recMenu to menu item "Recommended" of menu 1
            click recMenu
            delay 0.5
            click menu item "${location}" of menu 1 of recMenu
          end tell
        end tell
      end tell
    `);
  } catch (err) {
    console.error(`[vpn-bridge] connect failed:`, err.message);
    return false;
  }

  // Poll until connected
  const start = Date.now();
  while (Date.now() - start < 30000) {
    await sleep(2000);
    const s = await getStatus();
    if (s.connected) {
      console.log(`[vpn-bridge] connected to ${s.location} in ${Date.now() - start}ms`);
      return true;
    }
  }
  console.error(`[vpn-bridge] connect timed out`);
  return false;
}

async function disconnect() {
  const s = await getStatus();
  if (!s.connected) return;
  console.log('[vpn-bridge] disconnecting...');
  try {
    await osascript(`
      tell application "System Events"
        tell process "ExpressVPN"
          tell menu bar item 1 of menu bar 2
            click
            delay 0.5
            click menu item 2 of menu 1
          end tell
        end tell
      end tell
    `);
    const start = Date.now();
    while (Date.now() - start < 15000) {
      await sleep(2000);
      const st = await getStatus();
      if (!st.connected) {
        console.log(`[vpn-bridge] disconnected in ${Date.now() - start}ms`);
        return;
      }
    }
  } catch (err) {
    console.error('[vpn-bridge] disconnect failed:', err.message);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  res.setHeader('Content-Type', 'text/plain');

  if (path === '/v1/status') {
    const s = await getStatus();
    res.end(s.connected ? `Connected to ${s.location}` : 'Not connected');
  } else if (path.startsWith('/v1/connect/')) {
    const alias = path.split('/v1/connect/')[1];
    const ok = await connect(alias);
    res.statusCode = ok ? 200 : 500;
    res.end(ok ? 'Connected' : 'Failed');
  } else if (path === '/v1/disconnect') {
    await disconnect();
    res.end('Disconnected');
  } else if (path === '/v1/publicip/ip') {
    try {
      const resp = await fetch('https://api.ipify.org');
      res.end(await resp.text());
    } catch {
      res.end('unknown');
    }
  } else {
    res.statusCode = 404;
    res.end('Not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[vpn-bridge] ExpressVPN bridge running on http://0.0.0.0:${PORT}`);
  console.log('[vpn-bridge] Docker containers can reach this via http://host.docker.internal:8000');
});
