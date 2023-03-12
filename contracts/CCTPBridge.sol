/**
 *Submitted for verification at BscScan.com on 2022-08-31
*/

//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./AD3.sol";

contract CCTPBridge {

    constructor(address ad3ContractAddress) {
        ad3 = AD3(ad3ContractAddress);
    }

    AD3 ad3;

    event Deposited(address indexed depositer, uint256 amount, uint256 destinationDomain, bytes32 indexed recepient );

    function depositForBurn(uint256 amount, uint256 destinationDomain, bytes32 recepient) public {
        require(amount > 0, "amount must be greater than 0");
        require(ad3.allowance(_msgSender(), address(this)) >= amount, "bidder does not approve enough ad3 to bid");

        ad3.transferFrom(_msgSender(), address(this), amount);

        emit Deposited(_msgSender(), amount, destinationDomain, recepient);
    }

    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }
}
