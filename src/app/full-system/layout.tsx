import SessionRefresh from "./components/session-refresh";
import WorkspaceNavigation from "./components/workspace-navigation";
export default function FullSystemLayout({ children }: { children: React.ReactNode }) {
  return <><SessionRefresh /><WorkspaceNavigation /><div id="workspace-content" tabIndex={-1}>{children}</div></>;
}
