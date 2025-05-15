import React from "react";
import ReactDOM from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import { BrowserRouter as Router } from "react-router-dom";
import App from "./App";

// Import CSS files
import "./index.css"; // Your existing global styles
import "./App.css"; // Your existing App specific styles
import "./styles/global.css"; // New global UI framework
import "./styles/layout.css"; // Layout styles
import "./styles/dashboard.css"; // Dashboard specific styles

// Import buffer for polyfill
import { Buffer } from "buffer";
// Add Buffer to window for global usage
window.Buffer = window.Buffer || Buffer;

// Import debug utilities in development mode
if (import.meta.env.DEV) {
  import("./debug-utils.js").catch((e) =>
    console.error("Failed to load debug utils:", e)
  );
}

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

// Using the default Privy App ID provided in the codebase
const PRIVY_APP_ID =
  import.meta.env.VITE_PRIVY_APP_ID || "cmahr8wda0009l70lqdkkq0it";

if (PRIVY_APP_ID === "YOUR_PRIVY_APP_ID") {
  console.warn(
    "Please replace YOUR_PRIVY_APP_ID with your actual Privy App ID in main.tsx and .env file (VITE_PRIVY_APP_ID)."
  );
}

root.render(
  <React.StrictMode>
    <Router>
      <PrivyProvider
        appId={PRIVY_APP_ID}
        config={{
          loginMethods: ["email", "wallet", "google"],
          appearance: {
            theme: "light",
            accentColor: "#676FFF",
            logo: "/Credence.svg",
          },
          embeddedWallets: {
            createOnLogin: "users-without-wallets",
          },
        }}
      >
        <App />
      </PrivyProvider>
    </Router>
  </React.StrictMode>
);
