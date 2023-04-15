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
        string  slotUri;
    }

    struct PreBid {
        uint256 bidId;
        uint256 amount;
    }

    address private relayerAddress;
    address private ad3Address;
    address private hnftGoverAddress;
    mapping(uint256 => Bid) public curBid;
    mapping(uint256 => mapping(address => PreBid)) public preBids;

    constructor(address _relayerAddress, address _ad3Address, address _hnftGoverAddress) {
        relayerAddress = _relayerAddress;
        ad3Address = _ad3Address;
        hnftGoverAddress = _hnftGoverAddress;
    }

    event BidSuccessed(uint256 bidId, address bidder, uint256 amount);
    event BidBalanceRefunded(uint256 bidId, uint256 hNFTId, address to, uint256 amount);

    function preBid(uint256 hNFTId, uint256 deposit) public returns (uint256, uint256) {
        require(deposit > 0, "ad3Deposit must be greater than 0.");
        require(hNFTId > 0, "hNFTId must be greater than 0.");
        IERC20 ad3Add = IERC20(ad3Address);
        require(ad3Add.balanceOf(_msgSender()) >= deposit, "AD3 balance not enough");
        require(ad3Add.allowance(_msgSender(), address(this)) >= deposit, "allowance not enough");
        ad3Add.safeTransferFrom(_msgSender(), address(this), deposit);
        uint256 preBidId = _generateRandomNumber();
        preBids[hNFTId][_msgSender()] = PreBid(preBidId, deposit);
        uint256 curBidId = curBid[hNFTId].bidId;
        return (curBidId, preBidId);
    }

    function commitBid(
        uint256 hNFTId,
        address hNFTContractAddr,
        uint256 governanceTokenAmount,
        string memory slotUri,
        bytes memory _signature,
        uint256 curBidId,
        uint256 preBidId
    ) public {
        require(hNFTId > 0, "hNFTId must be greater than 0.");
        require(governanceTokenAmount > 0, "Bid amount must be greater than 0.");
        require(hNFTContractAddr != address(0), "The hNFT and governance contract can not be address(0).");
        require(curBidId == curBid[hNFTId].bidId, "Invalid curBidId");
        require(preBidId == preBids[hNFTId][_msgSender()].bidId, "Invalid preBidId");
        address governanceTokenAddr = HNFTGovernance(hnftGoverAddress).getGovernanceToken(hNFTContractAddr, hNFTId);
        IERC721H hNFT = IERC721H(hNFTContractAddr);
        IERC20 token = governanceTokenAddr == address(0) ? IERC20(ad3Address) : IERC20(governanceTokenAddr);
        require(token.balanceOf(_msgSender()) >= governanceTokenAmount, "balance not enough");
        require(token.allowance(_msgSender(), address(this)) >= governanceTokenAmount, "allowance not enough");
        address _signAddress = recover(hNFTId, hNFTContractAddr, address(token), governanceTokenAmount, curBidId, preBidId, _signature);
        require(verify(_signAddress), "Invalid Signer!");

        if(curBid[hNFTId].amount > 0) {
            Bid memory currentBid = curBid[hNFTId];
            require(_isAtLeast120Percent(currentBid.amount, governanceTokenAmount), "The bid is less than 120%");
            token.safeTransfer(currentBid.bidder, currentBid.amount);

            emit BidBalanceRefunded(currentBid.bidId, hNFTId, currentBid.bidder, currentBid.amount);
        }

        curBid[hNFTId] = Bid(preBidId, governanceTokenAmount, _msgSender(), slotUri);
        token.safeTransferFrom(_msgSender(), address(this), governanceTokenAmount);
        token.approve(relayerAddress, governanceTokenAmount);
        hNFT.setSlotUri(hNFTId, slotUri);

        emit BidSuccessed(preBidId, _msgSender(), governanceTokenAmount);
    }

    function setRelayerAddress(address _relayerAddress) public onlyOwner {
        relayerAddress = _relayerAddress;
    }

    function recover(uint256 hnftId, address hNFTContractAddr, 
                     address governanceTokenAddress, uint256 governanceTokenAmount, 
                     uint256 curBidId, uint256 preBidId, bytes memory _signature) public pure returns (address) {
        bytes32 _msgHash = ECDSA.toEthSignedMessageHash(
            getMessageHash(hnftId, hNFTContractAddr, governanceTokenAddress, governanceTokenAmount, curBidId, preBidId)
        );
        return ECDSA.recover(_msgHash, _signature);
    }

    // --- Private Function ---
    function _isAtLeast120Percent(uint256 lastBidAmount, uint256 bidAmount) private pure returns(bool) {
        uint256 result = lastBidAmount.mul(12).div(10);
        return bidAmount >= result;
    }

    function _generateRandomNumber() private view returns (uint256) {
        bytes32 blockHash = blockhash(block.number);
        bytes memory concatData = abi.encodePacked(blockHash, block.timestamp, block.coinbase);
        bytes32 hash = keccak256(concatData);
        return uint256(hash);
    }

    function getMessageHash(uint256 hnftId, address hNFTContractAddr, 
                            address governanceTokenAddress, uint256 governanceTokenAmount, 
                            uint256 curBidId, uint256 preBidId) private pure returns (bytes32){
        return keccak256(abi.encodePacked(hnftId, hNFTContractAddr, governanceTokenAddress, governanceTokenAmount, curBidId, preBidId));
    }

    function verify(address _signerAddress) private view returns (bool) {
        return _signerAddress == relayerAddress;
    }
}