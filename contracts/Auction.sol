//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IERC721H.sol";

contract Auction is Ownable{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct Bid {
        uint256 bidId;
        uint256 amount;
        address bidder;
        address tokenContract;
        string  slotUri;
    }

    address private relayerAddress;
    mapping(uint256 => Bid) public highestBid;

    constructor(address _relayerAddress) {
        relayerAddress = _relayerAddress;
    }

    event BidSuccessed(uint256 bidId, address bidder, uint256 amount);
    event RefundPreviousBidIncreased(uint256 bidId, uint256 hNFTId, address tokenAddress, address refunder, uint256 amount);

    function bid(
        uint256 hNFTId,
        address hNFTContractAddr,
        address tokenContractAddr,
        uint256 fractionAmount,
        string memory slotUri
    ) public {
        require(hNFTId > 0, "hNFTId must be greater than 0.");
        require(fractionAmount > 0, "Bid amount must be greater than 0.");
        require(hNFTContractAddr != address(0) && tokenContractAddr != address(0), "The hNFT and token contract can not be address(0).");
        _bid(hNFTId, hNFTContractAddr, tokenContractAddr, fractionAmount, slotUri);
    }

    function modifyRelayerAddress(address _relayerAddress) public onlyOwner {
        relayerAddress = _relayerAddress;
    }

    // --- Private Function ---

    function _isDefaultBalance(uint256 hNFTId) private view returns(bool) {
        return highestBid[hNFTId].amount == 0;
    }

    function _isMore120Percent(uint256 lastBidAmount, uint256 bidAmount) private pure returns(bool) {
        uint256 result = lastBidAmount.mul(12).div(10);
        return bidAmount >= result;
    }

    function _bid(
        uint256 hNFTId,
        address hNFTContractAddr,
        address tokenContractAddr,
        uint256 fractionAmount,
        string memory slotUri
    ) private {

        IERC721H hNFT = IERC721H(hNFTContractAddr);
        IERC20 token = IERC20(tokenContractAddr);

        require(token.balanceOf(_msgSender()) >= fractionAmount, "balance not enough");
        require(token.allowance(_msgSender(), address(this)) >= fractionAmount, "allowance not enough");

        if(!_isDefaultBalance(hNFTId)) {
            Bid memory previousBidder = highestBid[hNFTId];
            require(_isMore120Percent(previousBidder.amount, fractionAmount), "The bid is less than 120%");
            token.safeTransfer(previousBidder.bidder, previousBidder.amount);

            emit RefundPreviousBidIncreased(previousBidder.bidId, hNFTId, previousBidder.tokenContract, previousBidder.bidder, previousBidder.amount);
        }

        highestBid[hNFTId] = Bid(_generateRandomNumber(), fractionAmount, _msgSender(), tokenContractAddr, slotUri);
        token.safeTransferFrom(_msgSender(), address(this), fractionAmount);
        token.approve(relayerAddress, fractionAmount);
        hNFT.setSlotUri(hNFTId, slotUri);

        emit BidSuccessed(highestBid[hNFTId].bidId, _msgSender(), fractionAmount);
    }

    function _generateRandomNumber() private view returns (uint256) {
        bytes32 blockHash = blockhash(block.number);
        bytes memory concatData = abi.encodePacked(blockHash, block.timestamp, block.coinbase);
        bytes32 hash = keccak256(concatData);
        return uint256(hash);
    }
}