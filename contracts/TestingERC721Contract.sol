//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

// only used fro testing
contract TestingERC721Contract is ERC721Enumerable {

    constructor() ERC721("Test NFT", "TSC") {
    }

    function mint() public {

        _safeMint(msg.sender, totalSupply() + 1);
    }
}
