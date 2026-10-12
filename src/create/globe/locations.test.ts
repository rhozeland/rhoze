import {describe,it,expect} from 'vitest';
import {publicLocation} from './locations';
import {normalizeLoopedIndex} from '../flow-navigation';
describe('Public globe locations',()=>{
 it('does not invent locations for accounts without one',()=>{expect(publicLocation(null,null)).toBeNull();});
 it('does not invent locations for unknown places',()=>{expect(publicLocation('Not a city',null)).toBeNull();});
 it('uses known city coordinates',()=>{expect(publicLocation('Toronto','CA')).toEqual({lat:43.6532,lng:-79.3832,city:'Toronto'});});
});
describe('Creator OS directional flow',()=>{
 it('loops backwards to the last project',()=>{expect(normalizeLoopedIndex(-1,76)).toBe(75);});
 it('loops forwards to the first project',()=>{expect(normalizeLoopedIndex(76,76)).toBe(0);});
});
