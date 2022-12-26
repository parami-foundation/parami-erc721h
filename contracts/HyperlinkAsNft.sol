//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "./IHyperlinkAsNft.sol";
import "./base64.sol";

/**
Hyperlink as an Nft, as this phrase suggests, every Nft in this collection represents an hyperlink.
 */
contract HyperlinkAsNft is ERC721EnumerableUpgradeable, IHyperlinkAsNft {
    mapping(uint256 => string) tokenId2PosterUri;
    mapping(uint256 => string) tokenId2IconUri;
    mapping(uint256 => string) tokenId2Href;

    function initialize() public initializer {
        __ERC721_init("Hyperlink NFT Collection", "HyperlinkAsNft");
    }

    function mint(
        string calldata iconUri,
        string calldata posterUri,
        string calldata href
    ) external {
        uint256 tokenId = totalSupply() + 1;
        _safeMint(msg.sender, tokenId);
        tokenId2IconUri[tokenId] = iconUri;
        tokenId2PosterUri[tokenId] = posterUri;
        tokenId2Href[tokenId] = href;
    }

    function tokenURI(uint256 _tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(_exists(_tokenId), "URI query for nonexistent token");

        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(
                        bytes(
                            abi.encodePacked(
                                '{"name":"',
                                abi.encodePacked(
                                    "Hyperlink As NFT Collection # ",
                                    StringsUpgradeable.toString(_tokenId)
                                ),
                                '",',
                                '"description":"Hyperlink NFT collection created with Parami Foundation"',
                                ",",
                                '"image":"',
                                tokenId2IconUri[_tokenId],
                                '", ',
                                '"poster":"',
                                tokenId2PosterUri[_tokenId],
                                '", ',
                                '"href":"',
                                tokenId2Href[_tokenId],
                                '"',
                                "}"
                            )
                        )
                    )
                )
            );
    }

    /**
     * @dev
     * returns the latest icon uri of a token, which is indicated by `tokenId`
     */
    function getIconUri(uint256 tokenId)
        external
        view
        override
        returns (string memory)
    {
        return tokenId2IconUri[tokenId];
    }

    /**
     * @dev
     * returns the latest poster uri of a token, which is indicated by `tokenId`
     */
    function getPosterUri(uint256 tokenId)
        external
        view
        override
        returns (string memory)
    {
        return tokenId2PosterUri[tokenId];
    }

    /**
     * @dev
     * returns the latest href uri of a token, which is indicated by `tokenId`
     */
    function getHref(uint256 tokenId)
        external
        view
        override
        returns (string memory)
    {
        return tokenId2Href[tokenId];
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721EnumerableUpgradeable)
        returns (bool)
    {
        return
            interfaceId == type(IHyperlinkAsNft).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
