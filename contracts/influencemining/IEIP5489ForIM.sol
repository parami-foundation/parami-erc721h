// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface EIP5489ForInfluenceMining {
    function updateAd3Address(address _ad3Address) external;
    function manageLevelPrices(uint256[] calldata levels, uint256[] calldata prices) external;
    function level2Price(uint256 level) external view returns (uint256);
}