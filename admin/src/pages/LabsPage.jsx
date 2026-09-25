import {
  useEffect,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  api,
} from "../../api.js";


function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    );
}


export default function LabsPage({
  admin,
  onLogout,
}) {
  const [labs, setLabs] =
    useState([]);

  const [
    title,
    setTitle,
  ] = useState("");

  const [
    slug,
    setSlug,
  ] = useState("");

  const [
    track,
    setTrack,
  ] = useState("backend");

  const [
    sandboxProfile,
    setSandboxProfile,
  ] = useState(
    "node-basic"
  );

  const [
    error,
    setError,
  ] = useState("");


  async function loadLabs() {
    const data =
      await api(
        "/admin/labs"
      );

    setLabs(
      data.labs
    );
  }


  useEffect(() => {
    loadLabs()
      .catch((error) => {
        setError(
          error.message
        );
      });
  }, []);


  function handleTitleChange(
    value
  ) {
    setTitle(value);

    setSlug(
      slugify(value)
    );
  }


  function handleTrackChange(
    value
  ) {
    setTrack(value);

    if (
      value === "linux"
    ) {
      setSandboxProfile(
        "linux-basic"
      );
    } else {
      setSandboxProfile(
        "node-basic"
      );
    }
  }


  async function createLab(
    event
  ) {
    event.preventDefault();

    setError("");

    try {
      await api(
        "/admin/labs",
        {
          method: "POST",

          body:
            JSON.stringify({
              title,
              slug,
              track,
              sandboxProfile,
            }),
        }
      );

      setTitle("");
      setSlug("");

      await loadLabs();

    } catch (error) {
      setError(
        error.message
      );
    }
  }


  return (
    <div className="app-shell">

      <header className="topbar">
        <div>
          <strong>
            LabPlay Admin
          </strong>

          <span className="muted">
            {" "}
            — {admin.email}
          </span>
        </div>

        <button
          className="secondary"
          onClick={
            onLogout
          }
        >
          Odjavi se
        </button>
      </header>


      <main className="content">

        <section>
          <h1>
            Labs
          </h1>

          <p className="muted">
            Lab predstavlja jednu
            grupu zadataka.
          </p>
        </section>


        <section className="panel">
          <h2>
            Novi Lab
          </h2>

          <form
            className="form-grid"
            onSubmit={
              createLab
            }
          >

            <label>
              Naziv
            </label>

            <input
              value={title}
              onChange={
                (event) =>
                  handleTitleChange(
                    event.target.value
                  )
              }
              placeholder="JavaScript Arrays"
              required
            />


            <label>
              Slug
            </label>

            <input
              value={slug}
              onChange={
                (event) =>
                  setSlug(
                    event.target.value
                  )
              }
              placeholder="javascript-arrays"
              required
            />


            <label>
              Oblast
            </label>

            <select
              value={track}
              onChange={
                (event) =>
                  handleTrackChange(
                    event.target.value
                  )
              }
            >
              <option value="backend">
                Backend / JavaScript
              </option>

              <option value="frontend">
                Frontend
              </option>

              <option value="algorithms">
                Algorithms
              </option>

              <option value="linux">
                Linux
              </option>
            </select>


            <label>
              Sandbox profil
            </label>

            <input
              value={
                sandboxProfile
              }
              onChange={
                (event) =>
                  setSandboxProfile(
                    event.target.value
                  )
              }
            />


            {track ===
              "linux" && (
              <div className="warning">
                Linux Lab možemo
                već sada unositi kao
                draft. Njegov Runner
                i checkeri su sledeća
                faza.
              </div>
            )}


            {error && (
              <div className="error-box">
                {error}
              </div>
            )}


            <button type="submit">
              Kreiraj Lab
            </button>
          </form>
        </section>


        <section className="panel">
          <h2>
            Postojeći Labs
          </h2>

          <div className="labs-list">

            {labs.map(
              (lab) => (
                <Link
                  key={
                    lab._id
                  }
                  to={`/labs/${lab._id}`}
                  className="lab-card"
                >

                  <div>
                    <strong>
                      {lab.title}
                    </strong>

                    <div className="muted small">
                      {lab.slug}
                      {" • "}
                      v{lab.version}
                    </div>
                  </div>

                  <span
                    className={
                      `status ${lab.status}`
                    }
                  >
                    {lab.status}
                  </span>

                </Link>
              )
            )}

            {!labs.length && (
              <p className="muted">
                Još nema laboratorija.
              </p>
            )}

          </div>
        </section>

      </main>
    </div>
  );
}