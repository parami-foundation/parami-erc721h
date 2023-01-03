//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../IERC721H.sol";
import "../base64.sol";

contract EPI5489ForInfluenceMing is IERC721H, ERC721EnumerableUpgradeable, OwnableUpgradeable {
    mapping(uint256 => string) tokenId2AuthorizedAddress;
    mapping(uint256 => string) tokenId2ImageUri;
    mapping(uint256 => string) tokenId2Hyperlink;
    mapping(uint256 => string) tokenId2TwitterId;
    mapping(string => uint256) twitterId2TokenId;

    string private defaultHyperlinkPrefix;

    function initialize() initializer public {
        __ERC721_init("Hyperlink NFT Collection", "HNFT");
        __Ownable_init();
     }

    modifier onlyTokenOwner(uint256 tokenId) {
        require(tx.origin == ownerOf(tokenId) || _msgSender() == ownerOf(tokenId), "should be the token owner");
        _;
    }

    modifier onlySlotManager(uint256 tokenId) {
        require(_msgSender() == ownerOf(tokenId) || tokenId2AuthorizedAddress[tokenId] == _msgSender(), "address should be authorized");
        _;
    }

    function setSlotUri(uint256 tokenId, string calldata value) override external onlyTokenOwner(tokenId) {
        tokenId2Hyperlink[tokenId] = value;

        emit SlotUriUpdated(tokenId, _msgSender(), value);
    }

    function getSlotUri(uint256 tokenId, address slotManagerAddr) override external view returns (string memory) {
        return tokenId2Hyperlink[tokenId];
    }

    function authorizeSlotTo(uint256 tokenId, address slotManagerAddr) override external onlyTokenOwner(tokenId) {
        if (tokenId2AuthorizedAddress[tokenId] != slotManagerAddr) {
            tokenId2AuthorizedAddress[tokenId] = slotManagerAddr;
            emit SlotAuthorizationCreated(tokenId, slotManagerAddr);
        }
    }

    function revokeAuthorization(uint256 tokenId, address slotManagerAddr) override external onlyTokenOwner(tokenId) {
        string authorizedAddress = tokenId2AuthorizedAddress[tokenId];
        tokenId2AuthorizedAddress.remove(tokenId);
        delete tokenId2Hyperlink[tokenId];

        emit SlotAuthorizationRevoked(tokenId, authorizedAddress);
    }

    function isSlotManager(uint256 tokenId, address addr) public view returns (bool) {
        return tokenId2AuthorizedAddress[tokenId] == addr;
    }

    function mint(string calldata imageUri, string calldata twitterId) external {
        require(twitterId2TokenId[twitterId] == 0, "twitterId already used");
        
        uint256 tokenId = totalSupply() + 1;

        _safeMint(msg.sender, tokenId);
        tokenId2ImageUri[tokenId] = imageUri;
        tokenId2TwitterId[tokenId] = twitterId;
        twitterId2TokenId[twitterId] = tokenId;
    }

    function tokenURI(uint256 _tokenId) public view override returns (string memory) {
        require(
            _exists(_tokenId),
            "URI query for nonexistent token"
        );

        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(
                        bytes(
                            abi.encodePacked(
                                '{"name":"',
                                abi.encodePacked(
                                    "Hyperlink NFT Collection # ",
                                    StringsUpgradeable.toString(_tokenId)
                                ),
                                '",',
                                '"description":"Hyperlink NFT collection created with Parami Foundation"',
                                ',',
                                '"image":"',
                                tokenId2ImageUri[_tokenId],
                                '",',
                                '"twitterId":"',
                                tokenId2TwitterId[_tokenId],
                                '"',
                                '}'
                            )
                        )
                    )
                )
            );
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721EnumerableUpgradeable)
        returns (bool)
    {
        return interfaceId == type(IERC721H).interfaceId || super.supportsInterface(interfaceId);
    }
}