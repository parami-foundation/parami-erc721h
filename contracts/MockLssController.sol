/**
 *Submitted for verification at BscScan.com on 2022-08-31
*/

//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./AD3.sol";

contract MockLssController is ILssController {
    function beforeTransfer(address sender, address recipient, uint256 amount) override external {}

    function beforeTransferFrom(address msgSender, address sender, address recipient, uint256 amount) override external {}

    function beforeApprove(address sender, address spender, uint256 amount) override external {}

    function beforeIncreaseAllowance(address msgSender, address spender, uint256 addedValue) override external {}

    function beforeDecreaseAllowance(address msgSender, address spender, uint256 subtractedValue) override external {}
}
