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
    <aside className="bg-gray-50 border-r border-gray-200 flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">
            Knowledge Bases
          </h2>
          <button
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-500"
            onClick={() => setShowCreate(!showCreate)}
          >
            + New
          </button>
        </div>
        {showCreate && (
          <div className="space-y-2 mb-2">
            <input
              className="w-full px-2 py-1 border rounded text-sm"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="w-full px-2 py-1 border rounded text-sm"
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button
              className="w-full text-sm py-1 bg-blue-600 text-white rounded hover:bg-blue-500"
              onClick={handleCreate}
            >
              Create
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {knowledgeBases.map((kb) => (
          <div
            key={kb.id}
            className={`p-2 rounded cursor-pointer text-sm group ${
              selectedKB?.id === kb.id
                ? "bg-blue-100 border border-blue-300"
                : "hover:bg-gray-100"
            }`}
            onClick={() => setSelectedKB(kb)}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium truncate">{kb.name}</span>
              <button
                className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteKB(kb);
                }}
              >
                Del
              </button>
            </div>
            {kb.description && (
              <p className="text-xs text-gray-500 truncate">{kb.description}</p>
            )}
          </div>
        ))}
      </div>

      {selectedKB && (
        <div className="border-t border-gray-200 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 uppercase">
              Files ({files.length})
            </span>
            <label className="text-xs px-2 py-1 bg-green-600 text-white rounded cursor-pointer hover:bg-green-500">
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
                className="text-xs bg-white p-1.5 rounded border flex justify-between items-center"
              >
                <span className="truncate">{f.filename}</span>
                <span className="text-gray-400 ml-1 shrink-0">
                  {f.chunk_count}ch
                </span>
              </div>
            ))}
          </div>

          <button
            className="w-full text-xs py-1 bg-purple-600 text-white rounded hover:bg-purple-500 disabled:opacity-50"
            onClick={handleCluster}
            disabled={clustering || files.length === 0}
          >
            {clustering ? "Clustering..." : "Cluster Topics"}
          </button>

          {topics.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {topics.map((t) => (
                <span
                  key={t.id}
                  className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded"
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
