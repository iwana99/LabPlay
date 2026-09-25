import {
  useEffect,
  useRef
} from "react";

import {
  useNavigate,
  useSearchParams
} from "react-router-dom";

import {
  useLaunch
} from "../src/store/useLaunch.js";


export default function LaunchPage() {

  const [params] = useSearchParams();

  const navigate = useNavigate();

  const exchangeStartedRef = useRef(false);


  const {exchangeLaunch, loading, error} = useLaunch();


  useEffect(() => {

    if (exchangeStartedRef.current) {return;}

    exchangeStartedRef.current = true;


    const code = params.get("code");


    if (!code) {return;}


    async function start() {

      const success =await exchangeLaunch(code);


      if (!success) {
        return;
      }


      window.history.replaceState({},"","/lab");


      navigate("/lab",{replace: true});}


    start();

  }, [
    params,
    navigate,
    exchangeLaunch
  ]);


  return (
    <main className="center">
      <div>

        <h1>
          {loading
            ? "Pripremamo tvoju laboratoriju…"
            : "Pokretanje laboratorije"}
        </h1>

        {error && (
          <p className="error">
            {error}
          </p>
        )}

      </div>
    </main>
  );
}