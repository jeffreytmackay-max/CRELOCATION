import type { City, StaffLocation } from '../types';

/** Sample staff distribution (home city / ZIP + headcount) per metro. */
const SEED_STAFF: Record<string, StaffLocation[]> = {
  houston: [
    { id: 'st1', city: 'Katy', state: 'TX', zip: '77494', employees: '14' },
    { id: 'st2', city: 'Sugar Land', state: 'TX', zip: '77479', employees: '9' },
    { id: 'st3', city: 'The Woodlands', state: 'TX', zip: '77380', employees: '7' },
  ],
  sanramon: [
    { id: 'st1', city: 'San Ramon', state: 'CA', zip: '94583', employees: '12' },
    { id: 'st2', city: 'Dublin', state: 'CA', zip: '94568', employees: '8' },
    { id: 'st3', city: 'Walnut Creek', state: 'CA', zip: '94596', employees: '6' },
  ],
  sandiego: [
    { id: 'st1', city: 'San Diego', state: 'CA', zip: '92127', employees: '10' },
    { id: 'st2', city: 'La Jolla', state: 'CA', zip: '92037', employees: '7' },
    { id: 'st3', city: 'Chula Vista', state: 'CA', zip: '91910', employees: '5' },
  ],
  losangeles: [
    { id: 'st1', city: 'Santa Monica', state: 'CA', zip: '90401', employees: '11' },
    { id: 'st2', city: 'Pasadena', state: 'CA', zip: '91101', employees: '8' },
    { id: 'st3', city: 'Long Beach', state: 'CA', zip: '90802', employees: '6' },
  ],
};

/** Sample municipality / sub-area label per candidate site (by city → site id). */
const SEED_AREAS: Record<string, Record<string, string>> = {
  houston: {
    tmc: 'Houston, TX',
    energy: 'Houston, TX',
    woodlands: 'The Woodlands, TX',
    sugarland: 'Sugar Land, TX',
    uptown: 'Houston, TX',
  },
  sanramon: {
    bishopranch: 'San Ramon, CA',
    dublin: 'Dublin, CA',
    walnutcreek: 'Walnut Creek, CA',
    hacienda: 'Pleasanton, CA',
    emeryville: 'Emeryville, CA',
  },
  sandiego: {
    torreypines: 'La Jolla, CA',
    sorrento: 'San Diego, CA',
    downtown: 'San Diego, CA',
    kearnymesa: 'San Diego, CA',
    carlsbad: 'Carlsbad, CA',
  },
  losangeles: {
    westwood: 'Los Angeles, CA',
    elsegundo: 'El Segundo, CA',
    pasadena: 'Pasadena, CA',
    culvercity: 'Culver City, CA',
    cedars: 'Los Angeles, CA',
  },
};

/** Sample crime & safety score per candidate site (higher = safer). */
const SEED_CRIME: Record<string, Record<string, number>> = {
  houston: { tmc: 62, energy: 70, woodlands: 88, sugarland: 84, uptown: 66 },
  sanramon: { bishopranch: 86, dublin: 82, walnutcreek: 80, hacienda: 82, emeryville: 58 },
  sandiego: { torreypines: 82, sorrento: 78, downtown: 60, kearnymesa: 72, carlsbad: 84 },
  losangeles: { westwood: 74, elsegundo: 76, pasadena: 70, culvercity: 68, cedars: 72 },
};

/** Sample crime & safety score for each city's current office. */
const SEED_OFFICE_CRIME: Record<string, number> = {
  houston: 68,
  sanramon: 84,
  sandiego: 74,
  losangeles: 66,
};

