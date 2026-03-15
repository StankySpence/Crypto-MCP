import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";

const server = new Server(
  { name: "crypto-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const PROJECT_PATH = process.env.ETH_PROJECT_PATH || "/home/stanky/eth-project";

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "compile_contract",
        description: "Compile Solidity smart contracts using Hardhat",
        inputSchema: {
          type: "object",
          properties: {
            contractName: { type: "string", description: "Name of the contract to compile (e.g., TaskContract)" }
          }
        }
      },
      {
        name: "deploy_contract",
        description: "Deploy a compiled Solidity contract to a network",
        inputSchema: {
          type: "object",
          properties: {
            contractName: { type: "string", description: "Name of the contract to deploy" },
            network: { type: "string", description: "Network to deploy to (localhost, goerli, sepolia, mainnet)", default: "localhost" },
            constructorArgs: { type: "array", description: "Constructor arguments if any", items: { type: "string" } }
          },
          required: ["contractName"]
        }
      },
      {
        name: "call_contract",
        description: "Call a read-only function on a deployed contract (view/pure) - no gas required",
        inputSchema: {
          type: "object",
          properties: {
            contractAddress: { type: "string", description: "Address of the deployed contract" },
            functionName: { type: "string", description: "Name of the function to call" },
            args: { type: "array", description: "Function arguments", items: { type: "string" } },
            abiPath: { type: "string", description: "Path to contract ABI (optional, will use artifacts if not provided)" }
          },
          required: ["contractAddress", "functionName"]
        }
      },
      {
        name: "send_transaction",
        description: "Send a state-changing transaction to a contract (requires gas)",
        inputSchema: {
          type: "object",
          properties: {
            contractAddress: { type: "string", description: "Address of the deployed contract" },
            functionName: { type: "string", description: "Name of the function to call" },
            args: { type: "array", description: "Function arguments", items: { type: "string" } },
            value: { type: "string", description: "ETH to send in wei (optional)" }
          },
          required: ["contractAddress", "functionName"]
        }
      },
      {
        name: "get_balance",
        description: "Get the ETH balance of an address",
        inputSchema: {
          type: "object",
          properties: {
            address: { type: "string", description: "Ethereum address to check balance" },
            network: { type: "string", description: "Network (localhost, goerli, sepolia)", default: "localhost" }
          },
          required: ["address"]
        }
      },
      {
        name: "get_contract_abi",
        description: "Get the ABI of a compiled contract",
        inputSchema: {
          type: "object",
          properties: {
            contractName: { type: "string", description: "Name of the contract" }
          },
          required: ["contractName"]
        }
      },
      {
        name: "list_contracts",
        description: "List all compiled contracts in the project",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "get_deployment_info",
        description: "Get information about deployed contract addresses",
        inputSchema: {
          type: "object",
          properties: {
            network: { type: "string", description: "Network name", default: "localhost" }
          }
        }
      }
    ]
  };
});

async function getProvider(network) {
  if (network === "localhost") {
    return new ethers.JsonRpcProvider("http://localhost:8545");
  }
  const rpcUrl = process.env[`${network.toUpperCase()}_RPC_URL`];
  if (!rpcUrl) {
    throw new Error(`No RPC URL configured for network: ${network}`);
  }
  return new ethers.JsonRpcProvider(rpcUrl);
}

async function getSigner(network) {
  const provider = await getProvider(network);
  const privateKey = process.env[`${network.toUpperCase()}_PRIVATE_KEY`];
  if (!privateKey) {
    throw new Error(`No private key configured for network: ${network}`);
  }
  return new ethers.Wallet(privateKey, provider);
}

