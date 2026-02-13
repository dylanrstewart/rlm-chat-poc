import { Header } from "./Header";
import { KBSidebar } from "./KBSidebar";
import { ChatPanel } from "./ChatPanel";
import { ReplLogPanel } from "./ReplLogPanel";

export function AppLayout() {
  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 grid grid-cols-[260px_1fr_320px] overflow-hidden">
        <KBSidebar />
        <ChatPanel />
        <ReplLogPanel />
      </div>
    </div>
  );
}
