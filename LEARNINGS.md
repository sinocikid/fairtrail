# Learnings from Google Flights Internal API Investigation

Investigation date: 2026-03-28. Based on a deep dive into [`punitarani/fli`](https://github.com/punitarani/fli) (v0.7.0, 309 stars).

## Google Flights Internal API

Google Flights exposes undocumented RPC endpoints that return structured JSON without browser rendering:

| Endpoint | Purpose |
|---|---|
| `GetShoppingResults` | Flight search for a specific date |
| `GetCalendarGraph` | Cheapest dates across a date range |
| `GetExploreDestinations` | Cheapest destinations from an origin (unimplemented in fli) |

Base URL: `https://www.google.com/_/FlightsFrontendUi/data/travel.frontend.flights.FlightsFrontendService/`

### Request format

- **Method:** POST with `Content-Type: application/x-www-form-urlencoded;charset=UTF-8`
- **Body:** `f.req={encoded_filters}` where the value is a URL-encoded, double-JSON-serialized nested array
- **No auth tokens needed** -- fully public/unauthenticated
- **TLS fingerprinting required** -- Google detects non-browser TLS handshakes. The `curl_cffi` library with `impersonate="chrome"` handles this

### Payload structure (positional arrays)

The request payload is a deeply nested Python list where each index has a specific meaning:

| Position | Purpose |
|---|---|
| `[1][2]` | Trip type (1=one-way, 2=round-trip, 3=multi-city) |
| `[1][5]` | Seat/cabin class |
| `[1][6]` | Passenger info |
| `[1][13]` | Flight segments (formatted) |
| `[1][28]` | Ticket type filter (1=any, 2=standard/exclude Basic Economy) |
| `[2]` | Sort order |

### Response format

- Response starts with `)]}'` (Google's XSSI protection prefix)
- After stripping the prefix, it's double-encoded JSON: `json.loads(response.text.lstrip(")]}'"))[0][2]` then `json.loads(parsed)`
- Flight data lives at specific array indices:

| Position | Field |
|---|---|
| `data[0][2]` | Flight legs array |
| `fl[22][0]` | Airline IATA code |
| `fl[22][1]` | Flight number |
| `fl[3]` | Departure airport |
| `fl[6]` | Arrival airport |
| `fl[20]`, `fl[8]` | Departure date, time |
| `fl[21]`, `fl[10]` | Arrival date, time |
| `fl[11]` | Leg duration |
| `data[0][9]` | Total duration |
| `data[1][0][-1]` | Price (float, no currency indicator) |

### Round-trip behavior

For round-trip searches, the API uses an iterative selection pattern:

1. First request returns outbound flight options
2. For each selected outbound flight (up to `top_n`), a second request is sent with the selection populated
3. The second request returns matching return flights
4. **The price on the outbound leg is already the full round-trip price** -- do not sum outbound + return

This is critical for extraction accuracy. If the LLM sees "$317" next to a round-trip flight, that's the RT price, not the one-way price.

### Multi-city

Multi-city (`TripType=3`) extends the iterative pattern to N legs. Select leg 1, get leg 2 options, select leg 2, get leg 3 options, etc. The final leg's price is the total combined fare.

## Rate Limiting

- Google returns HTTP 429 after approximately 30 sustained requests from the same IP
- The fli library self-limits to 10 requests/second with exponential backoff retries
- No built-in proxy support exists in fli; one user achieved it via monkey-patching `curl_cffi`:

```python
# curl_cffi expects proxy as a string, not a dict
kwargs["proxy"] = "http://user:pass@proxy:80"
```

- For Fairtrail's cron-based approach (a few queries every 3 hours), this limit is not a concern

## Currency

The internal API returns prices in whatever currency Google associates with the request's IP address:

- German IP returns EUR
- Hong Kong IP returns HKD
- US IP returns USD

There is no request parameter to override currency. This is a significant limitation compared to Playwright, where `&curr=USD` and `&gl=US` URL parameters give explicit control.

## Data returned vs. not returned

**Available from the internal API:**
- Price (float, no currency)
- Duration (minutes)
- Number of stops
- Airline code and name
- Flight number
- Departure/arrival airports
- Departure/arrival datetimes

**Not available (requires browser rendering):**
- Booking/redirect URLs
- Fare class (Basic Economy vs. Standard vs. Business)
- Baggage allowance
- Aircraft type
- Carbon emissions
- "Seats left" indicators
- Price history graph
- Google's "Track prices" feature

## Known failure modes

1. **Intermittent IndexErrors** -- different routes/dates return slightly different response structures. Some flights have empty arrays where prices should be (`data[1][0]` is empty). The fix is defensive parsing with fallback values.

2. **Response structure variations** -- not all flights include all fields at expected positions. This is the primary source of bugs in fli (issues #18, #26).

3. **Rate limiting** -- HTTP 429 with no retry-after header. Requires backoff and ideally proxy rotation for sustained use.

## What Fairtrail can adopt

### Already applies to our Playwright approach

- **RT price awareness:** our LLM extraction prompt should note that round-trip prices shown on Google Flights are already combined. If the page says "$317 round trip", that's the total, not per-leg.
- **Rate limit headroom:** our default 3-hour cron interval with a handful of active queries stays well under the ~30 requests/IP threshold.

### Potential future features

- **Basic Economy filter:** if we ever build advanced search filters, the ticket type control at position `[1][28]` is documented.
- **Explore destinations:** `GetExploreDestinations` could power a "cheapest flights from [city]" discovery feature without scraping the Explore map UI.
- **Hybrid approach:** for features where speed matters more than data completeness (e.g., real-time price alerts), a TypeScript port of the direct API call could complement the Playwright pipeline.

### Decided against

- **Replacing Playwright with direct API calls** -- loses booking URLs, currency control, fare classes, seat counts, and baggage info. These are core to Fairtrail's value proposition.
- **Using fli as a Python sidecar** -- adds a runtime dependency in a different language, and the library has known stability issues (MCP server broken, intermittent IndexErrors, single maintainer).
- **Using fli's MCP server** -- currently broken with fastmcp 3.x, has a round-trip price doubling bug, and lacks proxy/currency support.
