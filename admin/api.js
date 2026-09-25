const API_URL =
  import.meta.env
    .VITE_API_URL ||
  "http://localhost:4000/api/v1";


export async function api(
  path,
  options = {}
) {
  const response =
    await fetch(
      `${API_URL}${path}`,
      {
        ...options,

        credentials:
          "include",

        headers: {
          "Content-Type":
            "application/json",

          ...(options.headers ||
            {}),
        },
      }
    );


  if (
    response.status === 204
  ) {
    return null;
  }


  const data =
    await response
      .json()
      .catch(() => ({}));


  if (!response.ok) {
    const error =
      new Error(
        data.message ||
          "Request failed"
      );

    error.status =
      response.status;

    throw error;
  }


  return data;
}