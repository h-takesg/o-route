import React from "react";
import "./PageShell.css";

export { PageShell };

function PageShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <React.StrictMode>
      {children}
    </React.StrictMode>
  );
}
