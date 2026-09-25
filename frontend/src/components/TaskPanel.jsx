import ProgressBar from "./ProgressBar.jsx";

export default function TaskPanel({ view, feedback, onHint, onCheck, checking }) {
  const task = view.activeTask;
  return (
    <section className="task-panel">
      <div className="lab-header">
        <div><strong>{view.lab.title}</strong><small>{view.lab.track.toUpperCase()} · v{view.lab.version}</small></div>
        <span>Zadatak {task?.order || "-"} / {view.progress.length}</span>
      </div>
      <ProgressBar progress={view.progress} />
      <h1>{task?.title}</h1>
      <div className="instructions">{task?.instructions}</div>
      {feedback?.length > 0 && <div className="feedback"><strong>Još nedostaje:</strong><ul>{feedback.map((f) => <li key={f}>{f}</li>)}</ul></div>}
      <div className="task-actions">
        <button className="secondary" onClick={onHint}>Info / hint</button>
        <button className="primary" disabled={checking} onClick={onCheck}>{checking ? "Proveravam..." : "Check"}</button>
      </div>
    </section>
  );
}
