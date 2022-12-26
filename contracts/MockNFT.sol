// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";                                                                                                                                                        

contract MockNFT is ERC721Enumerable, Ownable {
    uint256 public constant MAX_SUPPLY = 200;
    uint256 public constant MAX_MINT = 4;
    uint256 public constant PUBLIC_SALE_PRICE = .05 ether;

    string private baseTokenUri;

    bool public publicSale = false;

    constructor() ERC721("The Best NFT", "TBN"){}

    function mint(uint256 _quantity) external payable {        
        _safeMint(msg.sender, _quantity);
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseTokenUri;
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");

        return "";
    }

    function setTokenUri(string memory _baseTokenUri) external onlyOwner {
        baseTokenUri = _baseTokenUri;
    }

    function withdraw() external onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }
}