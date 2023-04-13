// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract HNFTGovernance {
    mapping(uint256 => address) public tokenId2GovernanceToken;

    IERC721 public nftAddress;

    event FragmentGovernance(uint256 indexed nftId, address indexed erc20Address);

    constructor(address _hnftAddress) {
        nftAddress = IERC721(_hnftAddress);
    }

    function governWith(uint256 nftId, address erc20Address) public {
        require(nftAddress.ownerOf(nftId) == msg.sender, "Only the NFT owner can fragment");
        require(tokenId2GovernanceToken[nftId] == address(0), "NFT has become fragmented");
        tokenId2GovernanceToken[nftId] = erc20Address;

        emit FragmentGovernance(nftId, erc20Address);
    }

    function getGovernanceToken(uint256 nftId) public view returns (address) {
        return tokenId2GovernanceToken[nftId];
    }
}