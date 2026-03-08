import type { FlightSearchParams } from './navigate';

type UrlBuilder = (params: FlightSearchParams) => string;

function fmt(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

function cabinMap(cabinClass: string | undefined, mapping: Record<string, string>): string {
  return mapping[cabinClass ?? 'economy'] ?? mapping['economy'] ?? '';
}

// Known airline URL patterns — avoids an LLM call when we can construct the URL directly
const AIRLINE_URL_BUILDERS: Record<string, UrlBuilder> = {
  // Americas
  'southwest': (p) =>
    `https://www.southwest.com/air/booking/select.html?originationAirportCode=${p.origin}&destinationAirportCode=${p.destination}&departureDate=${fmt(p.dateFrom)}&returnDate=${fmt(p.dateTo)}&adultPassengersCount=1&tripType=roundtrip`,

  'jetblue': (p) =>
    `https://www.jetblue.com/booking/flights?from=${p.origin}&to=${p.destination}&depart=${fmt(p.dateFrom)}&return=${fmt(p.dateTo)}&pax=1&fare=lowest`,

  'delta': (p) =>
    `https://www.delta.com/flight-search/search?cacheKeySuffix=a&action=findFlights&tripType=ROUND_TRIP&departureDate=${fmt(p.dateFrom)}&returnDate=${fmt(p.dateTo)}&paxCount=1&from=${p.origin}&to=${p.destination}&cabinClass=${cabinMap(p.cabinClass, { economy: 'MAIN', premium_economy: 'PREMIUM_ECONOMY', business: 'BUSINESS', first: 'FIRST' })}`,

  'united': (p) =>
    `https://www.united.com/en-us/flights-from-${p.origin}-to-${p.destination}?departure=${fmt(p.dateFrom)}&return=${fmt(p.dateTo)}&passengers=1&cabin=${cabinMap(p.cabinClass, { economy: 'economy', premium_economy: 'premium-economy', business: 'business', first: 'first' })}`,

  'american': (p) =>
    `https://www.aa.com/booking/find-flights?type=roundTrip&origin=${p.origin}&destination=${p.destination}&departDate=${fmt(p.dateFrom)}&returnDate=${fmt(p.dateTo)}&pax=1&cabin=${cabinMap(p.cabinClass, { economy: 'ECONOMY', premium_economy: 'PREMIUM_ECONOMY', business: 'BUSINESS', first: 'FIRST' })}`,

  'avianca': (p) =>
    `https://www.avianca.com/en/booking/select-flights/?origin1=${p.origin}&destination1=${p.destination}&departure1=${fmt(p.dateFrom)}&origin2=${p.destination}&destination2=${p.origin}&departure2=${fmt(p.dateTo)}&adt=1&tng=0&chd=0&inf=0&currency=USD`,

  'latam': (p) =>
    `https://www.latamairlines.com/us/en/booking?origin=${p.origin}&destination=${p.destination}&outbound=${fmt(p.dateFrom)}&inbound=${fmt(p.dateTo)}&adt=1&cabin=Y`,

  'copa': (p) =>
    `https://www.copaair.com/en-us/flight-offers/?origin=${p.origin}&destination=${p.destination}&departureDate=${fmt(p.dateFrom)}&returnDate=${fmt(p.dateTo)}&adults=1`,

  'aeromexico': (p) =>
    `https://www.aeromexico.com/en-us/booking?origin=${p.origin}&destination=${p.destination}&departure=${fmt(p.dateFrom)}&return=${fmt(p.dateTo)}&passengers=1`,

  // Europe
  'ryanair': (p) =>
    `https://www.ryanair.com/gb/en/trip/flights/select?adults=1&dateOut=${fmt(p.dateFrom)}&dateIn=${fmt(p.dateTo)}&origin=${p.origin}&destination=${p.destination}`,

  'easyjet': (p) =>
    `https://www.easyjet.com/en/booking/select-flight?origin=${p.origin}&destination=${p.destination}&outboundDate=${fmt(p.dateFrom)}&inboundDate=${fmt(p.dateTo)}&adults=1`,

  'vueling': (p) =>
    `https://www.vueling.com/en/booking/select?origin=${p.origin}&destination=${p.destination}&outbound=${fmt(p.dateFrom)}&inbound=${fmt(p.dateTo)}&adults=1`,

  'lufthansa': (p) =>
    `https://www.lufthansa.com/us/en/flight-search?origin=${p.origin}&destination=${p.destination}&outbound=${fmt(p.dateFrom)}&inbound=${fmt(p.dateTo)}&pax=1&cabin=${cabinMap(p.cabinClass, { economy: 'eco', premium_economy: 'pre', business: 'bus', first: 'fir' })}`,

  'british airways': (p) =>
    `https://www.britishairways.com/travel/book/public/en_us?origin=${p.origin}&destination=${p.destination}&departureDate=${fmt(p.dateFrom)}&returnDate=${fmt(p.dateTo)}&adults=1&cabin=${cabinMap(p.cabinClass, { economy: 'M', premium_economy: 'W', business: 'C', first: 'F' })}`,

  'air france': (p) =>
    `https://www.airfrance.us/search/offer?origin=${p.origin}&destination=${p.destination}&outboundDate=${fmt(p.dateFrom)}&inboundDate=${fmt(p.dateTo)}&pax=1&cabinClass=${cabinMap(p.cabinClass, { economy: 'ECONOMY', premium_economy: 'PREMIUM', business: 'BUSINESS', first: 'FIRST' })}`,

  'klm': (p) =>
    `https://www.klm.us/search/offer?origin=${p.origin}&destination=${p.destination}&outboundDate=${fmt(p.dateFrom)}&inboundDate=${fmt(p.dateTo)}&pax=1`,

  'iberia': (p) =>
    `https://www.iberia.com/us/flights/?market=US&language=en&origin=${p.origin}&destination=${p.destination}&departure=${fmt(p.dateFrom)}&return=${fmt(p.dateTo)}&adults=1`,

  'turkish airlines': (p) =>
    `https://www.turkishairlines.com/en-us/flights/?origin=${p.origin}&destination=${p.destination}&departureDate=${fmt(p.dateFrom)}&returnDate=${fmt(p.dateTo)}&adult=1`,

  // Middle East & Asia
  'emirates': (p) =>
    `https://www.emirates.com/us/english/book/flight-search/?origin=${p.origin}&destination=${p.destination}&departDate=${fmt(p.dateFrom)}&returnDate=${fmt(p.dateTo)}&pax=1&cabin=${cabinMap(p.cabinClass, { economy: 'economy', premium_economy: 'economy', business: 'business', first: 'first' })}`,

  'qatar airways': (p) =>
    `https://www.qatarairways.com/en/booking/book-a-flight.html?origin=${p.origin}&destination=${p.destination}&departDate=${fmt(p.dateFrom)}&returnDate=${fmt(p.dateTo)}&adults=1`,

  'etihad': (p) =>
    `https://www.etihad.com/en-us/fly-etihad/book-a-flight?origin=${p.origin}&destination=${p.destination}&departureDate=${fmt(p.dateFrom)}&returnDate=${fmt(p.dateTo)}&pax=1`,

  'singapore airlines': (p) =>
    `https://www.singaporeair.com/en_UK/plan-and-book/official-site-background/?origin=${p.origin}&destination=${p.destination}&departureDate=${fmt(p.dateFrom)}&returnDate=${fmt(p.dateTo)}&cabinClass=${cabinMap(p.cabinClass, { economy: 'Y', premium_economy: 'S', business: 'J', first: 'F' })}&adult=1`,

  'cathay pacific': (p) =>
    `https://www.cathaypacific.com/cx/en_US/book-a-trip/flight-search.html?origin=${p.origin}&destination=${p.destination}&departDate=${fmt(p.dateFrom)}&returnDate=${fmt(p.dateTo)}&adults=1`,

  // Oceania
  'qantas': (p) =>
    `https://www.qantas.com/au/en/booking/flight-search.html?origin=${p.origin}&destination=${p.destination}&departureDate=${fmt(p.dateFrom)}&returnDate=${fmt(p.dateTo)}&adults=1`,

  // Africa
  'ethiopian airlines': (p) =>
    `https://www.ethiopianairlines.com/booking/book-a-flight?origin=${p.origin}&destination=${p.destination}&departureDate=${fmt(p.dateFrom)}&returnDate=${fmt(p.dateTo)}&adults=1`,
};

// Normalize airline name for lookup (lowercase, trim, common aliases)
const ALIASES: Record<string, string> = {
  'aa': 'american',
  'american airlines': 'american',
  'ua': 'united',
  'united airlines': 'united',
  'dl': 'delta',
  'delta air lines': 'delta',
  'b6': 'jetblue',
  'wn': 'southwest',
  'southwest airlines': 'southwest',
  'ba': 'british airways',
  'af': 'air france',
  'lh': 'lufthansa',
  'ek': 'emirates',
  'qr': 'qatar airways',
  'sq': 'singapore airlines',
  'cx': 'cathay pacific',
  'qf': 'qantas',
  'ey': 'etihad',
  'tk': 'turkish airlines',
  'av': 'avianca',
  'la': 'latam',
  'cm': 'copa',
  'am': 'aeromexico',
  'fr': 'ryanair',
  'u2': 'easyjet',
  'vy': 'vueling',
  'ib': 'iberia',
  'et': 'ethiopian airlines',
  'ethiopian': 'ethiopian airlines',
};

function normalizeAirline(name: string): string {
  const lower = name.toLowerCase().trim();
  return ALIASES[lower] ?? lower;
}

export function getAirlineUrl(airlineName: string, params: FlightSearchParams): string | null {
  const normalized = normalizeAirline(airlineName);
  const builder = AIRLINE_URL_BUILDERS[normalized];
  return builder ? builder(params) : null;
}

export function isKnownAirline(airlineName: string): boolean {
  return normalizeAirline(airlineName) in AIRLINE_URL_BUILDERS;
}

export function getKnownAirlines(): string[] {
  return Object.keys(AIRLINE_URL_BUILDERS);
}
