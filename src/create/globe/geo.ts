/**
 * Minimal geo helpers for the Discover globe. Rhozeland doesn't collect
 * creator/release geolocation yet, so every pin defaults to Toronto with a
 * small deterministic jitter (derived from its id) so pins fan out instead
 * of stacking on one point.
 */
export const TORONTO = { lat: 43.6532, lng: -79.3832 };

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
};

/** Deterministic small offset around Toronto so pins don't overlap. */
export const jitterFor = (id: string) => {
  const h = hash(id);
  const a = ((h % 1000) / 1000) * Math.PI * 2;
  const r = 2 + ((Math.floor(h / 1000) % 1000) / 1000) * 6; // 2–8 degrees out
  return {
    lat: TORONTO.lat + Math.sin(a) * r * 0.6,
    lng: TORONTO.lng + Math.cos(a) * r,
  };
};

// A handful of landmark coordinates kept for continent outlines only — not
// tied to any creator data.
export const CONTINENTS: { name: string; points: [number, number][] }[] = [
  {
    name: "North America",
    points: [
      [70, -168], [72, -140], [74, -110], [70, -82], [62, -64], [50, -56],
      [44, -64], [42, -72], [32, -80], [25, -80], [18, -92], [15, -98],
      [22, -106], [30, -116], [40, -124], [49, -125], [55, -132], [60, -148],
      [66, -162],
    ],
  },
  {
    name: "South America",
    points: [
      [12, -72], [10, -62], [5, -52], [-2, -48], [-12, -38], [-22, -40],
      [-32, -52], [-42, -64], [-52, -70], [-54, -72], [-46, -74], [-36, -72],
      [-22, -70], [-10, -78], [0, -80], [8, -78],
    ],
  },
  {
    name: "Europe",
    points: [
      [70, -8], [70, 24], [68, 40], [60, 50], [54, 38], [44, 40], [38, 28],
      [36, 14], [38, -2], [44, -10], [50, -4], [58, -6], [64, -10],
    ],
  },
  {
    name: "Africa",
    points: [
      [36, -8], [36, 12], [32, 24], [30, 34], [16, 42], [10, 50], [-4, 42],
      [-18, 38], [-30, 32], [-34, 22], [-32, 18], [-26, 14], [-20, 12],
      [-12, 12], [-2, 8], [4, -2], [10, -14], [16, -16], [22, -16], [28, -10],
    ],
  },
  {
    name: "Asia",
    points: [
      [78, 60], [80, 100], [76, 140], [70, 170], [60, 168], [54, 156],
      [50, 142], [42, 132], [34, 134], [22, 120], [10, 108], [4, 100],
      [10, 92], [22, 88], [22, 72], [30, 60], [38, 50], [44, 46], [54, 44],
      [60, 50], [70, 56],
    ],
  },
  {
    name: "Oceania",
    points: [
      [-12, 130], [-10, 140], [-12, 152], [-22, 154], [-32, 152], [-38, 146],
      [-36, 138], [-32, 128], [-26, 120], [-18, 122],
    ],
  },
];
