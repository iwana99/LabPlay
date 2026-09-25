import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  api,
} from "../../api.js";


export default function LabEditorPage() {
  const { labId } =
    useParams();

  const navigate =
  useNavigate();

  const [
    lab,
    setLab,
  ] = useState(null);

  const [
    tasks,
    setTasks,
  ] = useState([]);

  const [
    title,
    setTitle,
  ] = useState("");

  const [
    instructions,
    setInstructions,
  ] = useState("");

  const [
    taskType,
    setTaskType,
  ] = useState("code");

  const [
    starterCode,
    setStarterCode,
  ] = useState(
    'console.log("Hello LabPlay");'
  );

  const [
    expectedOutput,
    setExpectedOutput,
  ] = useState(
    "Hello LabPlay"
  );
  const [
  jsCheckerType,
  setJsCheckerType,
] = useState("stdout_equals");

  const [
    hints,
    setHints,
  ] = useState("");

  const [
    linuxChecker,
    setLinuxChecker,
  ] = useState(
    `{
  "type": "file_exists",
  "path": "/tmp/example"
}`
  );

  const [
    error,
    setError,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  const [
  editingTaskId,
  setEditingTaskId,
] = useState(null);


  async function load() {
    const data =
      await api(
        `/admin/labs/${labId}`
      );

    setLab(
      data.lab
    );

    setTasks(
      data.tasks
    );
  }


  useEffect(() => {
    load()
      .catch((error) => {
        setError(
          error.message
        );
      });
  }, [labId]);


 function startEdit(task) {
  setEditingTaskId(task._id);

  setTitle(
    task.title || ""
  );

  setInstructions(
    task.instructions || ""
  );

  setTaskType(
    task.taskType || "code"
  );

  setHints(
    Array.isArray(task.hints)
      ? task.hints.join("\n")
      : ""
  );

  if (
    task.taskType === "code"
  ) {
    const indexFile =
      task.starterFiles?.find(
        (file) =>
          file.path === "index.js"
      );

    setStarterCode(
      indexFile?.content || ""
    );

    setJsCheckerType(
      task.checker?.type ||
        "stdout_equals"
    );

    setExpectedOutput(
      String(
        task.checker?.expected ??
          ""
      )
    );
  }

  if (
    task.taskType ===
    "linux_state"
  ) {
    setLinuxChecker(
      JSON.stringify(
        task.checker || {},
        null,
        2
      )
    );
  }

  setError("");
  setMessage("");

  requestAnimationFrame(() => {
    document
      .getElementById(
        "task-editor"
      )
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  });



  /* =========================
     JAVASCRIPT TASK
  ========================= */

  if (
    task.taskType === "code"
  ) {
    const indexFile =
      task.starterFiles?.find(
        (file) =>
          file.path ===
          "index.js"
      );

    setStarterCode(
      indexFile?.content ||
        ""
    );

    setJsCheckerType(
      task.checker?.type ||
        "stdout_equals"
    );

    setExpectedOutput(
      String(
        task.checker
          ?.expected ?? ""
      )
    );
  }


  /* =========================
     LINUX TASK
  ========================= */

  if (
    task.taskType ===
    "linux_state"
  ) {
    setLinuxChecker(
      JSON.stringify(
        task.checker || {},
        null,
        2
      )
    );
  }


  setError("");
  setMessage("");
}
async function removeTask(
  task
) {
  const confirmed =
    window.confirm(
      `Da li sigurno želiš da obrišeš zadatak "${task.title}"?`
    );

  if (!confirmed) {
    return;
  }

  setError("");
  setMessage("");

  try {
    await api(
      `/admin/labs/${labId}/tasks/${task._id}`,
      {
        method:
          "DELETE",
      }
    );


    /*
      Ako upravo uređujemo
      task koji smo obrisali,
      očisti formu.
    */

    if (
      editingTaskId ===
      task._id
    ) {
      setEditingTaskId(
        null
      );

      setTitle("");
      setInstructions("");
      setHints("");
    }


    setMessage(
      "Zadatak je obrisan."
    );

    await load();

  } catch (error) {
    setError(
      error.message
    );
  }
}

  async function addTask(
    event
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (instructions.trim().length < 3) {
    setError(
      "Instrukcije moraju imati najmanje 3 karaktera."
    );
    return;
  }

    try {
      let checker;

      let starterFiles =
        [];

      let language =
        "javascript";


      if (
        taskType === "code"
      ) {
        checker = {
          type:
            jsCheckerType,

          expected:
            expectedOutput,
        };

        starterFiles = [
          {
            path:
              "index.js",

            content:
              starterCode,

            readOnly:
              false,
          },
        ];

      } else {
        checker =
          JSON.parse(
            linuxChecker
          );

        language =
          "shell";
      }

      const payload = {
  title,

  instructions,

  taskType,

  starterFiles,

  language,

  hints:
    hints
      .split("\n")
      .map(
        (item) =>
          item.trim()
      )
      .filter(Boolean),

  checker,

  resourceLimits: {
    cpuMillis:
      1000,

    memoryMb:
      256,

    timeoutMs:
      10000,

    network:
      false,
  },
};
    const wasEditing =
  Boolean(
    editingTaskId
  );


const url =
  wasEditing
    ? `/admin/labs/${labId}/tasks/${editingTaskId}`
    : `/admin/labs/${labId}/tasks`;


const method =
  wasEditing
    ? "PUT"
    : "POST";


await api(
  url,
  {
    method,

    body:
      JSON.stringify(
        payload
      ),
  }
);


    setEditingTaskId(
  null
);

setTitle("");
setInstructions("");
setHints("");

setMessage(
  wasEditing
    ? "Zadatak je izmenjen."
    : "Zadatak je dodat."
);

await load();

    } catch (error) {
      setError(
        error.message
      );
    }
  }

async function createNewVersion() {

    console.log(
    "[CREATE VERSION] klik",
    {
      labId,
    }
  );
  setError("");
  setMessage("");

  try {
    const data =
      await api(
        `/admin/labs/${labId}/versions`,
        {
          method: "POST",
          body: "{}",
        }
      );


    setMessage(
      `Kreirana je verzija v${data.lab.version}.`
    );


    /*
      Prebacujemo admina direktno
      na NOVI draft.
    */

    navigate(
      `/labs/${data.lab._id}`
    );

  } catch (error) {
    setError(
      error.message
    );
  }
}
  async function publish() {
    setError("");
    setMessage("");

    try {
      const data =
        await api(
          `/admin/labs/${labId}/publish`,
          {
            method:
              "POST",
          }
        );

      setLab(
        data.lab
      );

      setMessage(
        "Lab je objavljen."
      );

    } catch (error) {
      setError(
        error.message
      );
    }
  }


  if (!lab) {
    return (
      <div className="center-page">
        Učitavanje...
      </div>
    );
  }


  const editable =
    lab.status ===
    "draft";

const canCreateVersion =
  lab.status === "published" ||
  lab.status === "archived";

  return (
    <div className="app-shell">

      <header className="topbar">

        <Link
          to="/labs"
          className="back-link"
        >
          ← Labs
        </Link>

        <strong>
          LabPlay Admin
        </strong>

      </header>


      <main className="content">

        <section className="panel">

          <div className="lab-heading">

            <div>
              <h1>
                {lab.title}
              </h1>

              <p className="muted">
                slug:
                {" "}
                <code>
                  {lab.slug}
                </code>
              </p>

              <p className="muted">
                verzija:
                {" "}
                {lab.version}
                {" • "}
                {lab.track}
                {" • "}
                {lab.sandboxProfile}
              </p>
            </div>

            <span
              className={
                `status ${lab.status}`
              }
            >
              {lab.status}
            </span>

          </div>

        </section>
       {canCreateVersion && (
  <section className="panel">

    <h2>
      Nova verzija
    </h2>

    <p className="muted">
      Objavljena verzija se više
      ne menja direktno.
      Napravi novu draft verziju
      ako želiš da menjaš zadatke.
    </p>

    <button
      onClick={
        createNewVersion
      }
    >
      Create new version
    </button>

  </section>
)}

        <section className="panel">

          <h2>
            Zadaci
          </h2>

          {tasks.map(
            (task) => (
              <article
  className="task-card"
  key={task._id}
>
  <div className="task-order">
    {task.order}
  </div>


  <div>
    <strong>
      {task.title}
    </strong>

    <p>
      {task.instructions}
    </p>

    <span className="muted small">
      {task.taskType}
    </span>


    {editable && (
  <div
    style={{
      marginTop: "12px",
      display: "flex",
      gap: "10px",
    }}
  >
    <button
      type="button"
      onClick={() =>
        startEdit(task)
      }
    >
      Edit
    </button>

    <button
      type="button"
      onClick={() =>
        removeTask(task)
      }
    >
      Delete
    </button>
  </div>
)}

  </div>
</article>
            )
          )}

          {!tasks.length && (
            <p className="muted">
              Lab još nema zadatke.
            </p>
          )}

        </section>


        {editable && (
          <section className="panel">

                    <h2>
            {editingTaskId
              ? "Izmeni zadatak"
              : "Dodaj zadatak"}
          </h2>
                      <form
              className="form-grid"
              onSubmit={
                addTask
              }
            >

              <label>
                Naslov zadatka
              </label>

              <input
                value={title}
                onChange={
                  (event) =>
                    setTitle(
                      event.target.value
                    )
                }
                required
              />


              <label>
                Instrukcije
              </label>

              <textarea
                rows="6"
                value={
                  instructions
                }
                onChange={
                  (event) =>
                    setInstructions(
                      event.target.value
                    )
                }
                required
              />


              <label>
                Tip zadatka
              </label>

              <select
                value={
                  taskType
                }
                onChange={
                  (event) =>
                    setTaskType(
                      event.target.value
                    )
                }
              >
                <option value="code">
                  JavaScript code
                </option>

                <option value="linux_state">
                  Linux state
                </option>

                <option value="frontend_project">
                  Frontend project
                </option>

                <option value="backend_project">
                  Backend project
                </option>
              </select>


              {taskType ===
                "code" ? (
                <>
                <label>
                  Checker
                </label>

                    <select
                      value={jsCheckerType}
                      onChange={
                        (event) =>
                          setJsCheckerType(
                            event.target.value
                          )
                      }
                    >
                      <option value="stdout_equals">
                        stdout_equals
                      </option>
                    </select>
                  <label>
                    Starter index.js
                  </label>

                  <textarea
                    className="code-area"
                    rows="8"
                    value={
                      starterCode
                    }
                    onChange={
                      (event) =>
                        setStarterCode(
                          event.target.value
                        )
                    }
                  />

                  <label>
                    Očekivani output
                  </label>

                  <textarea
                    rows="3"
                    value={
                      expectedOutput
                    }
                    onChange={
                      (event) =>
                        setExpectedOutput(
                          event.target.value
                        )
                    }
                  />
                </>
              ) : (
                <>
                  

                  <label>
                    Checker JSON
                  </label>

                  <textarea
                    className="code-area"
                    rows="8"
                    value={
                      linuxChecker
                    }
                    onChange={
                      (event) =>
                        setLinuxChecker(
                          event.target.value
                        )
                    }
                  />
                </>
              )}


              <label>
                Hintovi
              </label>

              <textarea
                rows="4"
                value={hints}
                onChange={
                  (event) =>
                    setHints(
                      event.target.value
                    )
                }
                placeholder={
                  "Jedan hint po redu"
                }
              />

                  <button type="submit">
                    {editingTaskId
                      ? "Sačuvaj izmene"
                      : "Dodaj zadatak"}
                  </button>

            </form>
          </section>
        )}


        {editable && (
          <section className="panel danger-panel"  id="task-editor">

            <h2>
              Publish
            </h2>

            <p>
              Kada objaviš Lab,
              ova verzija više
              neće biti menjana.
            </p>

            <button
              onClick={
                publish
              }
            >
              Objavi Lab
            </button>

          </section>
        )}


        {message && (
          <div className="success-box">
            {message}
          </div>
        )}

        {error && (
          <div className="error-box">
            {error}
          </div>
        )}

      </main>
    </div>
  );
}