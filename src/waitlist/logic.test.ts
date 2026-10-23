import { describe,it,expect } from 'vitest';
import { waitlistSchema,visibleCount,csvCell } from './logic';
describe('waitlist rules',()=>{
 it('hides counts at 25 and reveals 26',()=>{expect(visibleCount(25)).toBeNull();expect(visibleCount(26)).toBe(26);});
 it('requires a valid email',()=>{expect(waitlistSchema.safeParse({email:'bad',role:'artist',project:'',referrer:''}).success).toBe(false);});
 it('accepts the four specified roles',()=>{for(const role of ['artist','brand','creative','fan']) expect(waitlistSchema.safeParse({email:'hello@example.com',role,project:'',referrer:''}).success).toBe(true);});
 it('neutralizes spreadsheet formulas',()=>{expect(csvCell('=1+1')).toBe('"\'=1+1"');});
});
