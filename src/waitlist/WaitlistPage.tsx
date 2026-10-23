import { useEffect, useState } from 'react';
import { Copy, Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { waitlistSchema, visibleCount } from './logic';
import './waitlist.css';
const roles = [['artist','Artist'],['brand','Brand'],['creative','Creative for hire'],['fan','Fan']] as const;
export default function WaitlistPage(){
 const [email,setEmail]=useState(''),[role,setRole]=useState(''),[project,setProject]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[code,setCode]=useState(''),[copied,setCopied]=useState(false),[count,setCount]=useState<number|null>(null);
 const refreshCount=()=>{supabase.rpc('waitlist_public_count').then(({data})=>setCount(visibleCount(data)));};
 useEffect(()=>{document.title='Early access | Rhozeland';refreshCount();},[]);
 const share=code ? `${location.origin}/waitlist?ref=${code}` : '';
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();setError('');
  const parsed=waitlistSchema.safeParse({email,role,project,referrer:new URLSearchParams(location.search).get('ref')||''});
  if(!parsed.success){setError(parsed.error.issues[0]?.message||'Check your details and try again.');return;}
  setBusy(true);
  try{
   const {data,error:failure}=await supabase.rpc('waitlist_join',{p_email:parsed.data.email,p_role:parsed.data.role,p_project_line:parsed.data.project,p_referrer:parsed.data.referrer});
   if(failure){setError('We couldn’t add you right now. Please try again.');return;}
   const result=data as {status?:string;share_code?:string};
   if(result.status==='duplicate'){setError('You’re already on the list.');return;}
   if(result.share_code){setCode(result.share_code);setEmail('');refreshCount();}else setError('Please try again in a moment.');
  }catch{setError('Check your connection and try again.');}finally{setBusy(false);}
 };
 const copy=async()=>{try{await navigator.clipboard.writeText(share);setCopied(true);}catch{setError('Select the link above to copy it.');}};
 return <div className="waitlist-page"><header className="waitlist-nav"><a href="/" aria-label="Rhozeland home"><img src="/images/logo-white.webp" alt=""/><span>Rhozeland</span></a><Button asChild variant="link"><a href="/me">Sign in</a></Button></header><main className="waitlist-main"><div className="waitlist-heading"><div className="waitlist-eyebrow">Early access</div><h1>Where creators and brands build together.</h1><p>Projects, collaborators and coins in one private workspace. Join the list for early access.</p></div>{code ? <section className="waitlist-form waitlist-success" aria-live="polite"><h2>You’re on the list.</h2><p>Invite creators you’d want to work with.</p><div className="waitlist-share"><label htmlFor="waitlist-share">Your share link</label><input id="waitlist-share" value={share} readOnly onFocus={e=>e.currentTarget.select()}/><Button onClick={copy} variant="outline">{copied?<Check size={16}/>:<Copy size={16}/>} {copied?'Copied':'Copy link'}</Button></div>{error&&<p role="alert" className="waitlist-error">{error}</p>}</section>:<form className="waitlist-form" onSubmit={submit} noValidate><div><label htmlFor="waitlist-email">Email</label><input id="waitlist-email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} aria-describedby={error?'waitlist-error':undefined}/></div><fieldset><legend>I’m a...</legend><div className="waitlist-roles">{roles.map(([value,label])=><Button key={value} type="button" variant="outline" aria-pressed={role===value} onClick={()=>setRole(value)}>{label}</Button>)}</div></fieldset><div><label htmlFor="waitlist-project">What are you working on? <span>(optional)</span></label><input id="waitlist-project" maxLength={500} value={project} onChange={e=>setProject(e.target.value)}/></div>{error&&<p id="waitlist-error" role="alert" className="waitlist-error">{error}</p>}<Button type="submit" disabled={busy} className="waitlist-submit">{busy?'Joining…':'Join the waitlist'}<ArrowRight size={16}/></Button></form>}{count!==null&&<p className="waitlist-count">{count.toLocaleString()} creators on the list</p>}</main><footer className="waitlist-footer">© 2026 Rhozeland<a href="mailto:collab@rhozeland.com">Project inquiries</a></footer></div>;
}
