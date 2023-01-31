pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

abstract contract OwnerPausableUpgradable is
    OwnableUpgradeable,
    PausableUpgradeable
{
    function ownerPause() external onlyOwner {
        _pause();
    }

    function ownerUnPause() external onlyOwner {
        _unpause();
    }
}