server.setRequestHandler(CallToolRequestSchema, async ({ name, arguments: args }) => {
  try {
    let result;

    switch (name) {
      case "compile_contract": {
        const { contractName } = args;
        const artifactsPath = path.join(PROJECT_PATH, "artifacts/contracts");
        
        if (!fs.existsSync(artifactsPath)) {
          result = { error: "No compiled contracts found. Run hardhat compile first." };
        } else {
          const contractPath = path.join(artifactsPath, `${contractName}.sol/${contractName}.json`);
          if (fs.existsSync(contractPath)) {
            result = { 
              success: true, 
              contract: contractName,
              artifact: contractPath,
              message: "Contract already compiled" 
            };
          } else {
            result = { error: `Contract ${contractName} not found. Available: ${fs.readdirSync(artifactsPath).join(", ")}` };
          }
        }
        break;
      }

      case "deploy_contract": {
        const { contractName, network = "localhost", constructorArgs = [] } = args;
        const artifactPath = path.join(PROJECT_PATH, "artifacts/contracts", `${contractName}.sol/${contractName}.json`);
        
        if (!fs.existsSync(artifactPath)) {
          result = { error: `Contract ${contractName} not found. Compile first.` };
        } else {
          const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
          const signer = await getSigner(network);
          const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
          
          const deployed = await factory.deploy(...constructorArgs);
          await deployed.waitForDeployment();
          const address = await deployed.getAddress();
          
          result = { 
            success: true,
            contractName,
            network,
            address,
            transactionHash: deployed.deploymentTransaction().hash,
            message: `Deployed to ${address}`
          };
        }
        break;
      }

      case "call_contract": {
        const { contractAddress, functionName, args = [], abiPath } = args;
        const provider = await getProvider("localhost");
        
        let abi;
        if (abiPath && fs.existsSync(abiPath)) {
          abi = JSON.parse(fs.readFileSync(abiPath, "utf8"));
        } else {
          abi = ["function " + functionName + "(...) view returns (...)"];
        }
        
        const contract = new ethers.Contract(contractAddress, abi, provider);
        const response = await contract[functionName](...args);
        
        result = { 
          success: true,
          contractAddress,
          functionName,
          result: response.toString()
        };
        break;
      }

      case "send_transaction": {
        const { contractAddress, functionName, args = [], value } = args;
        const signer = await getSigner("localhost");
        
        const contractPath = path.join(PROJECT_PATH, "artifacts/contracts");
        let abi = null;
        
        for (const file of fs.readdirSync(contractPath)) {
          const artifactPath = path.join(contractPath, file);
          if (fs.statSync(artifactPath).isDirectory()) {
            const jsonPath = path.join(artifactPath, "json");
            if (fs.existsSync(jsonPath)) {
              const artifact = JSON.parse(fs.readFileSync(path.join(artifactPath, `${path.basename(file, ".sol")}.json`), "utf8"));
              if (artifact.abi.some(f => f.name === functionName)) {
                abi = artifact.abi;
                break;
              }
            }
          }
        }
        
        if (!abi) {
          result = { error: "Could not find ABI for function. Provide abiPath." };
        } else {
          const contract = new ethers.Contract(contractAddress, abi, signer);
          const tx = value 
            ? await contract[functionName](...args, { value: ethers.parseEther(value) })
            : await contract[functionName](...args);
          await tx.wait();
          
          result = {
            success: true,
            transactionHash: tx.hash,
            message: "Transaction confirmed"
          };
        }
        break;
      }

      case "get_balance": {
        const { address, network = "localhost" } = args;
        const provider = await getProvider(network);
        const balance = await provider.getBalance(address);
        
        result = {
          address,
          network,
          balance: ethers.formatEther(balance) + " ETH",
          balanceWei: balance.toString()
        };
        break;
      }

      case "get_contract_abi": {
        const { contractName } = args;
        const artifactPath = path.join(PROJECT_PATH, "artifacts/contracts", `${contractName}.sol/${contractName}.json`);
        
        if (!fs.existsSync(artifactPath)) {
          result = { error: `Contract ${contractName} not found` };
        } else {
          const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
          result = {
            contractName,
            abi: artifact.abi,
            bytecode: artifact.bytecode
          };
        }
        break;
      }

      case "list_contracts": {
        const artifactsPath = path.join(PROJECT_PATH, "artifacts/contracts");
        
        if (!fs.existsSync(artifactsPath)) {
          result = { contracts: [], message: "No compiled contracts. Run hardhat compile." };
        } else {
          const contracts = fs.readdirSync(artifactsPath).filter(f => f.endsWith(".sol"));
          result = { contracts };
        }
        break;
      }

      case "get_deployment_info": {
        const { network = "localhost" } = args;
        const deploymentsPath = path.join(PROJECT_PATH, "deployments", `${network}.json`);
        
        if (!fs.existsSync(deploymentsPath)) {
          result = { network, deployments: [], message: "No deployments found for this network" };
        } else {
          const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
          result = { network, deployments };
        }
        break;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
