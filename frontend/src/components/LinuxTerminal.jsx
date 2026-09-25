import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { api } from "../lib/api.js";

export default function LinuxTerminal() {
  const host = useRef(null);

  useEffect(() => {
    let socket;
    const term = new Terminal({ cursorBlink: true, convertEol: true, fontSize: 14 });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host.current);
    fit.fit();

          (async () => {
            try {
              const response =await api.post( "/attempts/current/terminal-ticket",
          {}
        );

          const {
            ticket,
            gatewayUrl
          } = response.data;
        socket = new WebSocket(`${gatewayUrl}?ticket=${encodeURIComponent(ticket)}`);
        socket.binaryType = "arraybuffer";
        socket.onmessage = (event) => term.write(typeof event.data === "string" ? event.data : new Uint8Array(event.data));
        socket.onopen = () => term.onData((data) => socket?.readyState === WebSocket.OPEN && socket.send(data));
        socket.onclose = () => term.write("\r\n[terminal connection closed]\r\n");
      } catch (err) {
        term.write(`\r\n[terminal unavailable: ${err.message}]\r\n`);
      }
    })();

    const onResize = () => fit.fit();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      socket?.close();
      term.dispose();
    };
  }, []);

  return <div ref={host} className="terminal-host" />;
}
