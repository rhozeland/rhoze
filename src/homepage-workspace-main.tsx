import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import StartPage from "@/start/StartPage";
import ReleasePage from "@/create/ReleasePage";
import PrivateWorkspace from "@/create/PrivateWorkspace";
import PortfolioPage from "@/create/PortfolioPage";
import RewardsPage from "@/create/RewardsPage";
import { ShopProductPage } from "@/shop/Shop";
import { CreatorProfile, BrandProfile, MyProfile } from "@/create/ProfilePages";
import { SavedPage, MessagesPage } from "@/create/ProfileExtras";
import { PageTracker } from "@/lib/analytics";
import "@/index.css";
import WaitlistPage from "@/waitlist/WaitlistPage";

const releaseMatch = location.pathname.match(/^\/release\/([^/]+)\/?$/);

const exclusiveMatch = location.pathname.match(/^\/release\/([^/]+)\/exclusive\/?$/);

const discoverMatch = location.pathname.match(/^\/(discover|projects)\/?$/);
const workspaceMatch = location.pathname.match(/^\/workspace\/([^/]+)\/?$/);
const portfolioMatch = location.pathname.match(/^\/project\/([^/]+)\/?$/);

const profileMatch = location.pathname.match(/^\/(creator|brand)\/([^/]+)\/?$/);

const acctMatch = location.pathname.match(/^\/(saved|messages)\/?$/);
const productMatch = location.pathname.match(/^\/product\/([^/]+)\/?$/);
if (/^\/waitlist\/?$/.test(location.pathname)) {
  document.documentElement.classList.add("release-mode");
  const el = document.createElement("div");
  el.id = "profile-root";
  document.body.appendChild(el);
  createRoot(el).render(<WaitlistPage />);
} else if (productMatch) {
  document.documentElement.classList.add("release-mode");
  const el = document.createElement("div");
  el.id = "profile-root";
  document.body.appendChild(el);
  document.title = "Shop | Rhozeland";
  createRoot(el).render(<ShopProductPage handle={decodeURIComponent(productMatch[1])} />);
} else if (/^\/rewards\/?$/.test(location.pathname)) {
  document.documentElement.classList.add("release-mode");
  const el = document.createElement("div");
  el.id = "profile-root";
  document.body.appendChild(el);
  createRoot(el).render(<RewardsPage />);
} else if (portfolioMatch) {
  document.documentElement.classList.add("release-mode");
  const el = document.createElement("div");
  el.id = "release-root";
  document.body.appendChild(el);
  createRoot(el).render(<PortfolioPage slug={decodeURIComponent(portfolioMatch[1])} />);
} else if (workspaceMatch) {
  document.documentElement.classList.add("release-mode");
  const el = document.createElement("div");
  el.id = "release-root";
  document.body.appendChild(el);
  createRoot(el).render(<PrivateWorkspace id={workspaceMatch[1]} />);
} else if (acctMatch) {
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
} else if (profileMatch) {
  document.documentElement.classList.add("release-mode");
  const el = document.createElement("div");
  el.id = "profile-root";
  document.body.appendChild(el);
  const pslug = decodeURIComponent(profileMatch[2]);
  createRoot(el).render(profileMatch[1] === "creator" ? <CreatorProfile slug={pslug} /> : <BrandProfile slug={pslug} />);
} else if (discoverMatch) {
  // Discover is the static Featured Projects page (public/discover.html).
  location.replace("/discover.html" + location.search);
} else if (exclusiveMatch) {
  const params = new URLSearchParams(location.search);
  params.set("tab", "exclusive");
  location.replace(`/release/${exclusiveMatch[1]}?${params}#exclusive`);
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
