import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverScript = process.argv[2] || "/home/stanky/mcp-server/server.js";

const transport = new StdioClientTransport({
  command: "node",
  args: [serverScript],
});

const client = new Client({ name: "test-client", version: "1.0.0" }, {
  capabilities: {},
});

await client.connect(transport);

console.log("Connected! Listing tools...");
const tools = await client.listTools();
console.log("Available tools:", tools.tools.map(t => t.name).join(", "));

// Test a tool call
if (tools.tools.length > 0) {
  const result = await client.callTool({
    name: tools.tools[0].name,
    arguments: {}
  });
  console.log("Result:", JSON.stringify(result, null, 2));
}

await client.close();