/** Fresh copy of the sample cities used as seed / reset data. */
export function seedCities(): City[] {
  const cities: City[] = [
    {
      id: 'houston',
      name: 'Houston',
      state: 'TX',
      center: [29.76, -95.37],
      zoom: 10,
      office: {
        on: false,
        address: '',
        lat: 29.746,
        lng: -95.464,
        scores: { hospital: 72, airport: 76, commute: 72, space: 58, risk: 60 },
        note: 'Your current Houston office — scored on the same factors as a benchmark for the candidate sites.',
        facts: [
          ['Status', 'Current office'],
          ['Approx. rent', '$34 / sq ft'],
          ['Drive to IAH', '36 min'],
          ['Nearest transplant ctr', '18 min'],
        ],
      },
      centers: [
        { id: 'c1', short: 'Houston Methodist', address: '6565 Fannin St, Houston, TX 77030', lat: 29.7106, lng: -95.399 },
        { id: 'c2', short: 'Mem. Hermann–TMC', address: '6411 Fannin St, Houston, TX 77030', lat: 29.7124, lng: -95.398 },
        { id: 'c3', short: 'Baylor St. Luke’s', address: '6720 Bertner Ave, Houston, TX 77030', lat: 29.708, lng: -95.402 },
      ],
      airports: [
        { id: 'a1', code: 'IAH', name: 'George Bush Intercontinental', lat: 29.9902, lng: -95.3368 },
        { id: 'a2', code: 'HOU', name: 'William P. Hobby', lat: 29.6454, lng: -95.2789 },
      ],
      sites: [
        {
          id: 'tmc', name: 'Texas Medical Center', short: 'TMC', lat: 29.71, lng: -95.401,
          scores: { hospital: 99, airport: 74, commute: 66, space: 48, risk: 58 },
          note: 'Inside the world’s largest medical complex — unmatched transplant-center adjacency, but tight, premium space and dense traffic.',
          facts: [['Asking rent', '$41 / sq ft'], ['Space available', '~90k sq ft'], ['Drive to IAH', '38 min'], ['Nearest transplant ctr', 'On campus'], ['Flood zone', 'Partial (500-yr)']],
        },
        {
          id: 'energy', name: 'Energy Corridor', short: 'Energy Corridor', lat: 29.783, lng: -95.635,
          scores: { hospital: 58, airport: 68, commute: 74, space: 90, risk: 60 },
          note: 'West-side business district with abundant, affordable large-floorplate space off I-10 — furthest from the Medical Center.',
          facts: [['Asking rent', '$28 / sq ft'], ['Space available', '~260k sq ft'], ['Drive to IAH', '42 min'], ['Nearest transplant ctr', '32 min'], ['Flood zone', 'Elevated (Buffalo Bayou)']],
        },
        {
          id: 'woodlands', name: 'The Woodlands', short: 'The Woodlands', lat: 30.1658, lng: -95.512,
          scores: { hospital: 62, airport: 82, commute: 58, space: 88, risk: 70 },
          note: 'Master-planned northern hub — low risk, plentiful space and close to IAH, but a long haul from the TMC core.',
          facts: [['Asking rent', '$31 / sq ft'], ['Space available', '~180k sq ft'], ['Drive to IAH', '28 min'], ['Nearest transplant ctr', '40 min'], ['Flood zone', 'Minimal']],
        },
        {
          id: 'sugarland', name: 'Sugar Land', short: 'Sugar Land', lat: 29.6197, lng: -95.6349,
          scores: { hospital: 66, airport: 60, commute: 80, space: 84, risk: 66 },
          note: 'Southwest suburb popular with staff — good value space and short commutes, weaker airport and hospital access.',
          facts: [['Asking rent', '$29 / sq ft'], ['Space available', '~150k sq ft'], ['Drive to IAH', '48 min'], ['Nearest transplant ctr', '30 min'], ['Flood zone', 'Low']],
        },
        {
          id: 'uptown', name: 'Uptown / Galleria', short: 'Uptown', lat: 29.746, lng: -95.464,
          scores: { hospital: 74, airport: 78, commute: 76, space: 62, risk: 60 },
          note: 'Central mixed-use district balancing airport, hospital and commute access with a deep amenity base.',
          facts: [['Asking rent', '$36 / sq ft'], ['Space available', '~110k sq ft'], ['Drive to IAH', '34 min'], ['Nearest transplant ctr', '18 min'], ['Flood zone', 'Low']],
        },
      ],
    },

    {
      id: 'sanramon',
      name: 'San Ramon',
      state: 'CA',
      center: [37.76, -122.05],
      zoom: 10,
      office: {
        on: false,
        address: '',
        lat: 37.759,
        lng: -121.958,
        scores: { hospital: 68, airport: 76, commute: 88, space: 74, risk: 60 },
        note: 'Your current San Ramon office — scored on the same factors as a benchmark for the candidate sites.',
        facts: [['Status', 'Current office'], ['Approx. rent', '$40 / sq ft'], ['Drive to SJC', '42 min'], ['Nearest transplant ctr', '40 min']],
      },
      centers: [
        { id: 'c1', short: 'UCSF', address: '505 Parnassus Ave, San Francisco, CA 94143', lat: 37.763, lng: -122.458 },
        { id: 'c2', short: 'Stanford Health', address: '300 Pasteur Dr, Palo Alto, CA 94304', lat: 37.435, lng: -122.176 },
        { id: 'c3', short: 'John Muir', address: '1601 Ygnacio Valley Rd, Walnut Creek, CA 94598', lat: 37.906, lng: -122.068 },
      ],
      airports: [{ id: 'a1', code: 'SJC', name: 'San Jose Mineta', lat: 37.363, lng: -121.929 }],
      sites: [
        {
          id: 'bishopranch', name: 'Bishop Ranch', short: 'Bishop Ranch', lat: 37.759, lng: -121.958,
          scores: { hospital: 70, airport: 78, commute: 92, space: 78, risk: 60 },
          note: 'Flagship Tri-Valley business park — excellent commutes for East Bay staff and ample modern space, moderate hospital adjacency.',
          facts: [['Asking rent', '$44 / sq ft'], ['Space available', '~200k sq ft'], ['Drive to SJC', '40 min'], ['Nearest transplant ctr', '40 min'], ['Seismic zone', 'Moderate']],
        },
        {
          id: 'dublin', name: 'Dublin / Pleasanton', short: 'Dublin/Pleasanton', lat: 37.703, lng: -121.888,
          scores: { hospital: 66, airport: 82, commute: 84, space: 72, risk: 62 },
          note: 'BART-served I-580/680 hub with strong transit, good airport reach and competitive space.',
          facts: [['Asking rent', '$42 / sq ft'], ['Space available', '~170k sq ft'], ['Drive to SJC', '38 min'], ['Nearest transplant ctr', '42 min'], ['Seismic zone', 'Moderate']],
        },
        {
          id: 'walnutcreek', name: 'Walnut Creek', short: 'Walnut Creek', lat: 37.906, lng: -122.065,
          scores: { hospital: 78, airport: 74, commute: 80, space: 54, risk: 58 },
          note: 'Amenity-rich downtown with better hospital access, but tighter and pricier space.',
          facts: [['Asking rent', '$48 / sq ft'], ['Space available', '~80k sq ft'], ['Drive to SJC', '48 min'], ['Nearest transplant ctr', '30 min'], ['Seismic zone', 'Moderate']],
        },
        {
          id: 'hacienda', name: 'Hacienda Business Park', short: 'Hacienda', lat: 37.692, lng: -121.9,
          scores: { hospital: 68, airport: 80, commute: 82, space: 76, risk: 62 },
          note: 'Large established Pleasanton campus park — dependable space and access with easy freeway connectivity.',
          facts: [['Asking rent', '$41 / sq ft'], ['Space available', '~190k sq ft'], ['Drive to SJC', '36 min'], ['Nearest transplant ctr', '44 min'], ['Seismic zone', 'Moderate']],
        },
        {
          id: 'emeryville', name: 'Emeryville Bayfront', short: 'Emeryville', lat: 37.838, lng: -122.293,
          scores: { hospital: 84, airport: 86, commute: 62, space: 50, risk: 54 },
          note: 'Biotech-dense bayfront node closest to UCSF and three airports — offset by longer commutes and constrained supply.',
          facts: [['Asking rent', '$52 / sq ft'], ['Space available', '~70k sq ft'], ['Drive to SJC', '45 min'], ['Nearest transplant ctr', '18 min'], ['Seismic zone', 'Elevated']],
        },
      ],
    },

    {
      id: 'sandiego',
      name: 'San Diego',
      state: 'CA',
      center: [32.83, -117.15],
      zoom: 10,
      office: {
        on: false,
        address: '',
        lat: 32.9,
        lng: -117.205,
        scores: { hospital: 78, airport: 74, commute: 70, space: 64, risk: 64 },
        note: 'Your current San Diego office — scored on the same factors as a benchmark for the candidate sites.',
        facts: [['Status', 'Current office'], ['Approx. rent', '$42 / sq ft'], ['Drive to SAN', '18 min'], ['Nearest transplant ctr', '14 min']],
      },
      centers: [
        { id: 'c1', short: 'UC San Diego', address: '9300 Campus Point Dr, La Jolla, CA 92037', lat: 32.876, lng: -117.226 },
        { id: 'c2', short: 'Scripps', address: '10666 N Torrey Pines Rd, La Jolla, CA 92037', lat: 32.895, lng: -117.243 },
        { id: 'c3', short: 'Sharp Memorial', address: '7901 Frost St, San Diego, CA 92123', lat: 32.797, lng: -117.155 },
      ],
      airports: [{ id: 'a1', code: 'SAN', name: 'San Diego Intl', lat: 32.7336, lng: -117.1897 }],
      sites: [
        {
          id: 'torreypines', name: 'Torrey Pines / UTC', short: 'Torrey Pines', lat: 32.874, lng: -117.235,
          scores: { hospital: 92, airport: 70, commute: 66, space: 58, risk: 66 },
          note: 'Premier life-sciences mesa anchored by UC San Diego — top transplant-center access, premium but available lab space.',
          facts: [['Asking rent', '$54 / sq ft'], ['Space available', '~120k sq ft'], ['Drive to SAN', '22 min'], ['Nearest transplant ctr', '8 min'], ['Seismic / fire', 'Moderate']],
        },
        {
          id: 'sorrento', name: 'Sorrento Valley', short: 'Sorrento Valley', lat: 32.9, lng: -117.205,
          scores: { hospital: 80, airport: 72, commute: 72, space: 66, risk: 64 },
          note: 'Core biotech corridor with balanced access and a deep supply of R&D space along I-805.',
          facts: [['Asking rent', '$46 / sq ft'], ['Space available', '~160k sq ft'], ['Drive to SAN', '20 min'], ['Nearest transplant ctr', '14 min'], ['Seismic / fire', 'Moderate']],
        },
        {
          id: 'downtown', name: 'Downtown / Bayfront', short: 'Downtown', lat: 32.712, lng: -117.168,
          scores: { hospital: 74, airport: 88, commute: 70, space: 60, risk: 62 },
          note: 'Urban core minutes from the airport with strong transit — solid all-round, fewer lab-ready options.',
          facts: [['Asking rent', '$43 / sq ft'], ['Space available', '~100k sq ft'], ['Drive to SAN', '9 min'], ['Nearest transplant ctr', '16 min'], ['Seismic / fire', 'Low']],
        },
        {
          id: 'kearnymesa', name: 'Kearny Mesa', short: 'Kearny Mesa', lat: 32.833, lng: -117.15,
          scores: { hospital: 76, airport: 82, commute: 78, space: 74, risk: 66 },
          note: 'Central, well-connected district — the value pick with good space supply and short drives everywhere.',
          facts: [['Asking rent', '$38 / sq ft'], ['Space available', '~180k sq ft'], ['Drive to SAN', '15 min'], ['Nearest transplant ctr', '13 min'], ['Seismic / fire', 'Low']],
        },
        {
          id: 'carlsbad', name: 'Carlsbad', short: 'Carlsbad', lat: 33.158, lng: -117.35,
          scores: { hospital: 60, airport: 58, commute: 64, space: 82, risk: 70 },
          note: 'North-county coastal hub with the most affordable, plentiful space — farthest from airport and transplant centers.',
          facts: [['Asking rent', '$36 / sq ft'], ['Space available', '~220k sq ft'], ['Drive to SAN', '40 min'], ['Nearest transplant ctr', '35 min'], ['Seismic / fire', 'Elevated (wildfire)']],
        },
      ],
    },

    {
      id: 'losangeles',
      name: 'Los Angeles',
      state: 'CA',
      center: [34.05, -118.3],
      zoom: 10,
      office: {
        on: false,
        address: '',
        lat: 34.021,
        lng: -118.396,
        scores: { hospital: 80, airport: 76, commute: 58, space: 52, risk: 56 },
        note: 'Your current Los Angeles office — scored on the same factors as a benchmark for the candidate sites.',
        facts: [['Status', 'Current office'], ['Approx. rent', '$46 / sq ft'], ['Drive to LAX', '25 min'], ['Nearest transplant ctr', '15 min']],
      },
      centers: [
        { id: 'c1', short: 'Cedars-Sinai', address: '8700 Beverly Blvd, Los Angeles, CA 90048', lat: 34.0754, lng: -118.38 },
        { id: 'c2', short: 'UCLA Health', address: '757 Westwood Plaza, Los Angeles, CA 90095', lat: 34.0664, lng: -118.4452 },
        { id: 'c3', short: 'Keck / USC', address: '1500 San Pablo St, Los Angeles, CA 90033', lat: 34.061, lng: -118.201 },
      ],
      airports: [
        { id: 'a1', code: 'LAX', name: 'Los Angeles Intl', lat: 33.9416, lng: -118.4085 },
        { id: 'a2', code: 'BUR', name: 'Hollywood Burbank', lat: 34.2007, lng: -118.3587 },
        { id: 'a3', code: 'LGB', name: 'Long Beach', lat: 33.8177, lng: -118.1516 },
        { id: 'a4', code: 'SNA', name: 'John Wayne / Orange County', lat: 33.6757, lng: -117.8683 },
      ],
      sites: [
        {
          id: 'westwood', name: 'Westwood (UCLA)', short: 'Westwood', lat: 34.063, lng: -118.445,
          scores: { hospital: 96, airport: 78, commute: 52, space: 44, risk: 56 },
          note: 'On UCLA’s doorstep — elite transplant-center access, but scarce, expensive space and heavy congestion.',
          facts: [['Asking rent', '$58 / sq ft'], ['Space available', '~60k sq ft'], ['Drive to LAX', '30 min'], ['Nearest transplant ctr', '5 min'], ['Seismic / fire', 'Moderate']],
        },
        {
          id: 'elsegundo', name: 'El Segundo (LAX)', short: 'El Segundo', lat: 33.917, lng: -118.401,
          scores: { hospital: 66, airport: 96, commute: 66, space: 76, risk: 58 },
          note: 'Adjacent to LAX with the best airport access in the metro and a large modern office supply.',
          facts: [['Asking rent', '$45 / sq ft'], ['Space available', '~210k sq ft'], ['Drive to LAX', '10 min'], ['Nearest transplant ctr', '28 min'], ['Seismic / fire', 'Moderate']],
        },
        {
          id: 'pasadena', name: 'Pasadena', short: 'Pasadena', lat: 34.147, lng: -118.144,
          scores: { hospital: 82, airport: 62, commute: 58, space: 66, risk: 60 },
          note: 'Established northeast hub with good hospital access and solid space — weaker airport reach.',
          facts: [['Asking rent', '$44 / sq ft'], ['Space available', '~130k sq ft'], ['Drive to LAX', '45 min'], ['Nearest transplant ctr', '18 min'], ['Seismic / fire', 'Moderate']],
        },
        {
          id: 'culvercity', name: 'Culver City', short: 'Culver City', lat: 34.021, lng: -118.396,
          scores: { hospital: 78, airport: 84, commute: 62, space: 60, risk: 58 },
          note: 'Central Westside media/tech district balancing airport and hospital access with a modernizing supply.',
          facts: [['Asking rent', '$50 / sq ft'], ['Space available', '~120k sq ft'], ['Drive to LAX', '20 min'], ['Nearest transplant ctr', '20 min'], ['Seismic / fire', 'Low']],
        },
        {
          id: 'cedars', name: 'Beverly Hills / Cedars', short: 'Cedars', lat: 34.075, lng: -118.38,
          scores: { hospital: 94, airport: 74, commute: 56, space: 48, risk: 56 },
          note: 'Beside Cedars-Sinai — outstanding transplant adjacency, premium and limited real estate.',
          facts: [['Asking rent', '$56 / sq ft'], ['Space available', '~70k sq ft'], ['Drive to LAX', '32 min'], ['Nearest transplant ctr', '4 min'], ['Seismic / fire', 'Moderate']],
        },
      ],
    },
  ];
  cities.forEach((c) => {
    c.staff = SEED_STAFF[c.id] ?? [];
    const areas = SEED_AREAS[c.id] ?? {};
    const crime = SEED_CRIME[c.id] ?? {};
    c.sites.forEach((s) => {
      if (areas[s.id]) s.area = areas[s.id];
      if (crime[s.id] != null) s.scores.crime = crime[s.id];
    });
    if (SEED_OFFICE_CRIME[c.id] != null) c.office.scores.crime = SEED_OFFICE_CRIME[c.id];
  });
  return cities;
}
