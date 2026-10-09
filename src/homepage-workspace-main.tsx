import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import StartPage from "@/start/StartPage";
import ReleasePage from "@/create/ReleasePage";
import ExclusivePage from "@/create/ExclusivePage";
import DiscoverPage from "@/create/DiscoverPage";
import MyProjects from "@/create/MyProjects";
import { CreatorProfile, BrandProfile, MyProfile } from "@/create/ProfilePages";
import { SavedPage, MessagesPage } from "@/create/ProfileExtras";
import { PageTracker } from "@/lib/analytics";
import "@/index.css";

const releaseMatch = location.pathname.match(/^\/release\/([^/]+)\/?$/);

const exclusiveMatch = location.pathname.match(/^\/release\/([^/]+)\/exclusive\/?$/);

const discoverMatch = location.pathname.match(/^\/discover\/?$/);

const profileMatch = location.pathname.match(/^\/(creator|brand)\/([^/]+)\/?$/);

const acctMatch = location.pathname.match(/^\/(saved|messages)\/?$/);
if (acctMatch) {
  document.documentElement.classList.add("release-mode");
  const el = document.createElement("div");
  el.id = "profile-root";
  document.body.appendChild(el);
  createRoot(el).render(acctMatch[1] === "saved" ? <SavedPage /> : <MessagesPage />);
} else if (/^\/me\/?$/.test(location.pathname)) {
  document.documentElement.classList.add("release-mode");
  const el = document.createElement("div");
  el.id = "profile-root";
  document.body.appendChild(el);
  createRoot(el).render(<MyProfile />);
} else if (/^\/my-projects\/?$/.test(location.pathname)) {
  document.documentElement.classList.add("release-mode");
  const el = document.createElement("div");
  el.id = "profile-root";
  document.body.appendChild(el);
  createRoot(el).render(<MyProjects />);
} else if (profileMatch) {
  document.documentElement.classList.add("release-mode");
  const el = document.createElement("div");
  el.id = "profile-root";
  document.body.appendChild(el);
  const pslug = decodeURIComponent(profileMatch[2]);
  createRoot(el).render(profileMatch[1] === "creator" ? <CreatorProfile slug={pslug} /> : <BrandProfile slug={pslug} />);
} else if (discoverMatch) {
  document.documentElement.classList.add("release-mode");
  const el = document.createElement("div");
  el.id = "discover-root";
  document.body.appendChild(el);
  createRoot(el).render(<DiscoverPage />);
} else if (exclusiveMatch) {
  document.documentElement.classList.add("release-mode");
  const el = document.createElement("div");
  el.id = "release-root";
  document.body.appendChild(el);
  createRoot(el).render(<ExclusivePage slug={decodeURIComponent(exclusiveMatch[1])} />);
} else if (releaseMatch) {
  document.documentElement.classList.add("release-mode");
  const el = document.createElement("div");
  el.id = "release-root";
  document.body.appendChild(el);
  createRoot(el).render(<ReleasePage slug={decodeURIComponent(releaseMatch[1])} />);
} else {
  const rootElement = document.getElementById("homepage-workspace-root");
  if (rootElement) {
    const queryClient = new QueryClient();
    createRoot(rootElement).render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <PageTracker />
          <StartPage embedded />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>,
    );
  }
}
