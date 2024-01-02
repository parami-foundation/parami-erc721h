// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract GPTMinerInscription is ERC721, Ownable {
    using Strings for uint256;
    uint256 private _nextTokenId;
    mapping(uint256 => uint256) public tokenIdToAmount;

    constructor() ERC721("GPTMiner", "GPTM") Ownable(msg.sender) {}

    function safeMint(address to, uint256 amount) public onlyOwner {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        tokenIdToAmount[tokenId] = amount;
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        _requireOwned(tokenId);

        bytes memory dataURI = abi.encodePacked(
            "{",
            '"name": "GPTMinerInscription #',
            tokenId.toString(),
            '",',
            '"description":"World\'s first token inscribed by GPT.",',
            '"attributes":[',
            '{',
                '"trait_type":"Amount",',
                '"value":"', (tokenIdToAmount[tokenId]).toString(), '"',
            '}',
            "]",
            "}"
        );

        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(dataURI)
                )
            );
    }
}
