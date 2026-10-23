import { useEffect,useState } from 'react';
import { Download,RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../lib/auth';
import { csvCell } from '@/waitlist/logic';
type Entry={id:string;email:string;role:string;project_line:string;referrer:string|null;created_at:string;referrals:number;share_code:string};
export default function WaitlistAdmin(){
 const {isAdmin}=useAuth();const [rows,setRows]=useState<Entry[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const load=async()=>{if(!isAdmin)return;setLoading(true);setError('');try{const {data,error}=await supabase.rpc('waitlist_admin_list');if(error)setError('The waitlist couldn’t load. Please try again.');else setRows(data||[]);}catch{setError('Check your connection and try again.');}finally{setLoading(false);}};
 useEffect(()=>{void load();},[isAdmin]);
 if(!isAdmin)return <p>This list is available to admins only.</p>;
 const download=()=>{const csv=[['Email','Role','Project','Referrer','Date','Referrals','Share code'],...rows.map(r=>[r.email,r.role,r.project_line,r.referrer,r.created_at,r.referrals,r.share_code])].map(row=>row.map(csvCell).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='rhozeland-waitlist.csv';a.click();URL.revokeObjectURL(url);};
 return <section className="space-y-5"><header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Early access waitlist</h1><p className="text-sm text-muted-foreground">{rows.length} signups · Private admin list</p></div><div className="flex gap-2"><Button variant="outline" onClick={load} disabled={loading} aria-label="Refresh waitlist"><RefreshCw size={16}/></Button><Button variant="outline" onClick={download} disabled={loading||!rows.length}><Download size={16}/>Export CSV</Button></div></header>{error&&<p role="alert">{error}</p>}{loading?<p>Loading waitlist…</p>:!rows.length?<p>Share <a href="/waitlist" className="underline">the waitlist</a> to welcome your first creators.</p>:<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left">{['Email','Role','Project','Referred by','Joined','Invites'].map(h=><th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-b border-border"><td className="p-3">{r.email}</td><td className="p-3">{r.role}</td><td className="p-3 max-w-xs break-words">{r.project_line||'—'}</td><td className="p-3">{r.referrer||'Direct'}</td><td className="p-3 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td><td className="p-3">{r.referrals}</td></tr>)}</tbody></table></div>}</section>;
}
