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
    <div className="flex flex-col h-full p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-terminal-amber-bright text-glow uppercase tracking-wider">
          &gt; Data Storage Vaults
        </span>
        <button
          className="text-sm px-2 py-1 t-border text-terminal-amber hover:bg-terminal-amber-faint font-mono uppercase"
          onClick={() => setShowCreate(!showCreate)}
        >
          [+ New Vault]
        </button>
      </div>

      {showCreate && (
        <div className="space-y-2 t-border p-2">
          <input
            className="w-full px-2 py-1 bg-terminal-dark text-terminal-amber text-sm font-mono t-border outline-none focus:border-terminal-amber"
            placeholder="VAULT NAME"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="w-full px-2 py-1 bg-terminal-dark text-terminal-amber text-sm font-mono t-border outline-none focus:border-terminal-amber"
            placeholder="DESCRIPTION (OPTIONAL)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            className="w-full text-sm py-1 t-border text-terminal-amber hover:bg-terminal-amber-faint font-mono uppercase"
            onClick={handleCreate}
          >
            [Initialize Vault]
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-1">
        {knowledgeBases.length === 0 && (
          <p className="text-sm text-terminal-amber-dim text-center mt-4">
            &gt; NO VAULTS FOUND. CREATE ONE TO BEGIN.
          </p>
        )}
        {knowledgeBases.map((kb) => {
          const isSelected = selectedKB?.id === kb.id;
          return (
            <div
              key={kb.id}
              className={`p-2 cursor-pointer text-sm font-mono group t-border ${
                isSelected
                  ? "bg-terminal-amber-faint border-terminal-amber text-glow"
                  : "hover:bg-terminal-amber-faint"
              }`}
              onClick={() => setSelectedKB(kb)}
            >
              <div className="flex items-center justify-between">
                <span className="uppercase">{kb.name}</span>
                <button
                  className="text-terminal-amber-dim hover:text-terminal-amber opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteKB(kb);
                  }}
                >
                  [DEL]
                </button>
              </div>
              {kb.description && (
                <p className="text-terminal-amber-dim truncate mt-0.5">{kb.description}</p>
              )}
              {isSelected && (
                <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                  <div className="text-terminal-amber-dim">
                    FILES: {files.length} | CHUNKS: {files.reduce((s, f) => s + f.chunk_count, 0)}
                  </div>

                  <button
                    className="w-full text-sm py-1 t-border text-terminal-amber hover:bg-terminal-amber-faint font-mono uppercase disabled:opacity-30"
                    onClick={handleCluster}
                    disabled={clustering || files.length === 0}
                  >
                    {clustering ? "Analyzing..." : "[Cluster Topics]"}
                  </button>

                  {topics.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {topics.map((t) => (
                        <span
                          key={t.id}
                          className="text-sm font-mono bg-terminal-dark text-terminal-amber-bright px-1.5 py-0.5 t-border"
                        >
                          {t.topic_label} ({t.doc_count})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
