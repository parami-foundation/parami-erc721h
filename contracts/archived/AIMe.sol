// SPDX-License-Identifier: MIT
pragma solidity >=0.8.2 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract AIMePowers is Ownable {
    address public protocolFeeDestination;
    uint256 public protocolFeePercent;
    uint256 public subjectFeePercent;
    uint256 public initSupply = 3000;
    uint256 public maxSupply = 10000;
    address public attester;

    /**
     * @dev address - nounce - used
     * @notice used if true, not used if false
     **/
    mapping(address => mapping(uint256 => bool)) public addressNonceUsed;

    event Trade(address trader, address subject, bool isBuy, uint256 shareAmount, uint256 ethAmount, uint256 protocolEthAmount, uint256 subjectEthAmount, uint256 supply);

    // SharesSubject => (Holder => Balance)
    mapping(address => mapping(address => uint256)) public sharesBalance;

    // SharesSubject => Balance
    mapping(address => uint256) public sharesRewardsBalance;

    // SharesSubject => Supply
    mapping(address => uint256) public sharesSupply;

    function setAttester(address _attester) public onlyOwner {
        attester = _attester;
    }

    function setFeeDestination(address _feeDestination) public onlyOwner {
        protocolFeeDestination = _feeDestination;
    }

    function setProtocolFeePercent(uint256 _feePercent) public onlyOwner {
        protocolFeePercent = _feePercent;
    }

    function setSubjectFeePercent(uint256 _feePercent) public onlyOwner {
        subjectFeePercent = _feePercent;
    }

    function getPrice(uint256 supply, uint256 amount) public view returns (uint256) {
        if (supply < initSupply) {
            return 0;
        }
        uint256 sum1 = (supply - initSupply) * (supply - initSupply);
        uint256 sum2 = (supply - initSupply + amount) * (supply - initSupply + amount);
        uint256 summation = sum2 - sum1;
        return summation * 1 ether / 1000;
    }

    function getBuyPrice(address sharesSubject, uint256 amount) public view returns (uint256) {
        return getPrice(sharesSupply[sharesSubject], amount);
    }

    function getSellPrice(address sharesSubject, uint256 amount) public view returns (uint256) {
        return getPrice(sharesSupply[sharesSubject] - amount, amount);
    }

    function getBuyPriceAfterFee(address sharesSubject, uint256 amount) public view returns (uint256) {
        uint256 price = getBuyPrice(sharesSubject, amount);
        uint256 protocolFee = price * protocolFeePercent / 1 ether;
        uint256 subjectFee = price * subjectFeePercent / 1 ether;
        return price + protocolFee + subjectFee;
    }

    function getSellPriceAfterFee(address sharesSubject, uint256 amount) public view returns (uint256) {
        uint256 price = getSellPrice(sharesSubject, amount);
        uint256 protocolFee = price * protocolFeePercent / 1 ether;
        uint256 subjectFee = price * subjectFeePercent / 1 ether;
        return price - protocolFee - subjectFee;
    }

    function initShares(address sharesSubject) public {
        require(sharesSubject == msg.sender, "Only the shares' subject can initailize shares");
        require(sharesSupply[sharesSubject] == 0, "Already initialized");
        sharesSupply[sharesSubject] = initSupply;
        sharesRewardsBalance[sharesSubject] = initSupply;
    }

    function buyShares(address sharesSubject, uint256 amount) public payable {
        uint256 supply = sharesSupply[sharesSubject];
        require(supply >= initSupply, "Should be initialized first");
        require(supply + amount <= maxSupply, "Exceed hard cap");
        uint256 price = getPrice(supply, amount);
        uint256 protocolFee = price * protocolFeePercent / 1 ether;
        uint256 subjectFee = price * subjectFeePercent / 1 ether;
        require(msg.value >= price + protocolFee + subjectFee, "Insufficient payment");
        sharesBalance[sharesSubject][msg.sender] = sharesBalance[sharesSubject][msg.sender] + amount;
        sharesSupply[sharesSubject] = supply + amount;
        emit Trade(msg.sender, sharesSubject, true, amount, price, protocolFee, subjectFee, supply + amount);
        (bool success1, ) = protocolFeeDestination.call{value: protocolFee}("");
        (bool success2, ) = sharesSubject.call{value: subjectFee}("");
        require(success1 && success2, "Unable to send funds");
    }

    function sellShares(address sharesSubject, uint256 amount) public payable {
        uint256 supply = sharesSupply[sharesSubject];
        require(supply > amount, "Cannot sell the last share");
        uint256 price = getPrice(supply - amount, amount);
        uint256 protocolFee = price * protocolFeePercent / 1 ether;
        uint256 subjectFee = price * subjectFeePercent / 1 ether;
        require(sharesBalance[sharesSubject][msg.sender] >= amount, "Insufficient shares");
        sharesBalance[sharesSubject][msg.sender] = sharesBalance[sharesSubject][msg.sender] - amount;
        sharesSupply[sharesSubject] = supply - amount;
        emit Trade(msg.sender, sharesSubject, false, amount, price, protocolFee, subjectFee, supply - amount);
        (bool success1, ) = msg.sender.call{value: price - protocolFee - subjectFee}("");
        (bool success2, ) = protocolFeeDestination.call{value: protocolFee}("");
        (bool success3, ) = sharesSubject.call{value: subjectFee}("");
        require(success1 && success2 && success3, "Unable to send funds");
    }

    function claimShare(
        address sharesSubject,
        uint256 amount,
        uint256 nonce,
        bytes memory signature
    ) external returns (bool) {
        uint256 rewardsBalance = sharesRewardsBalance[sharesSubject];
        require(rewardsBalance >= amount, "Rewards run out");

        // cal message hash
        bytes32 hash = keccak256(
            abi.encodePacked(msg.sender, sharesSubject, amount, nonce)
        );
        // convert to EthSignedMessage hash
        bytes32 message = ECDSA.toEthSignedMessageHash(hash);
        // recover signer address
        address receivedAddress = ECDSA.recover(message, signature);
        // verify recevivedAddress with signer
        require(
            receivedAddress != address(0) && receivedAddress == attester,
            "signature not valid"
        );
        require(addressNonceUsed[msg.sender][nonce] == false, "nonce used");
        addressNonceUsed[msg.sender][nonce] = true;
        sharesBalance[sharesSubject][msg.sender] = sharesBalance[sharesSubject][msg.sender] + amount;
        sharesRewardsBalance[sharesSubject] = rewardsBalance - amount;
        return true;
    }
}