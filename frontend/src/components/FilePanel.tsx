import { useAppStore } from "../store/appStore";
import { api } from "../lib/api";
import type { FileRecord } from "../types";
import { useState } from "react";
import { useSound } from "../audio/useSound";

export function FilePanel() {
  const { currentUser, selectedKB, files, setFiles } = useAppStore();
  const { play } = useSound();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (fileList: FileList) => {
    if (!selectedKB || !currentUser) return;
    setUploading(true);
    play("messageSend");
    const res = await api.uploadFiles(
      selectedKB.id,
      currentUser.id,
      Array.from(fileList)
    );
    if (res.success && res.data) {
      setFiles([...files, ...(res.data as FileRecord[])]);
      play("confirm");
    }
    setUploading(false);
  };

  const handleDelete = async (fileId: string) => {
    await api.deleteFile(fileId);
    setFiles(files.filter((f) => f.id !== fileId));
    play("error");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 t-border-b">
        <span className="text-sm text-terminal-amber-bright text-glow uppercase tracking-wider">
          &gt; Data File Explorer
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {!selectedKB && (
          <p className="text-sm text-terminal-amber-dim font-mono mt-4">
            &gt; SELECT A VAULT TO VIEW FILES
          </p>
        )}
        {selectedKB && files.length === 0 && (
          <p className="text-sm text-terminal-amber-dim font-mono mt-4">
            &gt; VAULT EMPTY. UPLOAD FILES BELOW.
          </p>
        )}
        {files.map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between text-sm font-mono py-1 group hover:bg-terminal-amber-faint px-1"
          >
            <span className="text-terminal-amber truncate uppercase">
              {f.filename}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-terminal-amber-dim">{f.chunk_count}ch</span>
              <button
                className="text-terminal-amber-dim hover:text-terminal-amber opacity-0 group-hover:opacity-100"
                onClick={() => handleDelete(f.id)}
              >
                [X]
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedKB && (
        <div className="px-3 py-2 t-border-t space-y-1">
          <label className="block w-full text-sm py-1 t-border text-terminal-amber hover:bg-terminal-amber-faint font-mono cursor-pointer uppercase text-center">
            {uploading ? "Uploading..." : "[Upload File]"}
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
            />
          </label>
        </div>
      )}
    </div>
  );
}
