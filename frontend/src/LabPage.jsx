import { useEffect, useRef, useState } from "react";
import { api } from "./lib/api.js";
import { useLabSession } from "./store/useLabSession.js";
import TaskPanel from "./components/TaskPanel.jsx";
import CodeWorkspace from "./components/CodeWorkspace.jsx";
import LinuxTerminal from "./components/LinuxTerminal.jsx";
import OutputPanel from "./components/OutputPanel.jsx";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function LabPage() {
  const { view, loading, error, refresh } = useLabSession();
  const filesRef = useRef([]);
  const [feedback, setFeedback] = useState([]);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("");
  const [checking, setChecking] = useState(false);
  const [systemError, setSystemError] = useState("");

  useEffect(() => { setFeedback([]); setOutput(""); setStatus(""); }, [view?.activeTask?._id, view?.activeTask?.order]);

  const onCheck = async () => {
  setChecking(true);
  setSystemError("");

  try {
    await submit("check");
  } catch (err) {
    console.error(err);

    setSystemError(
      "Provera trenutno nije uspela zbog tehničke greške. Pokušaj ponovo."
    );
  } finally {
    setChecking(false);
  }
};
const onRun = async () => {
  setSystemError("");

  try {
    await submit("run");
  } catch (err) {
    console.error(err);

    setSystemError(
      "Pokretanje koda trenutno nije uspelo. Pokušaj ponovo."
    );
  }
};
  const waitForSubmission = async (id) => {
    for (let i = 0; i < 120; i += 1) {
      const result = await api(`/submissions/${id}`);
      if (!["queued", "running"].includes(result.status)) return result;
      await sleep(500);
    }
    throw new Error("Provera traje predugo. Pokušaj ponovo.");
  };

  const submit = async (mode) => {
    const submissionFiles = filesRef.current.map((file) => ({
  path: file.path,
  content: file.content,
}));

const started = await api("/submissions", {
  method: "POST",
  body: JSON.stringify({
    taskId: view.activeTask._id,
    mode,
    files: submissionFiles,
  }),
});
    const result = await waitForSubmission(started.id);
    setStatus(result.status);
    setOutput(result.output || "");
    setFeedback(result.feedback || []);
    if (mode === "check" && result.status === "passed") {
      await refresh(); // server advances to the next task; UI follows authoritative state.
    }
  };


  const onHint = async () => {
    try {
      const hint = await api(`/attempts/current/tasks/${view.activeTask._id}/hint`, { method: "POST", body: JSON.stringify({ level: 1 }) });
      setFeedback([`Hint: ${hint.hint}`]);
    } catch (err) { setFeedback([err.message]); }
  };
  const finish = async () => {
    const result = await api("/attempts/current/finish", { method: "POST", body: "{}" });
    window.location.assign(result.returnUrl);
  };

  if (loading) return <main className="center">Učitavanje laboratorije…</main>;
  if (error) return <main className="center error">{error}</main>;
  if (!view) return null;

  const done = view.attempt.status === "completing" || view.progress.every((p) => p.status === "passed");
  if (done) return <main className="center"><div><h1>Uspešno završeno 🎉</h1><p>Svi zadaci su prošli proveru.</p><button className="primary" onClick={finish}>Završi i vrati me na školu</button></div></main>;

  const linux = view.lab.track === "linux";
  return (
    <main className="lab-shell">

    
      <TaskPanel view={view} feedback={feedback} onHint={onHint} onCheck={onCheck} checking={checking} />
      <section className="work-panel">
        {linux ? (
  <LinuxTerminal
    key={view.attempt.id}
    attemptId={view.attempt.id}
  />
) : (
  <CodeWorkspace
    task={view.activeTask}
    onFilesChange={(f) => {
      filesRef.current = f;
    }}
    onRun={onRun}
  />
)}
        {!linux && <OutputPanel output={output} status={status} />}
      </section>
      <section >
        {systemError && (
  <div className="error">
    {systemError}
  </div>
)}
</section>
    </main>
  );
}
