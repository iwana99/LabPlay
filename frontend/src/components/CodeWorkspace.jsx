import { useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";

export default function CodeWorkspace({ task, onFilesChange, onRun }) {
  const initial = useMemo(() => task?.starterFiles || [], [task?._id, task?.order]);
  const [files, setFiles] = useState(initial);
  const [activePath, setActivePath] = useState(initial[0]?.path || "main.js");

  useEffect(() => {
    setFiles(initial);
    setActivePath(initial[0]?.path || "main.js");
    onFilesChange(initial);
  }, [initial]);

  const active = files.find((f) => f.path === activePath) || files[0];
  const update = (content) => {
    const next = files.map((f) => f.path === active.path ? { ...f, content: content ?? "" } : f);
    setFiles(next);
    onFilesChange(next);
  };

  return (
    <div className="workspace">
      <div className="workspace-toolbar">
        <div className="tabs">{files.map((f) => <button key={f.path} className={f.path === activePath ? "active" : ""} onClick={() => setActivePath(f.path)}>{f.path}</button>)}</div>
        <button className="secondary" onClick={onRun}>Run</button>
      </div>
      <Editor
        height="100%"
        language={task?.language || "javascript"}
        value={active?.content || ""}
        onChange={update}
        theme="vs-dark"
        options={{ automaticLayout: true, minimap: { enabled: false }, fontSize: 15, scrollBeyondLastLine: false }}
      />
    </div>
  );
}
