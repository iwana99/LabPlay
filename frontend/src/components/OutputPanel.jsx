export default function OutputPanel({ output, status }) {
  return <div className="output-panel"><strong>Output {status ? `· ${status}` : ""}</strong><pre>{output || "Pokreni kod ili pritisni Check."}</pre></div>;
}
