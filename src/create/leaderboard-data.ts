export type Standing = {slug:string;display_name:string;photo_url:string|null;xp:number;contributions:number;rank_position:number};
export type Historical = {id:string;username:string;points:number};
export type BoardPerson = {key:string;name:string;photo:string|null;href:string|null;points:number;historical:boolean};
export function allTimePeople(current:Standing[],historical:Historical[]):BoardPerson[] {
 return [...current.map(r=>({key:`account:${r.slug}`,name:r.display_name.replace(/^@/,''),photo:r.photo_url,href:`/creator/${encodeURIComponent(r.slug)}`,points:Number(r.xp),historical:false})),...historical.map(r=>({key:`history:${r.id}`,name:r.username.replace(/^@/,''),photo:null,href:null,points:Number(r.points),historical:true}))].sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name));
}
