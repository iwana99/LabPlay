export default function ProgressBar({ progress = [] }) {
  return (
    <div className="progress" aria-label="Napredak kroz zadatke">
      {progress.map((item) => <span key={item.order} className={`dot ${item.status}`} title={`Zadatak ${item.order}: ${item.status}`} />)}
    </div>
  );
}
