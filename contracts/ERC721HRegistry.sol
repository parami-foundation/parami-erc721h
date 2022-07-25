//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./ERC721HContract.sol";

contract ERC721HRegistry {
    using EnumerableSet for EnumerableSet.AddressSet;
    mapping(address => EnumerableSet.AddressSet) owner2ERC721Hs;

    function getERC721hAddressesFor(address owner) external view returns (address[] memory)
    {
        return owner2ERC721Hs[owner].values();
    }

    function createERC721hContract(string memory name, string memory symbol, string memory tokenURI) public returns (address) {
      require(bytes(name).length > 0, "Please specify name.");
      require(bytes(symbol).length > 0, "Please specify symbol.");

      ERC721HContract hContract = new ERC721HContract(name, symbol, msg.sender, tokenURI);

      owner2ERC721Hs[msg.sender].add(address(hContract));
      return address(hContract);
    }
}
