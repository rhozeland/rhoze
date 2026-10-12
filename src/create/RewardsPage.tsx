import { useEffect, useState } from "react";
import { Gift, Award, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Shell } from "./shared";
import AuthModal from "./AuthModal";
import { CreatorPass } from "./CreatorPass";
import { RewardsCard } from "./Rewards";
import { passLevel } from "./pass-logic";
type Standing = {slug:string;display_name:string;xp:number;contributions:number;rank_position:number};
export default function RewardsPage() {
 const [uid,setUid] = useState<string | null | undefined>();
 const [tab,setTab] = useState<"pass"|"balance"|"leaders">("pass");
 const [auth,setAuth] = useState(false);
 const [standings,setStandings] = useState<Standing[] | null>(null);
 const [error,setError] = useState(false);
 useEffect(() => {document.title="Rewards & Creator Pass | Rhozeland"; supabase.auth.getSession().then(({data})=>setUid(data.session?.user.id ?? null)); const {data}=supabase.auth.onAuthStateChange((_e,s)=>setUid(s?.user.id ?? null)); return()=>data.subscription.unsubscribe();},[]);
 useEffect(() => {let live=true; (supabase.rpc as any)("creator_standings").then(({data,error}:any)=>{if(live){setStandings(data ?? []);setError(!!error);}});return()=>{live=false;};},[]);
 return <Shell><div className="rz-rewards-page">
  <div className="rz-rewards-title"><div><h1>Rewards</h1><p>Your work. Your support. Your progress.</p></div><Gift size={28}/></div>
  <div className="rz-rewards-tabs" role="tablist" aria-label="Rewards views">
   {([["pass","Creator Pass",Award],["balance","Balance & activity",Gift],["leaders","Leaderboard",Trophy]] as const).map(([key,label,Icon])=><Button key={key} variant="outline" className={`rz-btn${tab===key ? " pri":""}`} role="tab" aria-selected={tab===key} onClick={()=>setTab(key)}><Icon size={15}/>{label}</Button>)}
  </div>
  {tab!=="leaders" && uid===undefined && <p>Loading your account…</p>}
  {tab!=="leaders" && uid===null && <section className="rz-rewards-gate"><h2>Your Creator Pass starts here.</h2><p>Sign in to see your earned rewards, contribution badges and progress.</p><Button variant="outline" className="rz-btn pri" onClick={()=>setAuth(true)}>Sign in</Button></section>}
  {uid && tab==="pass" && <div className="rz-rewards-columns"><CreatorPass userId={uid}/><div><h2>Keep building</h2><p className="rz-standings-note">Publish a project, support someone’s work or apply to collaborate. Your earned activity builds your XP—even after rewards leave your balance.</p><div className="rz-rewards-tabs"><Button asChild variant="outline" className="rz-btn"><a href="/create.html">Create a project</a></Button><Button asChild variant="outline" className="rz-btn"><a href="/discover.html">Explore projects</a></Button></div><p className="rz-standings-note">Your rank celebrates contributions, not a cash prize or guaranteed discount.</p></div></div>}
  {uid && tab==="balance" && <RewardsCard userId={uid}/>}
  {tab==="leaders" && <section><h2>People making things happen</h2><p className="rz-standings-note">Lifetime earned XP · public, approved profiles only.</p>{error ? <p role="alert">The leaderboard couldn’t load. Please refresh to try again.</p> : standings===null ? <p>Loading contributions…</p> : !standings.length ? <p>No public contributors yet.</p> : <table className="rz-standings"><thead><tr><th>Rank</th><th>Creator</th><th>Contributions</th><th>XP</th></tr></thead><tbody>{standings.map(s=><tr key={s.slug}><td>#{s.rank_position}</td><td><a href={`/creator/${encodeURIComponent(s.slug)}`}>{s.display_name}</a><div className="rz-standings-note">{passLevel(s.xp).title}</div></td><td>{s.contributions}</td><td>{Number(s.xp).toLocaleString()}</td></tr>)}</tbody></table>}</section>}
 </div>{auth && <AuthModal action="" redirectTo={`${location.origin}/rewards`} onClose={()=>setAuth(false)} onDone={()=>{setAuth(false);location.reload();}}/>}</Shell>;
}
