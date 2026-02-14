import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAppStore } from "../store/appStore";
import type { FileRecord, KnowledgeBase, Topic } from "../types";

export function KBSidebar() {
  const {
    currentUser,
    knowledgeBases,
    selectedKB,
    files,
    setKnowledgeBases,
    setSelectedKB,
    setFiles,
  } = useAppStore();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [uploading, setUploading] = useState(false);
  const [clustering, setClustering] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    api.listKBs(currentUser.id).then((res) => {
      if (res.success && res.data) {
        setKnowledgeBases(res.data as KnowledgeBase[]);
      }
    });
  }, [currentUser]);

  useEffect(() => {
    if (!selectedKB) {
      setFiles([]);
      setTopics([]);
      return;
    }
    api.listFiles(selectedKB.id).then((res) => {
      if (res.success && res.data) setFiles(res.data as FileRecord[]);
    });
    api.listTopics(selectedKB.id).then((res) => {
      if (res.success && res.data) setTopics(res.data as Topic[]);
    });
  }, [selectedKB]);

  const handleCreate = async () => {
    if (!currentUser || !name.trim()) return;
    const res = await api.createKB(currentUser.id, name.trim(), description);
    if (res.success && res.data) {
      const kb = res.data as KnowledgeBase;
      setKnowledgeBases([...knowledgeBases, kb]);
      setSelectedKB(kb);
      setName("");
      setDescription("");
      setShowCreate(false);
    }
  };

  const handleUpload = async (fileList: FileList) => {
    if (!selectedKB || !currentUser) return;
    setUploading(true);
    const res = await api.uploadFiles(
      selectedKB.id,
      currentUser.id,
      Array.from(fileList)
    );
    if (res.success && res.data) {
      setFiles([...files, ...(res.data as FileRecord[])]);
    }
    setUploading(false);
  };

  const handleCluster = async () => {
    if (!selectedKB) return;
    setClustering(true);
    const res = await api.clusterKB(selectedKB.id);
    if (res.success && res.data) {
      setTopics(res.data as Topic[]);
    }
    setClustering(false);
  };

  const handleDeleteKB = async (kb: KnowledgeBase) => {
    await api.deleteKB(kb.id);
    const updated = knowledgeBases.filter((k) => k.id !== kb.id);
    setKnowledgeBases(updated);
    if (selectedKB?.id === kb.id) setSelectedKB(null);
  };

  return (
    <aside className="bg-cyber-surface/80 backdrop-blur-sm flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-cyber-cyan/20">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-orbitron text-xs font-bold text-cyber-cyan uppercase tracking-widest text-glow-cyan">
            Data Vaults
          </h2>
          <button
            className="text-xs px-2 py-1 bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40 rounded hover:bg-cyber-cyan/30 font-mono transition-all"
            onClick={() => setShowCreate(!showCreate)}
          >
            + New
          </button>
        </div>
        {showCreate && (
          <div className="space-y-2 mb-2">
            <input
              className="w-full px-2 py-1.5 bg-cyber-deep border border-cyber-cyan/30 rounded text-sm text-cyber-text font-mono focus:outline-none focus:border-cyber-cyan placeholder:text-cyber-muted"
              placeholder="// vault_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="w-full px-2 py-1.5 bg-cyber-deep border border-cyber-cyan/30 rounded text-sm text-cyber-text font-mono focus:outline-none focus:border-cyber-cyan placeholder:text-cyber-muted"
              placeholder="// description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button
              className="w-full text-sm py-1.5 bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40 rounded hover:bg-cyber-cyan/30 font-mono uppercase tracking-wider transition-all"
              onClick={handleCreate}
            >
              Initialize Vault
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {knowledgeBases.map((kb) => (
          <div
            key={kb.id}
            className={`p-2.5 rounded cursor-pointer text-sm group font-mono transition-all ${
              selectedKB?.id === kb.id
                ? "bg-cyber-cyan/15 border border-cyber-cyan/40 glow-cyan"
                : "border border-transparent hover:border-cyber-cyan/20 hover:bg-cyber-cyan/5"
            }`}
            onClick={() => setSelectedKB(kb)}
          >
            <div className="flex items-center justify-between">
              <span className="text-cyber-text truncate">{kb.name}</span>
              <button
                className="text-cyber-pink hover:text-cyber-pink opacity-0 group-hover:opacity-100 text-xs font-mono transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteKB(kb);
                }}
              >
                [DEL]
              </button>
            </div>
            {kb.description && (
              <p className="text-xs text-cyber-muted truncate mt-0.5">{kb.description}</p>
            )}
          </div>
        ))}
      </div>

      {selectedKB && (
        <div className="border-t border-cyber-cyan/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-orbitron font-bold text-cyber-green uppercase tracking-wider">
              Files ({files.length})
            </span>
            <label className="text-xs px-2 py-1 bg-cyber-green/20 text-cyber-green border border-cyber-green/40 rounded cursor-pointer hover:bg-cyber-green/30 font-mono transition-all">
              {uploading ? "Uploading..." : "Upload"}
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleUpload(e.target.files)}
              />
            </label>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {files.map((f) => (
              <div
                key={f.id}
                className="text-xs bg-cyber-deep/80 p-2 rounded border border-cyber-cyan/10 flex justify-between items-center font-mono"
              >
                <span className="truncate text-cyber-text">{f.filename}</span>
                <span className="text-cyber-muted ml-1 shrink-0">
                  {f.chunk_count}ch
                </span>
              </div>
            ))}
          </div>

          <button
            className="w-full text-xs py-1.5 bg-cyber-purple/20 text-cyber-purple border border-cyber-purple/40 rounded hover:bg-cyber-purple/30 font-mono uppercase tracking-wider disabled:opacity-30 transition-all"
            onClick={handleCluster}
            disabled={clustering || files.length === 0}
          >
            {clustering ? "Analyzing..." : "Cluster Topics"}
          </button>

          {topics.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {topics.map((t) => (
                <span
                  key={t.id}
                  className="text-xs bg-cyber-purple/15 text-cyber-purple border border-cyber-purple/30 px-2 py-0.5 rounded font-mono"
                >
                  {t.topic_label.split("_").slice(1, 3).join(" ")} ({t.doc_count})
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
