/**
 * Browser entry point. Mounts the authentication shell; the workspace loads after account/business selection.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import AuthShell from "../app/auth-shell";
createRoot(document.getElementById("root")).render(<AuthShell />);
