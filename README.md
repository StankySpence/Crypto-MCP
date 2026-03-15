# Crypto MCP Server

An MCP (Model Context Protocol) server for Ethereum smart contract operations.

## Features

- **compile_contract** - Compile Solidity contracts using Hardhat
- **deploy_contract** - Deploy contracts to Ethereum networks (localhost, Goerli, Sepolia, Mainnet)
- **call_contract** - Call view/pure functions (read-only, no gas)
- **send_transaction** - Send state-changing transactions (requires gas)
- **get_balance** - Get ETH balance of any address
- **get_contract_abi** - Get ABI of compiled contracts
- **list_contracts** - List all compiled contracts
- **get_deployment_info** - Get deployed contract addresses

## Setup

1. Clone the repo:
```bash
git clone https://github.com/StankySpence/Crypto-MCP.git
cd Crypto-MCP
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables in a `.env` file:
```env
# For local development (Hardhat node)
LOCALHOST_RPC_URL=http://localhost:8545
LOCALHOST_PRIVATE_KEY=your_private_key

# For testnets
GOERLI_RPC_URL=https://goerli.infura.io/v3/YOUR_INFURA_KEY
GOERLI_PRIVATE_KEY=your_private_key

SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
SEPOLIA_PRIVATE_KEY=your_private_key

# Path to your Hardhat project (optional)
ETH_PROJECT_PATH=/path/to/your/eth-project
```

4. Start a local Hardhat node:
```bash
cd /home/stanky/eth-project
npx hardhat node
```

5. Compile your contracts:
```bash
npx hardhat compile
```

## Usage with Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "crypto": {
      "command": "node",
      "args": ["/path/to/Crypto-MCP/server.js"]
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `compile_contract` | Compile a Solidity contract |
| `deploy_contract` | Deploy a contract to a network |
| `call_contract` | Call a view/pure function (read) |
| `send_transaction` | Call a state-changing function (write) |
| `get_balance` | Get ETH balance of an address |
| `get_contract_abi` | Get contract ABI |
| `list_contracts` | List all compiled contracts |
| `get_deployment_info` | Get deployment info |

## Example Usage

```javascript
// Get all compiled contracts
await list_contracts()

// Get balance
await get_balance({ address: "0x...", network: "localhost" })

// Deploy a contract
await deploy_contract({ 
  contractName: "MyToken", 
  network: "localhost" 
})

// Call a view function
await call_contract({
  contractAddress: "0x...",
  functionName: "balanceOf",
  args: ["0x..."]
})
```
