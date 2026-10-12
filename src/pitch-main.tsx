import { createRoot } from "react-dom/client";
import PitchApp from "./pitch/PitchApp";
import "./pitch/pitch.css";

const root = document.getElementById("root");
if (root) createRoot(root).render(<PitchApp />);