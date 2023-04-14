//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../IERC721H.sol";
import "./HNFTGovernance.sol";

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

    struct NewBid {
        uint256 bidId;
        uint256 amount;
    }

    address private relayerAddress;
    address private ad3Address;
    mapping(uint256 => Bid) public curBid;
    mapping(uint256 => mapping(address => NewBid)) public newBids;


    constructor(address _relayerAddress, address _ad3Address) {
        relayerAddress = _relayerAddress;
        ad3Address = _ad3Address;
    }

    event BidSuccessed(uint256 bidId, address bidder, uint256 amount);
    event BidBalanceRefunded(uint256 bidId, uint256 hNFTId, address governanceTokenAddr, address to, uint256 amount);

    function newBid(uint256 hNFTId, uint256 deposit) public returns (uint256 curBidId, uint256 newBidId) {
        require(deposit > 0, "ad3Deposit must be greater than 0.");
        require(hNFTId > 0, "hNFTId must be greater than 0.");
        IERC20 token = IERC20(ad3Address);
        require(token.balanceOf(_msgSender()) >= deposit, "AD3 balance not enough");
        require(token.allowance(_msgSender(), address(this)) >= deposit, "allowance not enough");
        token.safeTransferFrom(_msgSender(), address(this), deposit);
        uint256 bidId = _generateRandomNumber();
        newBids[hNFTId][_msgSender()] = NewBid(bidId, deposit);
        curBidId = curBid[hNFTId].bidId;
        newBidId = bidId;
    }

    function commitBid(
        uint256 hNFTId,
        address hNFTContractAddr,
        address governanceAddr,
        uint256 governanceTokenAmount,
        string memory slotUri,
        bytes memory _signature
    ) public {
        require(hNFTId > 0, "hNFTId must be greater than 0.");
        require(governanceTokenAmount > 0, "Bid amount must be greater than 0.");
        require(hNFTContractAddr != address(0) && governanceAddr != address(0), "The hNFT and governance contract can not be address(0).");
        address governanceTokenAddr = HNFTGovernance(governanceAddr).getGovernanceToken(hNFTId);
        require(governanceTokenAddr != address(0), "The governance token address can not be address(0).");
        require(verify(hNFTId, _signature), "Invalid Signer!");
        IERC721H hNFT = IERC721H(hNFTContractAddr);
        IERC20 token = IERC20(governanceTokenAddr);

        require(token.balanceOf(_msgSender()) >= governanceTokenAmount, "balance not enough");
        require(token.allowance(_msgSender(), address(this)) >= governanceTokenAmount, "allowance not enough");

        if(!_isDefaultBalance(hNFTId)) {
            Bid memory previousBidder = curBid[hNFTId];
            require(_isMore120Percent(previousBidder.amount, governanceTokenAmount), "The bid is less than 120%");
            token.safeTransfer(previousBidder.bidder, previousBidder.amount);

            emit BidBalanceRefunded(previousBidder.bidId, hNFTId, previousBidder.tokenContract, previousBidder.bidder, previousBidder.amount);
        }

        curBid[hNFTId] = Bid(_generateRandomNumber(), governanceTokenAmount, _msgSender(), governanceTokenAddr, slotUri);
        token.safeTransferFrom(_msgSender(), address(this), governanceTokenAmount);
        token.approve(relayerAddress, governanceTokenAmount);
        hNFT.setSlotUri(hNFTId, slotUri);

        emit BidSuccessed(curBid[hNFTId].bidId, _msgSender(), governanceTokenAmount);
    }

    function modifyRelayerAddress(address _relayerAddress) public onlyOwner {
        relayerAddress = _relayerAddress;
    }

    // --- Private Function ---

    function _isDefaultBalance(uint256 hNFTId) private view returns(bool) {
        return curBid[hNFTId].amount == 0;
    }

    function _isMore120Percent(uint256 lastBidAmount, uint256 bidAmount) private pure returns(bool) {
        uint256 result = lastBidAmount.mul(12).div(10);
        return bidAmount >= result;
    }

    function _generateRandomNumber() private view returns (uint256) {
        bytes32 blockHash = blockhash(block.number);
        bytes memory concatData = abi.encodePacked(blockHash, block.timestamp, block.coinbase);
        bytes32 hash = keccak256(concatData);
        return uint256(hash);
    }

    function verify(uint256 hnftId, bytes memory _signature) public view returns (bool){
        NewBid memory bid = newBids[hnftId][_msgSender()];
        bytes32 _msgHash = ECDSA.toEthSignedMessageHash(getMessageHash(curBid[hnftId].bidId, bid.bidId, bid.amount));
        return ECDSA.recover(_msgHash, _signature) == _msgSender();
    }

    function getMessageHash(uint256 curBidId, uint256 newBidId, uint256 newBidTokenAmount) private pure returns (bytes32){
        return keccak256(abi.encodePacked(curBidId, newBidId, newBidTokenAmount));
    }
}