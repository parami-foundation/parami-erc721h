//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import 'erc721a-upgradeable/contracts/ERC721AUpgradeable.sol';
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./IERC721H.sol";
import "./base64.sol";

contract ERC721HBatchCollection is IERC721H, ERC721AUpgradeable, OwnableUpgradeable {

    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    mapping(uint256 => EnumerableSetUpgradeable.AddressSet) tokenId2AuthorizedAddresses;
    mapping(uint256 => mapping(address=>string)) tokenId2Address2Value;

    string private _baseTokenURI;
    string private _defaultBaseSlotURI;

    uint256 private constant _MAX_MINT_ERC2309_QUANTITY_LIMIT = 5000;

    function initialize(string calldata baseURI, string calldata defaultBaseSlotURI, uint256 initialMintAmount) initializerERC721A initializer public {
        __ERC721A_init("Hyperlink NFT Batch Collection", "HNFT");
        __Ownable_init();

        _baseTokenURI = baseURI;
        _defaultBaseSlotURI = defaultBaseSlotURI;

        while (initialMintAmount != 0) {
            uint256 mintAmount = initialMintAmount;
            if (mintAmount > _MAX_MINT_ERC2309_QUANTITY_LIMIT) {
                mintAmount = _MAX_MINT_ERC2309_QUANTITY_LIMIT;
            }
            _mintERC2309(owner(), mintAmount);
            initialMintAmount -= mintAmount;
        }
     }

    modifier onlyTokenOwner(uint256 tokenId) {
        require(tx.origin == ownerOf(tokenId) || _msgSender() == ownerOf(tokenId), "should be the token owner");
        _;
    }

    modifier onlySlotManager(uint256 tokenId) {
        require(_msgSender() == ownerOf(tokenId) || tokenId2AuthorizedAddresses[tokenId].contains(_msgSender()), "address should be authorized");
        _;
    }

    function mintERC2309(address addr, uint256 quantity) public onlyOwner {
        _mintERC2309(addr, quantity);
    }

    function setSlotUri(uint256 tokenId, string calldata value) override external onlySlotManager(tokenId) {
        tokenId2Address2Value[tokenId][_msgSender()] = value;

        emit SlotUriUpdated(tokenId, _msgSender(), value);
    }

    function getSlotUri(uint256 tokenId, address slotManagerAddr) override external view returns (string memory) {
        string memory slotURI = tokenId2Address2Value[tokenId][slotManagerAddr];

        return bytes(slotURI).length == 0 ? string(abi.encodePacked(_defaultBaseSlotURI,
                                                                    StringsUpgradeable.toHexString(uint160(address(this)), 20),
                                                                    "/",
                                                                    _toString(tokenId)))
            : slotURI;
    }

    function authorizeSlotTo(uint256 tokenId, address slotManagerAddr) override external onlyTokenOwner(tokenId) {
        require(!tokenId2AuthorizedAddresses[tokenId].contains(slotManagerAddr), "address already authorized");

        _authorizeSlotTo(tokenId, slotManagerAddr);
    }

    function _authorizeSlotTo(uint256 tokenId, address slotManagerAddr) private {
        tokenId2AuthorizedAddresses[tokenId].add(slotManagerAddr);
        emit SlotAuthorizationCreated(tokenId, slotManagerAddr);
    }

    function revokeAuthorization(uint256 tokenId, address slotManagerAddr) override external onlyTokenOwner(tokenId) {
        tokenId2AuthorizedAddresses[tokenId].remove(slotManagerAddr);
        delete tokenId2Address2Value[tokenId][slotManagerAddr];

        emit SlotAuthorizationRevoked(tokenId, slotManagerAddr);
    }

    function revokeAllAuthorizations(uint256 tokenId) override external onlyTokenOwner(tokenId) {
        for (uint256 i = tokenId2AuthorizedAddresses[tokenId].length() - 1;i > 0; i--) {
            address addr = tokenId2AuthorizedAddresses[tokenId].at(i);
            tokenId2AuthorizedAddresses[tokenId].remove(addr);
            delete tokenId2Address2Value[tokenId][addr];

            emit SlotAuthorizationRevoked(tokenId, addr);
        }

        if (tokenId2AuthorizedAddresses[tokenId].length() > 0) {
            address addr = tokenId2AuthorizedAddresses[tokenId].at(0);
            tokenId2AuthorizedAddresses[tokenId].remove(addr);
            delete tokenId2Address2Value[tokenId][addr];

            emit SlotAuthorizationRevoked(tokenId, addr);
        }
    }

    function isSlotAuthorized(uint256 tokenId, address addr) public view override returns (bool) {
        return tokenId2AuthorizedAddresses[tokenId].contains(addr);
    }

    // !!expensive, should call only when no gas is needed;
    function getSlotManagers(uint256 tokenId) external view returns (address[] memory) {
        return tokenId2AuthorizedAddresses[tokenId].values();
    }

    function setBaseURI(string calldata baseURI) public onlyOwner {
        _baseTokenURI = baseURI;
    }

    function setDefaultSlotURI(string calldata defaultBaseSlotURI) public onlyOwner {
        _defaultBaseSlotURI = defaultBaseSlotURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721AUpgradeable)
        returns (bool)
    {
        return interfaceId == type(IERC721H).interfaceId || super.supportsInterface(interfaceId);
    }
}
