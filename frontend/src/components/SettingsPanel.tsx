import { useAppStore } from "../store/appStore";

export function SettingsPanel() {
  const { currentUser } = useAppStore();

  return (
    <div className="flex flex-col h-full p-3">
      <div className="mb-4">
        <span className="text-xs text-terminal-amber-bright text-glow uppercase tracking-wider">
          &gt; Terminal Settings
        </span>
      </div>

      <div className="space-y-3 text-xs font-mono">
        <div className="t-border p-3 space-y-2">
          <div className="text-terminal-amber-bright uppercase">User Profile</div>
          <div className="text-terminal-amber-dim">
            USERNAME: <span className="text-terminal-amber">{currentUser?.username?.toUpperCase() ?? "N/A"}</span>
          </div>
          <div className="text-terminal-amber-dim">
            USER_ID: <span className="text-terminal-amber">{currentUser?.id ?? "N/A"}</span>
          </div>
        </div>

        <div className="t-border p-3 space-y-2">
          <div className="text-terminal-amber-bright uppercase">System Info</div>
          <div className="text-terminal-amber-dim">
            BACKEND: <span className="text-terminal-amber">FASTAPI V0.110+</span>
          </div>
          <div className="text-terminal-amber-dim">
            VECTOR_DB: <span className="text-terminal-amber">MILVUS V2.4</span>
          </div>
          <div className="text-terminal-amber-dim">
            ENGINE: <span className="text-terminal-amber">RLM REPL V1.0</span>
          </div>
        </div>

        <div className="t-border p-3 space-y-2">
          <div className="text-terminal-amber-bright uppercase">About</div>
          <div className="text-terminal-amber-dim leading-relaxed">
            ROBCO INDUSTRIES (TM) TERMLINK PROTOCOL<br />
            RECURSIVE LANGUAGE MODEL INTERFACE<br />
            &gt; UPLOAD DOCUMENTS. BUILD KNOWLEDGE.<br />
            &gt; ASK QUESTIONS. GET ANSWERS.<br />
            &gt; THE AI WRITES CODE TO FIND YOUR DATA.
          </div>
        </div>
      </div>
    </div>
  );
}
