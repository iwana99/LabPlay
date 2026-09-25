import {
  useState,
} from "react";

import {
  api,
} from "../../api.js";


export default function LoginPage({
  onLogin,
}) {
  const [email, setEmail] =
    useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);


  async function submit(event) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const data =
        await api(
          "/admin/auth/login",
          {
            method: "POST",

            body:
              JSON.stringify({
                email,
                password,
              }),
          }
        );

      onLogin(
        data.admin
      );

    } catch (error) {
      setError(
        error.message
      );
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="center-page">
      <form
        className="login-card"
        onSubmit={submit}
      >
        <div className="logo">
          LabPlay
        </div>

        <h1>
          Admin
        </h1>

        <p className="muted">
          Upravljanje laboratorijama
          i zadacima
        </p>

        <label>
          Email
        </label>

        <input
          type="email"
          value={email}
          onChange={
            (event) =>
              setEmail(
                event.target.value
              )
          }
          required
        />

        <label>
          Lozinka
        </label>

        <input
          type="password"
          value={password}
          onChange={
            (event) =>
              setPassword(
                event.target.value
              )
          }
          required
        />

        {error && (
          <div className="error-box">
            {error}
          </div>
        )}

        <button
          disabled={loading}
          type="submit"
        >
          {loading
            ? "Prijavljivanje..."
            : "Prijavi se"}
        </button>
      </form>
    </div>
  );
}