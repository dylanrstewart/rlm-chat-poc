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
    <header className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
      <h1 className="text-lg font-semibold">RLM Chat POC</h1>
      <div className="flex items-center gap-3">
        {showCreate ? (
          <div className="flex items-center gap-2">
            <input
              className="px-2 py-1 rounded bg-gray-800 text-white text-sm border border-gray-700"
              placeholder="Username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateUser()}
            />
            <button
              className="text-sm px-2 py-1 bg-blue-600 rounded hover:bg-blue-500"
              onClick={handleCreateUser}
            >
              Create
            </button>
            <button
              className="text-sm px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <select
              className="bg-gray-800 text-white text-sm px-2 py-1 rounded border border-gray-700"
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
              className="text-sm px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
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
