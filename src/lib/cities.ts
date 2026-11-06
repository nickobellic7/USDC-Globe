export interface City {
  name: string
  lat: number
  lon: number
}

/** Quick-pick locations. Coordinates are rounded to whole degrees on purpose. */
export const CITIES: readonly City[] = [
  { name: 'New York', lat: 41, lon: -74 },
  { name: 'San Francisco', lat: 38, lon: -122 },
  { name: 'Los Angeles', lat: 34, lon: -118 },
  { name: 'Chicago', lat: 42, lon: -88 },
  { name: 'Miami', lat: 26, lon: -80 },
  { name: 'Toronto', lat: 44, lon: -79 },
  { name: 'Mexico City', lat: 19, lon: -99 },
  { name: 'Bogota', lat: 5, lon: -74 },
  { name: 'Sao Paulo', lat: -24, lon: -47 },
  { name: 'Buenos Aires', lat: -35, lon: -58 },
  { name: 'London', lat: 52, lon: 0 },
  { name: 'Paris', lat: 49, lon: 2 },
  { name: 'Berlin', lat: 53, lon: 13 },
  { name: 'Lisbon', lat: 39, lon: -9 },
  { name: 'Zurich', lat: 47, lon: 9 },
  { name: 'Istanbul', lat: 41, lon: 29 },
  { name: 'Lagos', lat: 6, lon: 3 },
  { name: 'Nairobi', lat: -1, lon: 37 },
  { name: 'Cape Town', lat: -34, lon: 18 },
  { name: 'Cairo', lat: 30, lon: 31 },
  { name: 'Dubai', lat: 25, lon: 55 },
  { name: 'Mumbai', lat: 19, lon: 73 },
  { name: 'Bangalore', lat: 13, lon: 78 },
  { name: 'Singapore', lat: 1, lon: 104 },
  { name: 'Bangkok', lat: 14, lon: 101 },
  { name: 'Hong Kong', lat: 22, lon: 114 },
  { name: 'Seoul', lat: 38, lon: 127 },
  { name: 'Tokyo', lat: 36, lon: 140 },
  { name: 'Manila', lat: 15, lon: 121 },
  { name: 'Sydney', lat: -34, lon: 151 },
]
