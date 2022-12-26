//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockAD3 is ERC20 {
  constructor() ERC20("Mock AD3", "MAD3") {}

  function mint(uint256 amount) external {
    _mint(msg.sender, amount);
  }
}