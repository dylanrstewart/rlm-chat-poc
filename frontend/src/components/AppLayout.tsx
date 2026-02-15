import { Header } from "./Header";
import { KBSidebar } from "./KBSidebar";
import { ChatPanel } from "./ChatPanel";
import { ReplLogPanel } from "./ReplLogPanel";

export function AppLayout() {
  return (
    <div className="h-screen flex flex-col bg-cyber-deep scanlines relative">
      <Header />
      <div className="flex-1 grid grid-cols-[280px_1fr_340px] overflow-hidden gap-[1px] bg-cyber-cyan/10">
        <KBSidebar />
        <ChatPanel />
        <ReplLogPanel />
      </div>
    </div>
  );
}
