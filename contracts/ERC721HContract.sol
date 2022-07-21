//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IERC721H.sol";

contract ERC721HContract is IERC721H, ERC721, Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    mapping(uint256 => EnumerableSet.AddressSet) tokenId2AuthroizedAddresses;
    mapping(uint256 => mapping(address=> string)) tokenId2Address2Value;

    string private _tokenURI;

    constructor(string memory name, string memory symbol, address creator,
                string memory tokenURI) ERC721(name, symbol) {
        _tokenURI = tokenURI;
        _transferOwnership(creator);
        _safeMint(creator, 1);
    }

    modifier onlyTokenOwner(uint256 tokenId) {
        require(_msgSender() == ownerOf(tokenId), "should be the token owner");
        _;
    }

    modifier onlyAuthroized(uint256 tokenId) {
        require(tokenId2AuthroizedAddresses[tokenId].contains(_msgSender()), "address should be authorized");
        _;
    }

    // ======= start entry
    function setEntryUri(uint256 tokenId, string calldata value) override external onlyAuthroized(tokenId) {
        tokenId2Address2Value[tokenId][_msgSender()] = value;

        emit SlotUriUpdated(tokenId, _msgSender(), value);
    }

    function getEntryUri(uint256 tokenId, address addr) override external view returns (string memory) {
        return tokenId2Address2Value[tokenId][addr];
    }

    function authorizeSlotTo(uint256 tokenId, address authorizedAddress) override external onlyTokenOwner(tokenId) {
        require(!tokenId2AuthroizedAddresses[tokenId].contains(authorizedAddress), "address already authorized");

        tokenId2AuthroizedAddresses[tokenId].add(authorizedAddress);

        emit SlotAuthorizationCreated(tokenId, authorizedAddress);
    }

    function revokeAuthorization(uint256 tokenId, address addr) override external onlyTokenOwner(tokenId) {
        tokenId2AuthroizedAddresses[tokenId].remove(addr);
        delete tokenId2Address2Value[tokenId][addr];

        emit SlotAuthorizationRevoked(tokenId, addr);
    }

    function revokeAllAuthorizations(uint256 tokenId) override external onlyTokenOwner(tokenId) {
        for (uint256 i = tokenId2AuthroizedAddresses[tokenId].length() - 1;i > 0; i--) {
            address addr = tokenId2AuthroizedAddresses[tokenId].at(i);
            tokenId2AuthroizedAddresses[tokenId].remove(addr);
            delete tokenId2Address2Value[tokenId][addr];

            emit SlotAuthorizationRevoked(tokenId, addr);
        }

        if (tokenId2AuthroizedAddresses[tokenId].length() > 0) {
            address addr = tokenId2AuthroizedAddresses[tokenId].at(0);
            tokenId2AuthroizedAddresses[tokenId].remove(addr);
            delete tokenId2Address2Value[tokenId][addr];

            emit SlotAuthorizationRevoked(tokenId, addr);

        }
    }

    function isAddressAuthroized(uint256 tokenId, address addr) public view returns (bool) {
        return tokenId2AuthroizedAddresses[tokenId].contains(addr);
    }

    // !!expensive, should call only when no gas is needed;
    function getAuthroizedAddresses(uint256 tokenId) external view returns (address[] memory) {
        return tokenId2AuthroizedAddresses[tokenId].values();
    }

    function tokenURI(uint256) public view override returns(string memory) {
        return _tokenURI;
    }

    function setTokenURI(string calldata uri) public onlyOwner {
        _tokenURI = uri;
    }
}
