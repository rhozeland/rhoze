// City coordinates follow Creator OS's regional explorer, without its invented default location.
const CITIES: Record<string, [number,number]> = {toronto:[43.6532,-79.3832],montreal:[45.5017,-73.5673],vancouver:[49.2827,-123.1207],'new york':[40.71,-74], 'los angeles':[34.05,-118.24],london:[51.51,-.13],paris:[48.86,2.35],berlin:[52.52,13.4],tokyo:[35.68,139.69],seoul:[37.55,126.99],lagos:[6.45,3.4],sydney:[-33.87,151.21],kingston:[17.97,-76.79]};
const COUNTRIES: Record<string,[number,number]>={CA:[56.13,-106.35],US:[39.8,-98.6],GB:[54,-2],NG:[9.08,8.68],JM:[18.1,-77.3],FR:[46.2,2.2],DE:[51.16,10.45],JP:[36.2,138.25],KR:[35.9,127.8],BR:[-14.2,-51.9],MX:[23.6,-102.5]};
export function publicLocation(city?: string|null,country?: string|null) {
 const point=CITIES[city?.trim().toLowerCase()||''];
 if(point) return {lat:point[0],lng:point[1],city:city||''};
 const region=COUNTRIES[country?.toUpperCase()||''];
 return region ? {lat:region[0],lng:region[1],city:country+' · country-level'} : null;
}
