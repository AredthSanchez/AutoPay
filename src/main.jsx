/**
 * Starts AutoPay in the browser by displaying the login and account screen inside the HTML page.
 * The invoice workspace opens after a business is selected.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import AuthShell from "../app/auth-shell";
createRoot(document.getElementById("root")).render(<AuthShell />);
