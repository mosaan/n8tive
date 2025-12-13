// Simple stdio-based MCP handshake test for electron-mcp-server.
// Spawns the PowerShell wrapper so required env vars are injected,
// then sends initialize -> list_tools and prints responses.
import { spawn } from "node:child_process";
import path from "node:path";

const scriptPath = path.join("scripts", "run-electron-mcp-server.ps1");

const child = spawn(
  "powershell",
  ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
  { shell: true }
);

function send(msg) {
  child.stdin.write(JSON.stringify(msg) + "\n");
}

let initialized = false;
let listed = false;

child.stdout.on("data", (buf) => {
  const text = buf.toString();
  // Server writes both JSON-RPC and log lines; parse line-by-line.
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      console.log("<<", msg);
      if (msg.id === 1 && msg.result && !initialized) {
        initialized = true;
        // Request available tools
        send({
          jsonrpc: "2.0",
          id: 2,
          method: "list_tools",
          params: {},
        });
      } else if (msg.id === 2 && msg.result && !listed) {
        listed = true;
        console.log("Tools:", msg.result?.tools);
        // Done; terminate child
        child.kill("SIGTERM");
      }
    } catch (e) {
      // Non-JSON log line; print for visibility.
      console.log("log:", line);
    }
  }
});

child.stderr.on("data", (buf) => {
  console.error("stderr:", buf.toString());
});

child.on("exit", (code, signal) => {
  console.log(`electron-mcp-server exited code=${code} signal=${signal}`);
});

// Kick off initialize once the process is ready; slight delay to skip banner logs.
setTimeout(() => {
  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      capabilities: {},
    },
  });
}, 200);
