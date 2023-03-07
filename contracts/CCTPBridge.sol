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

    // parami nft id => bidder eth account => bid amount
    mapping (uint256 => mapping (address => uint256)) public bidAd3;

    event NftBidded(uint256 indexed parami_nft_id, address indexed bidder, uint256 bid_amount);

    // --- Bid Ad3 ---
    function bidNft(uint256 parami_nft_id, uint256 bid_amount) public {
        require(bid_amount > 0, "bid amount must be greater than 0");
        require(bidAd3[parami_nft_id][_msgSender()] == 0, "bidder already bid this nft");
        require(ad3.allowance(_msgSender(), address(this)) >= bid_amount, "bidder does not approve enough ad3 to bid");

        ad3.transferFrom(_msgSender(), address(this), bid_amount);
        bidAd3[parami_nft_id][_msgSender()] = bid_amount;

        emit NftBidded(parami_nft_id, _msgSender(), bid_amount);
    }

    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }
}
