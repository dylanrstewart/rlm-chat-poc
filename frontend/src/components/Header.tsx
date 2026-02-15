import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAppStore } from "../store/appStore";
import type { User } from "../types";
import { useSound } from "../audio/useSound";

export function Header() {
  const { currentUser, users, setCurrentUser, setUsers } = useAppStore();
  const { play } = useSound();
  const [newUsername, setNewUsername] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    api.listUsers().then((res) => {
      if (res.success && res.data) {
        setUsers(res.data as User[]);
        if (res.data.length > 0 && !currentUser) {
          setCurrentUser(res.data[0] as User);
        }
      }
    });
  }, []);

  const handleCreateUser = async () => {
    if (!newUsername.trim()) return;
    const res = await api.createUser(newUsername.trim());
    if (res.success && res.data) {
      const user = res.data as User;
      setUsers([...users, user]);
      setCurrentUser(user);
      setNewUsername("");
      setShowCreate(false);
      play("confirm");
    }
  };

  return (
    <header className="bg-terminal-dark t-border-b px-4 py-2 flex items-center justify-between">
      <h1 className="text-base uppercase tracking-[3px] text-terminal-amber-bright text-glow font-mono">
        RobCo Unified Operating System V.2201 — RLM Terminal
      </h1>
      <div className="flex items-center gap-3">
        {showCreate ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-terminal-amber-dim">&gt;</span>
            <input
              className="px-2 py-1 bg-terminal-dark text-terminal-amber text-sm font-mono t-border outline-none focus:border-terminal-amber"
              placeholder="ENTER USERNAME"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateUser()}
              autoFocus
            />
            <button
              className="text-sm px-2 py-1 t-border text-terminal-amber hover:bg-terminal-amber-faint font-mono uppercase"
              onClick={handleCreateUser}
            >
              [Create]
            </button>
            <button
              className="text-sm px-2 py-1 t-border text-terminal-amber-dim hover:bg-terminal-amber-faint font-mono uppercase"
              onClick={() => setShowCreate(false)}
            >
              [Cancel]
            </button>
          </div>
        ) : (
          <>
            <select
              className="bg-terminal-dark text-terminal-amber text-sm px-2 py-1 font-mono t-border outline-none cursor-pointer"
              value={currentUser?.id ?? ""}
              onChange={(e) => {
                const user = users.find((u) => u.id === e.target.value);
                setCurrentUser(user ?? null);
                play("tabClick");
              }}
            >
              {users.length === 0 && <option value="">NO USERS</option>}
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username.toUpperCase()}
                </option>
              ))}
            </select>
            <button
              className="text-sm px-2 py-1 t-border text-terminal-amber hover:bg-terminal-amber-faint font-mono uppercase"
              onClick={() => setShowCreate(true)}
            >
              [+ User]
            </button>
          </>
        )}
      </div>
    </header>
  );
}
