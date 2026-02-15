import { useAppStore } from "../store/appStore";
import { useSound } from "../audio/useSound";
import { soundEngine } from "../audio/soundEngine";

export function SettingsPanel() {
  const { currentUser } = useAppStore();
  const { play, muted, setMuted } = useSound();

  return (
    <div className="flex flex-col h-full p-3">
      <div className="mb-4">
        <span className="text-sm text-terminal-amber-bright text-glow uppercase tracking-wider">
          &gt; Terminal Settings
        </span>
      </div>

      <div className="space-y-3 text-sm font-mono">
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
          <div className="text-terminal-amber-bright uppercase">Audio</div>
          <div className="flex items-center gap-3">
            <span className="text-terminal-amber-dim">TERMINAL_AUDIO:</span>
            <button
              className="px-2 py-0.5 t-border text-terminal-amber hover:bg-terminal-amber-faint uppercase"
              onClick={() => {
                const wasMuted = muted;
                setMuted(!muted);
                if (wasMuted) soundEngine.play("confirm");
              }}
            >
              [{muted ? "DISABLED" : "ENABLED"}]
            </button>
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
