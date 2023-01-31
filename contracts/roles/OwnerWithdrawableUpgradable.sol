//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

abstract contract OwnerWithdrawableUpgradable is OwnableUpgradeable {
    function withdrawAllOfERC20(address erc20Address) public onlyOwner {
        IERC20 erc20 = IERC20(erc20Address);
        uint256 allBalance = erc20.balanceOf(address(this));
        erc20.transfer(owner(), allBalance);
    }
}
