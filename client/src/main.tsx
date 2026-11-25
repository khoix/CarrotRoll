import { createRoot } from "react-dom/client";
import App from "./App";
import "./style/style.css";
import "./style/web.css";
import "./style/mobile.css";

createRoot(document.getElementById("root")!).render(<App />);
