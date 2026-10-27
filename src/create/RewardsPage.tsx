import { useEffect, useState } from "react";
import { Gift, Award, Trophy, ShoppingBag } from "lucide-react";
import Shop from "@/shop/Shop";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Shell } from "./shared";
import AuthModal from "./AuthModal";
import { CreatorPass, PassBenefits } from "./CreatorPass";
import { RewardsCard } from "./Rewards";
import Leaderboard from "./Leaderboard";
export default function RewardsPage() {
 const [uid,setUid] = useState<string | null | undefined>();
 const [tab,setTab] = useState<"pass"|"balance"|"leaders"|"shop">(new URLSearchParams(location.search).get("tab")==="shop" ? "shop" : new URLSearchParams(location.search).get("tab")==="leaders" ? "leaders" : "pass");
 const [auth,setAuth] = useState(false);
 useEffect(() => {document.title="Rewards & Creator Pass | Rhozeland"; supabase.auth.getSession().then(({data})=>setUid(data.session?.user.id ?? null)); const {data}=supabase.auth.onAuthStateChange((_e,s)=>setUid(s?.user.id ?? null)); return()=>data.subscription.unsubscribe();},[]);
 return <Shell><div className="rz-rewards-page">
  <div className="rz-rewards-title"><div><h1>Rewards</h1><p>Your work. Your support. Your progress.</p></div><Gift size={28}/></div>
  <div className="rz-rewards-tabs" role="tablist" aria-label="Rewards views">
   {([["pass","Creator Pass",Award],["balance","Balance & activity",Gift],["leaders","Leaderboard",Trophy],["shop","Shop",ShoppingBag]] as const).map(([key,label,Icon])=><Button key={key} variant="outline" className={`rz-btn${tab===key ? " pri":""}`} role="tab" aria-selected={tab===key} onClick={()=>{setTab(key);history.replaceState(null,"",`?tab=${key}`);}}><Icon size={15}/>{label}</Button>)}
  </div>
  {tab!=="leaders" && tab!=="shop" && uid===undefined && <p>Loading your account…</p>}
  {tab!=="leaders" && tab!=="shop" && uid===null && <section className="rz-rewards-gate"><h2>Your Creator Pass starts here.</h2><p>Sign in to see your earned rewards, contribution badges and progress.</p><Button variant="outline" className="rz-btn pri" onClick={()=>setAuth(true)}>Sign in</Button></section>}
  {tab!=="leaders" && tab!=="shop" && uid===null && <PassBenefits/>}
  {uid && tab==="pass" && <div className="rz-rewards-columns"><CreatorPass userId={uid}/><div><h2>Keep building</h2><p className="rz-standings-note">Publish a project, support someone’s work or apply to collaborate. Your earned activity builds your XP—even after rewards leave your balance.</p><div className="rz-rewards-tabs"><Button asChild variant="outline" className="rz-btn"><a href="/create.html">Create a project</a></Button><Button asChild variant="outline" className="rz-btn"><a href="/discover.html">Explore projects</a></Button></div><p className="rz-standings-note">Your rank celebrates contributions, not a cash prize or guaranteed discount.</p><PassBenefits/></div></div>}
  {uid && tab==="balance" && <RewardsCard userId={uid}/>}
   {tab==="leaders" && <Leaderboard userId={uid} onBalance={()=>setTab("balance")}/>}
   {tab==="shop" && <Shop/>}
 </div>{auth && <AuthModal action="" redirectTo={`${location.origin}/rewards`} onClose={()=>setAuth(false)} onDone={()=>{setAuth(false);location.reload();}}/>}</Shell>;
}
