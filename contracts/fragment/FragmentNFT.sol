// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./FragmentToken.sol";

contract FragmentedNFT {
    mapping(uint256 => address) public nftToERC20;

    IERC721 public nftAddress;

    event FragmentGovernance(uint256 indexed nftId, address indexed erc20Address);
    event FragmentMinted(address indexed owner, uint256 indexed nftId, uint256 amount);
    event FragmentCreateToken(address indexed owner, uint256 indexed nftId, string name, string symbol);

    constructor(address _hnftAddress) {
        nftAddress = IERC721(_hnftAddress);
    }

    function governWith(uint256 nftId, address erc20Address) public {
        require(nftAddress.ownerOf(nftId) == msg.sender, "Only the NFT owner can fragment");
        nftToERC20[nftId] = erc20Address;

        emit FragmentGovernance(nftId, erc20Address);
    }

    function mintFragmentedTokens(uint256 nftId, uint256 amount) public {
        require(nftAddress.ownerOf(nftId) == msg.sender, "Caller is not the owner of the NFT");
        require(nftToERC20[nftId] != address(0), "NFT is not fragmented");
        FragmentToken fragmentToken = FragmentToken(nftToERC20[nftId]);
        fragmentToken.mint(msg.sender, amount);

        emit FragmentMinted(msg.sender, nftId, amount);
    }

    function createAndGovernFragmentToken(uint256 nftId, string memory name, string memory symbol) external {
        require(nftAddress.ownerOf(nftId) == msg.sender, "Caller is not the owner of the NFT");
        FragmentToken fragmentToken = new FragmentToken(name, symbol);
        nftToERC20[nftId] = address(fragmentToken);

        emit FragmentCreateToken(msg.sender, nftId, name, symbol);
    }
}