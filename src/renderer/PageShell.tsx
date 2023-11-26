import "./PageShell.css";
import { ReactNode, StrictMode } from "react";

export { PageShell };

function PageShell({ children }: { children: ReactNode }) {
  return <StrictMode>{children}</StrictMode>;
}
