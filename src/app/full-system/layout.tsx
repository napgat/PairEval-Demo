import SessionRefresh from "./components/session-refresh";
export default function FullSystemLayout({ children }: { children: React.ReactNode }) {
  return <><SessionRefresh />{children}</>;
}
