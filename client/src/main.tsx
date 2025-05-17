import React from "react";
import ReactDOM from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import { BrowserRouter as Router } from "react-router-dom";
import App from "./App";

// Import Solana connectors
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana"; // [3]

// Import CSS files
import "./index.css";
import "./App.css";
import "./styles/global.css";
import "./styles/layout.css";
import "./styles/dashboard.css";

// Import buffer for polyfill
import { Buffer } from "buffer";
window.Buffer = window.Buffer || Buffer;

if (import.meta.env.DEV) {
  import("./debug-utils.js").catch((e) =>
    console.error("Failed to load debug utils:", e)
  );
}

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

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
            //logo: "/Credence.svg",
            // This directs the wallet connection UI to focus on Solana
            walletChainType: "solana-only", // Options: 'solana-only', 'ethereum-and-solana' [3]
          },
          embeddedWallets: {
            // Specify Solana for embedded wallet creation
            solana: {
              createOnLogin: "users-without-wallets", // Creates Solana embedded wallet for new users or those without one [2]
              // Other options: 'all-users', 'off'
            },
            // If you want to disable Ethereum embedded wallet creation explicitly:
            // ethereum: {
            //   createOnLogin: 'off',
            // }
          },
          externalWallets: {
            // Configure Solana connectors for external wallets like Phantom, Solflare etc.
            solana: {
              connectors: toSolanaWalletConnectors(), // Initialize Solana external wallet connectors [3][4]
            },
            // If you previously had Ethereum external wallet connectors and want to remove them,
            // ensure there's no 'ethereum' key here or its connectors are empty.
          },
        }}
      >
        <App />
      </PrivyProvider>
    </Router>
  </React.StrictMode>
);
