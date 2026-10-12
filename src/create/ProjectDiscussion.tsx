import { useEffect, useState } from "react";
import { MessageSquare, Trash2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AuthModal from "./AuthModal";
import "./discussion.css";
type Comment = {id:string;body:string;created_at:string;display_name:string;slug:string|null;is_mine:boolean};
export default function ProjectDiscussion({releaseId}:{releaseId:string}) {
 const [comments,setComments] = useState<Comment[]>([]);
 const [uid,setUid] = useState<string|null>(null);
 const [body,setBody] = useState("");
 const [busy,setBusy] = useState(false);
 const [error,setError] = useState("");
 const [auth,setAuth] = useState(false);
 const [loaded,setLoaded] = useState(false);
 const load = async () => {const {data,error} = await (supabase.rpc as any)("project_discussion",{p_release_id:releaseId});setLoaded(true);if(error){setError("Comments couldn’t load. Please try again.");return;}setComments(data ?? []);};
 useEffect(()=>{load();supabase.auth.getSession().then(({data})=>setUid(data.session?.user.id ?? null));},[releaseId]);
 const post = async (e:React.FormEvent) => {
  e.preventDefault();if(!uid){setAuth(true);return;}if(!body.trim() || busy)return;
  setBusy(true);setError("");const {error}=await (supabase.from as any)("project_comments").insert({release_id:releaseId,user_id:uid,body:body.trim()});
  setBusy(false);if(error){setError(error.message.includes("wait") ? "Give it a moment before posting again." : "Your comment couldn’t be posted. Please try again.");return;}setBody("");await load();
 };
 const remove = async (id:string) => {const {error}=await (supabase.from as any)("project_comments").delete().eq("id",id);if(error)setError("Couldn’t remove that comment.");else await load();};
 return <section className="rz-discussion" aria-label="Project discussion"><h2 className="rz-h2"><MessageSquare size={18}/>Discussion</h2>
  <form onSubmit={post}><label htmlFor={`comment-${releaseId}`}>Leave a comment</label><textarea id={`comment-${releaseId}`} className="rz-in" maxLength={1000} value={body} onChange={e=>setBody(e.target.value)} placeholder="Show some love. Share a thought."/><div><small>{body.length}/1000</small><Button type="submit" variant="outline" className="rz-btn pri" disabled={busy || (!!uid && !body.trim())}><Send size={13}/>{uid ? busy ? "Posting…":"Post comment":"Sign in to comment"}</Button></div></form>
  {error && <p role="alert" className="rz-err">{error}</p>}
  {!loaded ? <p>Loading discussion…</p> : !comments.length ? <p className="rz-note">No comments yet.</p> : <ul>{comments.map(c=><li key={c.id}><header>{c.slug ? <a href={`/creator/${encodeURIComponent(c.slug)}`}>{c.display_name}</a>:<b>{c.display_name}</b>}<time dateTime={c.created_at}>{new Date(c.created_at).toLocaleDateString()}</time>{c.is_mine && <Button variant="ghost" size="icon" aria-label="Delete your comment" title="Delete your comment" onClick={()=>remove(c.id)}><Trash2 size={14}/></Button>}</header><p>{c.body}</p></li>)}</ul>}
  {auth && <AuthModal action="" redirectTo={location.href} onClose={()=>setAuth(false)} onDone={()=>{setAuth(false);supabase.auth.getSession().then(({data})=>setUid(data.session?.user.id ?? null));load();}}/>}
 </section>;
}
