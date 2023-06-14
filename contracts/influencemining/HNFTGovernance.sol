// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./HNFTGovernanceToken.sol";

contract HNFTGovernance {

    mapping(address => mapping(uint256 => address)) public hnft2tokenId2GovernanceToken;

    event Governance(uint256 indexed nftId, address indexed erc20Address);

    function issueGovernanceToken(
        address hnftAddress,
        uint256 nftId,
        string memory name,
        string memory symbol
    ) public {
        IERC721 nftAddress = IERC721(hnftAddress);
        require(
            nftAddress.ownerOf(nftId) == msg.sender,
            "Only the NFT owner can issue governance token"
        );
        require(
            hnft2tokenId2GovernanceToken[hnftAddress][nftId] == address(0),
            "NFT already has governance token"
        );

        HNFTGovernanceToken goverenceToken = new HNFTGovernanceToken(
            name,
            symbol
        );
        goverenceToken.mint(msg.sender, 1e18);

        address erc20Address = address(goverenceToken);

        hnft2tokenId2GovernanceToken[hnftAddress][nftId] = erc20Address;

        emit Governance(nftId, erc20Address);
    }

    function getGovernanceToken(address hnftAddress, uint256 nftId) public view returns (address) {
        return hnft2tokenId2GovernanceToken[hnftAddress][nftId];
    }
}