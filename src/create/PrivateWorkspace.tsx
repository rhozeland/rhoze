import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Shell } from "./shared";
import ProjectWorkspace from "./ProjectWorkspace";
import "./project-content.css";

export default function PrivateWorkspace({ id }: { id: string }) {
  const [project, setProject] = useState<any>(undefined);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.rpc("my_releases").then(({ data, error }) => {
      setProject(error ? null : data?.find((r) => r.id === id) || null);
    });
  }, [id]);
  const makePrivate = async () => {
    if (!window.confirm("Remove this project from Discover and make it private?")) return;
    setBusy(true); setError("");
    const { error } = await supabase.rpc("release_make_private", { p_id: id });
    setBusy(false);
    if (error) { setError("Couldn't change project visibility. Try again."); return; }
    setProject((r: any) => ({ ...r, status: "draft" }));
  };
  const publish = async () => {
    if (!window.confirm("Publish this project's cover, description and enabled sections to Discover? Your team email shortlist stays private.")) return;
    setBusy(true); setError("");
    const { data, error } = await supabase.rpc("release_publish", { p_id: id, p_token: localStorage.getItem("rz_release_token") || "" });
    setBusy(false);
    if (error) { setError(/title/.test(error.message) ? "Add a project name before publishing." : "Couldn't publish. Try again."); return; }
    location.href = `/release/${data}`;
  };
  return <Shell><div className="rz-private-head">
    {project && <div className="rz-actions"><Button variant="outline" asChild><a href={`/create.html?draft=${id}`}>Edit project</a></Button>{project.status !== "published" && <Button variant="outline" disabled={busy} onClick={publish}>{busy ? "Publishing…" : "Publish to Discover"}</Button>}{project.status === "published" && <Button variant="outline" disabled={busy} onClick={makePrivate}>Make private</Button>}<Button variant="ghost" asChild><a href="/me">My profile</a></Button></div>}
  </div>{project && <p className="rz-ws-publish">{project.status === "published" ? <><b>Live on Discover</b><a href={`/release/${project.slug}`}>View public page</a></> : <><b>Private — only you can see this.</b><span>To publish:</span><span className={project.title?.trim() ? "ok" : "todo"}>{project.title?.trim() ? "✓" : "○"} Project name</span><span className={(project.milestones || []).length ? "ok" : "todo"}>{(project.milestones || []).length ? "✓" : "○"} At least one roadmap phase</span></>}</p>}{project === undefined ? <p>Loading…</p> : project ? <ProjectWorkspace r={project} onSaved={setProject} /> : <p>Sign in to the project owner's account to open this workspace.</p>}{error && <p role="alert">{error}</p>}</Shell>;
}