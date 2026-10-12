import {expect,it} from 'vitest';
import {allTimePeople} from './leaderboard-data';
it('shows real all-time community and project points in descending order',()=>{
 const rows=allTimePeople([{slug:'creator',display_name:'Creator',photo_url:'photo',xp:500,contributions:1,rank_position:1}],[{id:'old',username:'@Member',points:4025}]);
 expect(rows.map(r=>r.points)).toEqual([4025,500]);expect(rows[1].photo).toBe('photo');
});
it('does not link or merge an unverified historical handle into an account',()=>{
 const rows=allTimePeople([{slug:'member',display_name:'Member',photo_url:null,xp:25,contributions:1,rank_position:1}],[{id:'old',username:'@Member',points:100}]);
 expect(rows).toHaveLength(2);expect(rows[0].href).toBeNull();expect(rows[1].points).toBe(25);
});
