import { spawn } from "child_process";

async function listTools() {
  const child = spawn("npx", ["-y", "@upstash/context7-mcp@latest"], { shell: true });
  
  child.stdout.on("data", (data) => {
    const lines = data.toString().split("\n");
    for (const line of lines) {
      if (line.trim().startsWith('{"jsonrpc"')) {
        const json = JSON.parse(line);
        if (json.result && json.result.tools) {
          console.log("--- HERRAMIENTAS DISPONIBLES EN EL SERVIDOR ---");
          console.log(JSON.stringify(json.result.tools, null, 2));
          child.kill();
        }
      }
    }
  });

  // Handshake
  child.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "Inspector", version: "1.0.0" } }
  }) + "\n");
  
  setTimeout(() => {
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");
    child.stdin.write(JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {}
    }) + "\n");
  }, 1000);
}

listTools();
