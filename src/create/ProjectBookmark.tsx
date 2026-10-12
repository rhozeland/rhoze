import {useEffect,useState} from 'react';
import {Bookmark} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {supabase} from '@/integrations/supabase/client';
import AuthModal from './AuthModal';
export default function ProjectBookmark({href,onChanged}:{href:string;onChanged?:()=>void}) {
 const [saved,setSaved]=useState(false),[busy,setBusy]=useState(false),[auth,setAuth]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;setSaved(false);supabase.auth.getUser().then(async({data})=>{if(!data.user)return;const r=await supabase.from('project_bookmarks').select('project_key').eq('user_id',data.user.id).eq('project_key',href).maybeSingle();if(active)setSaved(!!r.data);});return()=>{active=false;};},[href]);
 const toggle=async()=>{setBusy(true);setError('');try{const {data}=await supabase.auth.getUser();if(!data.user){setAuth(true);return;}const result=saved?await supabase.from('project_bookmarks').delete().eq('user_id',data.user.id).eq('project_key',href):await supabase.from('project_bookmarks').insert({user_id:data.user.id,project_key:href});if(result.error)setError('Could not save this project.');else{setSaved(!saved);onChanged?.();}}finally{setBusy(false);}};
 return <><Button variant="outline" size="icon" title={saved?'Remove bookmark':'Bookmark project'} aria-label={saved?'Remove bookmark':'Bookmark project'} aria-pressed={saved} disabled={busy} onClick={toggle}><Bookmark size={17} fill={saved?'currentColor':'none'}/></Button>{error&&<p role="alert">{error}</p>}{auth&&<AuthModal action="" intro="Sign in to bookmark projects." redirectTo={location.href} onClose={()=>setAuth(false)} onDone={()=>{setAuth(false);toggle();}}/>}</>;
}
