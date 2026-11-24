/**
 * Starts the app in the browser. Places the login and account screen inside the page's root
 * element; that screen opens the invoice workspace after a business is selected.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import AuthShell from "../app/auth-shell";
createRoot(document.getElementById("root")).render(<AuthShell />);
