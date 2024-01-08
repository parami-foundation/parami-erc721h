// SPDX-License-Identifier: MIT
pragma solidity >=0.8.2 <0.9.0;

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

    function split(uint256 tokenId, uint256 amount) external {
        require(_ownerOf(tokenId) == msg.sender, "Not token owner");
        require(tokenIdToAmount[tokenId] > amount, "Amount exceeds");
        uint256 newTokenId = _nextTokenId++;
        tokenIdToAmount[tokenId] -= amount;
        _safeMint(msg.sender, newTokenId);
        tokenIdToAmount[newTokenId] = amount;
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        _requireOwned(tokenId);

        string[13] memory parts;
        string memory amount = (tokenIdToAmount[tokenId]).toString();

        parts[
            0
        ] = '<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMin meet" viewBox="0 0 180 180"><style>.base { fill: white; font-family: serif; font-size: 14px; }</style><rect width="100%" height="100%" fill="black" /><text x="10" y="20" class="base">';

        parts[1] = "{";

        parts[2] = '</text><text x="30" y="40" class="base">';

        parts[3] = '"p": "gpt20"';

        parts[4] = '</text><text x="30" y="60" class="base">';

        parts[5] = '"op": "mint"';

        parts[6] = '</text><text x="30" y="80" class="base">';

        parts[7] = '"tick": "gpt"';

        parts[8] = '</text><text x="30" y="100" class="base">"amount": "';

        parts[9] = amount;
        
        parts[10] = '"</text><text x="10" y="120" class="base">';

        parts[11] = '}';

        parts[12] = "</text></svg>";

        string memory output = string(
            abi.encodePacked(
                parts[0],
                parts[1],
                parts[2],
                parts[3],
                parts[4],
                parts[5],
                parts[6],
                parts[7],
                parts[8]
            )
        );
        output = string(abi.encodePacked(output, parts[9], parts[10], parts[11], parts[12]));

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "GPTMiner Inscription #',
                        tokenId.toString(),
                        '", "description": "World\'s first token inscribed by GPT.", "image": "data:image/svg+xml;base64,',
                        Base64.encode(bytes(output)),
                        '"}'
                    )
                )
            )
        );
        output = string(
            abi.encodePacked("data:application/json;base64,", json)
        );

        return output;
    }
}
