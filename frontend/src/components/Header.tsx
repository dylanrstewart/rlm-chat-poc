import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAppStore } from "../store/appStore";
import type { User } from "../types";

export function Header() {
  const { currentUser, users, setCurrentUser, setUsers } = useAppStore();
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
    }
  };

  return (
    <header className="bg-cyber-surface border-b border-cyber-cyan/30 px-5 py-3 flex items-center justify-between relative">
      {/* Bottom gradient accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-cyber-cyan via-cyber-pink to-cyber-purple" />

      <h1 className="font-orbitron text-lg font-bold tracking-widest text-cyber-cyan text-glow-cyan uppercase">
        RLM Chat
      </h1>

      <div className="flex items-center gap-3">
        {showCreate ? (
          <div className="flex items-center gap-2">
            <input
              className="px-3 py-1.5 rounded bg-cyber-deep text-cyber-text text-sm border border-cyber-cyan/40 focus:border-cyber-cyan focus:outline-none glow-cyan font-mono placeholder:text-cyber-muted"
              placeholder="// enter_username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateUser()}
            />
            <button
              className="text-sm px-3 py-1.5 bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/50 rounded hover:bg-cyber-cyan/30 font-mono uppercase tracking-wider transition-all"
              onClick={handleCreateUser}
            >
              Create
            </button>
            <button
              className="text-sm px-3 py-1.5 bg-cyber-pink/10 text-cyber-pink border border-cyber-pink/30 rounded hover:bg-cyber-pink/20 font-mono uppercase tracking-wider transition-all"
              onClick={() => setShowCreate(false)}
            >
              Abort
            </button>
          </div>
        ) : (
          <>
            <select
              className="bg-cyber-deep text-cyber-text text-sm px-3 py-1.5 rounded border border-cyber-cyan/30 focus:border-cyber-cyan focus:outline-none font-mono cursor-pointer"
              value={currentUser?.id ?? ""}
              onChange={(e) => {
                const user = users.find((u) => u.id === e.target.value);
                setCurrentUser(user ?? null);
              }}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username}
                </option>
              ))}
            </select>
            <button
              className="text-sm px-3 py-1.5 border border-cyber-cyan/30 text-cyber-cyan rounded hover:bg-cyber-cyan/10 hover:border-cyber-cyan font-mono uppercase tracking-wider transition-all"
              onClick={() => setShowCreate(true)}
            >
              + User
            </button>
          </>
        )}
      </div>
    </header>
  );
}
