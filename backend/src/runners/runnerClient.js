import {
  env,
} from "../config/env.js";


async function request(
  path,
  body,
  {
    timeoutMs = 15000,
  } = {}
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      timeoutMs
    );

  try {
    const response =
      await fetch(
        `${env.RUNNER_BASE_URL}${path}`,
        {
          method: "POST",

          headers: {
            "content-type":
              "application/json",

            authorization:
              `Bearer ${env.RUNNER_API_TOKEN}`,
          },

          body:
            JSON.stringify(
              body
            ),

          signal:
            controller.signal,
        }
      );


    if (!response.ok) {
      throw new Error(
        `Runner returned ${response.status}`
      );
    }


    /*
      204 = uspeh, ali nema JSON body.

      Ovo je upravo ono što destroy
      endpoint vraća.
    */

    if (
      response.status === 204
    ) {
      return null;
    }


    /*
      Ostali endpointi, kao provision
      i grade, vraćaju JSON.
    */

    return await response.json();

  } finally {
    clearTimeout(
      timeout
    );
  }
}


export const RunnerClient = {

  provision(payload) {
    return request(
      "/v1/sandboxes",
      payload,
      {
        timeoutMs:
          60000,
      }
    );
  },


  grade(payload) {
    return request(
      "/v1/grade",
      payload,
      {
        timeoutMs:
          Math.max(
            15000,
            payload
              .resourceLimits
              ?.timeoutMs +
              5000
          ),
      }
    );
  },


  destroy(payload) {
    return request(
      "/v1/sandboxes/destroy",
      payload,
      {
        timeoutMs:
          30000,
      }
    );
  },
};