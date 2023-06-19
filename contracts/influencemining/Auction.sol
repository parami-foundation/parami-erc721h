//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../IERC721H.sol";
import "./HNFTGovernance.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract Auction is OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;

    struct Bid {
        uint256 bidId;
        uint256 amount;
        address bidder;
        string  slotUri;
        address governanceTokenAddr;
    }

    struct PreBid {
        uint256 bidId;
        uint256 amount;
        address bidder;
        uint256 preBidTime;
        address governanceTokenAddr;
    }

    struct HNFTInfo {
        uint256 hNFTId;
        address hNFTContractAddr;
    }

    struct PrepareBidInfo {
        uint256 bidId;
        uint256 amount;
        address bidder;
        uint256 preBidTime;
        address governanceTokenAddr;
        uint256 curBidId;
    }


    address private relayerAddress;
    address private ad3Address;
    address private hnftGoverAddress;
    mapping(address => mapping(uint256 => Bid)) public curBid;
    mapping(address => mapping(uint256 => PreBid)) public preBids;

    uint256 private MIN_DEPOIST_FOR_PRE_BID;
    uint256 private TIMEOUT;

    // hNFTContractAddress => (hNFTId => (bidderAddress => preBidAmount))
    mapping(address => mapping(uint256 => mapping(address => uint256))) preBidsAmount;

    /**
     * @dev address - nounce - used
     * @notice used if true, not used if false
     **/
    mapping(address => mapping(uint256 => bool)) public addressNonceUsed;

    function initialize(address _relayerAddress, address _ad3Address, address _hnftGoverAddress) public initializer {
        __Ownable_init();
        relayerAddress = _relayerAddress;
        ad3Address = _ad3Address;
        hnftGoverAddress = _hnftGoverAddress;
        MIN_DEPOIST_FOR_PRE_BID = 10;
        TIMEOUT = 10 minutes;
    }

    event BidPrepared(address hNFTContractAddr, uint256 indexed curBidId, uint256 indexed preBidId,  address bidder, address goverAddr);
    event BidCommitted(address hNFTContractAddr, uint256 indexed curBidId, uint256 indexed preBidId, address bidder);
    event BidRefunded(uint256 bidId, uint256 hNFTId, address to, uint256 amount);

    function preBid(address hNFTContractAddr, uint256 hNFTId) public {
        require(hNFTId > 0, "hNFTId must be greater than 0.");
        require(block.timestamp >= preBids[hNFTContractAddr][hNFTId].preBidTime.add(TIMEOUT), "Last preBid still within the valid time");
        IERC721H hNFTContract = IERC721H(hNFTContractAddr);
        require(hNFTContract.isSlotAuthorized(hNFTId, address(this)), "not slotManager or hnftId not exist");
        IERC20 ad3Add = IERC20(ad3Address);
        require(ad3Add.balanceOf(_msgSender()) >= MIN_DEPOIST_FOR_PRE_BID, "AD3 balance not enough");
        require(ad3Add.allowance(_msgSender(), address(this)) >= MIN_DEPOIST_FOR_PRE_BID, "allowance not enough");
        ad3Add.transferFrom(_msgSender(), address(this), MIN_DEPOIST_FOR_PRE_BID);
        uint256 preBidId = _generateRandomNumber();
        address governanceTokenAddr = HNFTGovernance(hnftGoverAddress).getGovernanceToken(hNFTContractAddr, hNFTId);
        governanceTokenAddr = governanceTokenAddr == address(0) ? ad3Address : governanceTokenAddr;
        address lastBidderAddress = preBids[hNFTContractAddr][hNFTId].bidder;
        if (lastBidderAddress != address(0)) {
            preBidsAmount[hNFTContractAddr][hNFTId][lastBidderAddress] = preBidsAmount[hNFTContractAddr][hNFTId][lastBidderAddress] + MIN_DEPOIST_FOR_PRE_BID;
        }
        preBids[hNFTContractAddr][hNFTId]= PreBid(preBidId, MIN_DEPOIST_FOR_PRE_BID, _msgSender(), block.timestamp, governanceTokenAddr);
        uint256 curBidId = curBid[hNFTContractAddr][hNFTId].bidId != 0 ? curBid[hNFTContractAddr][hNFTId].bidId : 0;

        emit BidPrepared(hNFTContractAddr ,curBidId, preBidId, _msgSender(), governanceTokenAddr);
    }

    function commitBid(
        HNFTInfo memory hNFTInfo,
        uint256 governanceTokenAmount,
        string memory slotUri,
        bytes memory _signature,
        uint256 curBidId,
        uint256 preBidId,
        uint256 curBidRemain
    ) public {
        require(hNFTInfo.hNFTId > 0, "hNFTId must be greater than 0.");
        require(governanceTokenAmount > 0, "Bid amount must be greater than 0.");
        require(hNFTInfo.hNFTContractAddr != address(0), "The hNFT and governance contract can not be address(0).");
        require(curBidId == curBid[hNFTInfo.hNFTContractAddr][hNFTInfo.hNFTId].bidId, "Invalid curBidId");
        require(preBidId == preBids[hNFTInfo.hNFTContractAddr][hNFTInfo.hNFTId].bidId, "Invalid preBidId");
        IERC20 token = IERC20(preBids[hNFTInfo.hNFTContractAddr][hNFTInfo.hNFTId].governanceTokenAddr);
        require(token.balanceOf(_msgSender()) >= governanceTokenAmount, "balance not enough");
        require(token.allowance(_msgSender(), address(this)) >= governanceTokenAmount, "allowance not enough");
        address _signAddress = recover(hNFTInfo.hNFTId, hNFTInfo.hNFTContractAddr, address(token), governanceTokenAmount, curBidId, preBidId, _signature);
        require(verify(_signAddress), "Invalid Signer!");
        address currentBidTokenAddr = curBid[hNFTInfo.hNFTContractAddr][hNFTInfo.hNFTId].governanceTokenAddr;
        if (currentBidTokenAddr == address(token)) {
            require(_isAtLeast120Percent(curBidRemain, governanceTokenAmount), "The bid is less than 120%");
        }
        require(_msgSender() == preBids[hNFTInfo.hNFTContractAddr][hNFTInfo.hNFTId].bidder, "Not the preBid owner");

        _refundPrevBidIfRequired(hNFTInfo.hNFTContractAddr, hNFTInfo.hNFTId, curBidRemain);
        _processCurBid(token, governanceTokenAmount, hNFTInfo.hNFTContractAddr, hNFTInfo.hNFTId, slotUri, curBidRemain, preBidId);
        
        emit BidCommitted(hNFTInfo.hNFTContractAddr, curBidId, preBidId, _msgSender());
    }

    function setRelayerAddress(address _relayerAddress) public onlyOwner {
        relayerAddress = _relayerAddress;
    }

    function getRelayerAddress() public onlyOwner view returns (address){
        return relayerAddress ;
    }

    function setHNFTGoverAddress(address _hnftGoverAddress) public onlyOwner {
        hnftGoverAddress = _hnftGoverAddress;
    }

    function getHNFTGoverAddress() public onlyOwner view returns (address){
        return hnftGoverAddress ;
    }

    function setMinDepositForPreBid (uint256 _MIN_DEPOIST_FOR_PRE_BID) public onlyOwner {
        MIN_DEPOIST_FOR_PRE_BID = _MIN_DEPOIST_FOR_PRE_BID;
    }

    function getMinDepositForPreBid () public onlyOwner view returns (uint256){
        return MIN_DEPOIST_FOR_PRE_BID;
    }

    function recover(uint256 hnftId, address hNFTContractAddr, 
                     address governanceTokenAddress, uint256 governanceTokenAmount, 
                     uint256 curBidId, uint256 preBidId, bytes memory _signature) public pure returns (address) {
        bytes32 _msgHash = ECDSA.toEthSignedMessageHash(
            genMessageHash(hnftId, hNFTContractAddr, governanceTokenAddress, governanceTokenAmount, curBidId, preBidId)
        );
        return ECDSA.recover(_msgHash, _signature);
    }

    function getPrepareBidInfo(address hNFTAddr, uint256 hNFTId) public view returns (PrepareBidInfo memory) {
        PreBid memory preBid = preBids[hNFTAddr][hNFTId];
        PrepareBidInfo memory params = PrepareBidInfo({
            bidId: preBid.bidId,
            amount: preBid.amount,
            bidder: preBid.bidder,
            preBidTime: preBid.preBidTime,
            governanceTokenAddr: preBid.governanceTokenAddr,
            curBidId: curBid[hNFTAddr][hNFTId].bidId
        });

        return params;
    }

    function withdrawGovernanceToken(
        address governanceTokenAddress,
        address to,
        uint256 amount,
        uint256 nounce,
        bytes memory signature
    ) public returns (bool) {
        // cal message hash
        bytes32 hash = keccak256(
            abi.encodePacked(to, amount, nounce)
        );
        // convert to EthSignedMessage hash
        bytes32 message = ECDSA.toEthSignedMessageHash(hash);
        // recover signer address
        address receivedAddress = ECDSA.recover(message, signature);
        // verify recevivedAddress with signer
        require(
            receivedAddress != address(0) && receivedAddress == relayerAddress,
            "signature not valid"
        );
        
        require(addressNonceUsed[to][nounce] == false, "nounce must not used");
        addressNonceUsed[to][nounce] = true;
        IERC20 goverTokenAddr = IERC20(governanceTokenAddress);
        goverTokenAddr.transfer(to, amount);
        return true;
    }

    function withdrawPreBidAmount(
        address hNftAddr, uint256 hNFTId
    ) public returns (bool) {
        require(preBidsAmount[hNftAddr][hNFTId][_msgSender()] > 0, "No remain preBid Amount");
        IERC20 ad3Addr = IERC20(ad3Address);
        uint256 preBidAmount = preBidsAmount[hNftAddr][hNFTId][_msgSender()];
        ad3Addr.transfer(_msgSender(), preBidAmount);
        delete preBidsAmount[hNftAddr][hNFTId][_msgSender()];
        return true;
    }

    // --- Private Function ---
    function _processCurBid(
        IERC20 token, uint256 governanceTokenAmount, 
        address hNftAddr, uint256 hNFTId, 
        string memory slotUri, uint256 curBidRemain,
        uint256 preBidId
    ) private {
        IERC20 ad3Addr = IERC20(ad3Address);
        uint256 preAmount = preBids[hNftAddr][hNFTId].amount;
        delete preBids[hNftAddr][hNFTId];
        ad3Addr.transfer(_msgSender(), preAmount);

        token.transferFrom(_msgSender(), address(this), governanceTokenAmount);
        uint256 amount = governanceTokenAmount.sub(curBidRemain);
        token.approve(relayerAddress, amount.add(token.allowance(address(this), relayerAddress)));
        IERC721H(hNftAddr).setSlotUri(hNFTId, slotUri);

        curBid[hNftAddr][hNFTId] = Bid(preBidId, governanceTokenAmount, _msgSender(), slotUri, address(token));
    }

    function _refundPrevBidIfRequired(address hNFTContractAddr, uint256 hNFTId, uint256 curBidRemain) private {
        if(curBid[hNFTContractAddr][hNFTId].amount > 0) {
            Bid memory currentBid = curBid[hNFTContractAddr][hNFTId];
            IERC20(curBid[hNFTContractAddr][hNFTId].governanceTokenAddr).transfer(currentBid.bidder, curBidRemain);

            emit BidRefunded(currentBid.bidId, hNFTId, currentBid.bidder, currentBid.amount);
        }
    }
    
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

    function genMessageHash(uint256 hnftId, address hNFTContractAddr, 
                            address governanceTokenAddress, uint256 governanceTokenAmount, 
                            uint256 curBidId, uint256 preBidId) private pure returns (bytes32){
        return keccak256(abi.encodePacked(hnftId, hNFTContractAddr, governanceTokenAddress, governanceTokenAmount, curBidId, preBidId));
    }

    function verify(address _signerAddress) private view returns (bool) {
        return _signerAddress == relayerAddress;
    }
}