import "dotenv/config";

import http from "node:http";

import {
  jwtVerify,
} from "jose";

import {
  WebSocket,
  WebSocketServer,
} from "ws";


const PORT =
  Number(
    process.env.TERMINAL_GATEWAY_PORT ||
      4080
  );

const TERMINAL_TICKET_SECRET =
  process.env.TERMINAL_TICKET_SECRET;

const RUNNER_TERMINAL_WS_BASE =
  process.env.RUNNER_TERMINAL_WS_BASE;

const RUNNER_API_TOKEN =
  process.env.RUNNER_API_TOKEN;


if (
  !TERMINAL_TICKET_SECRET ||
  !RUNNER_TERMINAL_WS_BASE ||
  !RUNNER_API_TOKEN
) {
  throw new Error(
    "Terminal Gateway env configuration is incomplete"
  );
}


const secret =
  new TextEncoder().encode(
    TERMINAL_TICKET_SECRET
  );


const server =
  http.createServer(
    (req, res) => {
      res.writeHead(
        200,
        {
          "Content-Type":
            "application/json",
        }
      );

      res.end(
        JSON.stringify({
          ok: true,
          service:
            "labplay-terminal-gateway",
        })
      );
    }
  );


const wss =
  new WebSocketServer({
    noServer: true,
    maxPayload: 64 * 1024,
  });


server.on(
  "upgrade",
  async (req, socket, head) => {
    try {
      const url =
        new URL(
          req.url,
          "http://gateway.local"
        );

      const ticket =
        url.searchParams.get(
          "ticket"
        );

      if (!ticket) {
        throw new Error(
          "Terminal ticket is required"
        );
      }


      const { payload } =
        await jwtVerify(
          ticket,
          secret,
          {
            algorithms: [
              "HS256",
            ],

            issuer:
              "skilllab",

            audience:
              "skilllab-terminal-gateway",
          }
        );


      if (
        payload.kind !==
          "terminal" ||
        !payload.sandboxId
      ) {
        throw new Error(
          "Invalid terminal ticket"
        );
      }


      req.sandboxId =
        String(
          payload.sandboxId
        );


      wss.handleUpgrade(
        req,
        socket,
        head,
        (ws) => {
          wss.emit(
            "connection",
            ws,
            req
          );
        }
      );

    } catch (error) {
      console.error(
        "Terminal ticket rejected:",
        error.message
      );

      socket.write(
        "HTTP/1.1 401 Unauthorized\r\n" +
        "Connection: close\r\n\r\n"
      );

      socket.destroy();
    }
  }
);


wss.on(
  "connection",
  (client, req) => {
    const runnerUrl =
      `${RUNNER_TERMINAL_WS_BASE}` +
      `/v1/sandboxes/` +
      `${encodeURIComponent(
        req.sandboxId
      )}` +
      `/terminal`;


    const upstream =
      new WebSocket(
        runnerUrl,
        {
          headers: {
            Authorization:
              `Bearer ${RUNNER_API_TOKEN}`,
          },
        }
      );


    upstream.on(
      "open",
      () => {
        console.log(
          `Terminal connected to sandbox ${req.sandboxId}`
        );
      }
    );


    client.on(
      "message",
      (data) => {
        if (
          upstream.readyState ===
          WebSocket.OPEN
        ) {
          upstream.send(
            data
          );
        }
      }
    );


    upstream.on(
      "message",
      (data) => {
        if (
          client.readyState ===
          WebSocket.OPEN
        ) {
          client.send(
            data
          );
        }
      }
    );


    const closeBoth =
      () => {
        if (
          client.readyState ===
            WebSocket.OPEN ||
          client.readyState ===
            WebSocket.CONNECTING
        ) {
          client.close();
        }

        if (
          upstream.readyState ===
            WebSocket.OPEN ||
          upstream.readyState ===
            WebSocket.CONNECTING
        ) {
          upstream.close();
        }
      };


    client.on(
      "close",
      closeBoth
    );

    upstream.on(
      "close",
      closeBoth
    );


    upstream.on(
      "error",
      (error) => {
        console.error(
          "Runner terminal connection error:",
          error.message
        );

        closeBoth();
      }
    );
  }
);


server.listen(
  PORT,
  () => {
    console.log(
      `Terminal Gateway listening on http://localhost:${PORT}`
    );
  }
);