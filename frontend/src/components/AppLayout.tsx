import { useState } from "react";
import { Header } from "./Header";
import { KBSidebar } from "./KBSidebar";
import { ChatPanel } from "./ChatPanel";
import { ReplLogPanel } from "./ReplLogPanel";
import { FilePanel } from "./FilePanel";
import { SettingsPanel } from "./SettingsPanel";

type NavTab = "chat" | "files" | "logs" | "settings";

export function AppLayout() {
  const [activeTab, setActiveTab] = useState<NavTab>("chat");

  return (
    <div className="h-screen flex flex-col bg-terminal-dark crt">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        {/* Left nav */}
        <nav className="w-[200px] shrink-0 bg-terminal-bg t-border-r p-2 flex flex-col gap-1">
          <button
            className={`nav-btn ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            Communications<br />
            <span className="text-terminal-amber-dim text-[11px]">(Chat)</span>
          </button>
          <button
            className={`nav-btn ${activeTab === "files" ? "active" : ""}`}
            onClick={() => setActiveTab("files")}
          >
            Data Storage<br />
            <span className="text-terminal-amber-dim text-[11px]">(Files)</span>
          </button>
          <button
            className={`nav-btn ${activeTab === "logs" ? "active" : ""}`}
            onClick={() => setActiveTab("logs")}
          >
            System Logs<br />
            <span className="text-terminal-amber-dim text-[11px]">(View)</span>
          </button>
          <button
            className={`nav-btn ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            Settings
          </button>
        </nav>

        {/* Center content */}
        <main className="flex-1 flex flex-col overflow-hidden bg-terminal-bg">
          {activeTab === "chat" && <ChatPanel />}
          {activeTab === "files" && <KBSidebar />}
          {activeTab === "logs" && <ReplLogPanel />}
          {activeTab === "settings" && <SettingsPanel />}
        </main>

        {/* Right panel — file explorer (always visible) */}
        <aside className="w-[280px] shrink-0 bg-terminal-bg t-border flex flex-col overflow-hidden" style={{ borderLeft: '1px solid #5a5a2e' }}>
          <FilePanel />
        </aside>
      </div>

      {/* Bottom — system activity log */}
      <div className="h-[140px] shrink-0 bg-terminal-dark t-border-t overflow-hidden">
        <ReplLogPanel compact />
      </div>
    </div>
  );
}
