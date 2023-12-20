// SPDX-License-Identifier: MIT
pragma solidity >=0.8.2 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract AIMePowersV5 is Ownable {
    address public protocolFeeDestination;
    uint8 public constant protocolFeePercent = 5; // 5%
    uint8 public constant referrerFeePercent = 3; // 3%
    uint8 public constant DECIMALS = 4;
    uint32 public constant CREATOR_INIT_AMOUNT = 10000;

    // constructor() Ownable(msg.sender) {}

    event Trade(
        address trader,
        address aimeAddress,
        bool isBuy,
        uint256 powerAmount,
        uint256 feeAmount,
        uint256 priceAfterFee,
        address referrerAddress,
        uint256 supply
    );

    // PowerAddress => (Holder => Balance)
    mapping(address => mapping(address => uint256)) public powerBalance;

    // referred => referrer
    mapping(address => address) public referrer;

    // PowerAddress => Supply
    mapping(address => uint256) public powersSupply;

    // PowerAddress => Pool (ETH)
    mapping(address => uint256) public pool;

    function setFeeDestination(address _feeDestination) public onlyOwner {
        protocolFeeDestination = _feeDestination;
    }

    function setReferrer(address referrerAddress) public {
        require(referrer[msg.sender] == address(0), "Cannot change referrer");
        require(msg.sender != referrerAddress, "Cannot refer yourself");
        referrer[msg.sender] = referrerAddress;
    }

    function feePercentage() public view returns (uint8) {
        return
            referrer[msg.sender] == address(0)
                ? protocolFeePercent
                : referrerFeePercent;
    }

    function _calculateFeeAmount(
        uint256 amount
    ) private view returns (uint256) {
        return
            referrer[msg.sender] == address(0)
                ? (amount * protocolFeePercent) / 100
                : (amount * referrerFeePercent) / 100;
    }

    function _price_curve(uint256 x) private pure returns (uint256) {
        return
            x <= CREATOR_INIT_AMOUNT
                ? 0
                : ((x - CREATOR_INIT_AMOUNT) *
                    (x) *
                    (2 * (x - CREATOR_INIT_AMOUNT) + 1)) / 6;
    }

    function getPrice(
        uint256 supply,
        uint256 amount
    ) public pure returns (uint256) {
        return
            ((_price_curve(supply + amount) - _price_curve(supply)) * 1 ether) /
            16000 /
            10000 /
            10000 /
            10000;
    }

    function getBuyPrice(
        address powerAddress,
        uint256 amount
    ) public view returns (uint256) {
        return getPrice(powersSupply[powerAddress], amount);
    }

    function getSellPrice(
        address powerAddress,
        uint256 amount
    ) public view returns (uint256) {
        return getPrice(powersSupply[powerAddress] - amount, amount);
    }

    function getBuyPriceAfterFee(
        address powerAddress,
        uint256 amount
    ) public view returns (uint256) {
        uint256 feeAmount = _calculateFeeAmount(amount);
        uint256 price = getBuyPrice(powerAddress, amount + feeAmount);
        return price;
    }

    function getSellPriceAfterFee(
        address powerAddress,
        uint256 amount
    ) public view returns (uint256) {
        uint256 feeAmount = _calculateFeeAmount(amount);
        uint256 price = getSellPrice(powerAddress, amount - feeAmount);
        return price;
    }

    function initAIME() public {
        require(powersSupply[msg.sender] == 0, "Already initialized");
        powerBalance[msg.sender][msg.sender] = CREATOR_INIT_AMOUNT;
        powersSupply[msg.sender] = CREATOR_INIT_AMOUNT;
    }

    function buyPowers(address powerAddress, uint256 amount) public payable {
        require(powersSupply[powerAddress] > 0, "Not initialized");
        require(amount > 0, "Amount must be greater than 0");
        uint256 feeAmount = _calculateFeeAmount(amount);
        uint256 priceAfterFee = getBuyPrice(powerAddress, amount + feeAmount);
        require(msg.value >= priceAfterFee, "Insufficient payment");

        // user balance
        powerBalance[powerAddress][msg.sender] =
            powerBalance[powerAddress][msg.sender] +
            amount;

        // referrer balance
        address feeReceiver = referrer[msg.sender] == address(0)
            ? protocolFeeDestination
            : referrer[msg.sender];
        powerBalance[powerAddress][feeReceiver] =
            powerBalance[powerAddress][feeReceiver] +
            feeAmount;

        // power
        powersSupply[powerAddress] += amount + feeAmount;
        pool[powerAddress] += priceAfterFee;

        emit Trade(
            msg.sender,
            powerAddress,
            true,
            amount,
            feeAmount,
            priceAfterFee,
            referrer[msg.sender],
            powersSupply[powerAddress]
        );
    }

    function sellPowers(address powerAddress, uint256 amount) public {
        require(
            powerBalance[powerAddress][msg.sender] >= amount,
            "Insufficient powers"
        );

        uint256 supply = powersSupply[powerAddress];
        require(
            supply - amount >= CREATOR_INIT_AMOUNT,
            "Cannot sell the last power"
        );

        uint256 feeAmount = _calculateFeeAmount(amount);
        uint256 priceAfterFee = getSellPrice(powerAddress, amount - feeAmount);

        // user balance
        powerBalance[powerAddress][msg.sender] =
            powerBalance[powerAddress][msg.sender] -
            amount;

        // referrer balance
        address feeReceiver = referrer[msg.sender] == address(0)
            ? protocolFeeDestination
            : referrer[msg.sender];
        powerBalance[powerAddress][feeReceiver] =
            powerBalance[powerAddress][feeReceiver] +
            feeAmount;

        // power
        powersSupply[powerAddress] = supply - amount + feeAmount;
        pool[powerAddress] -= priceAfterFee;

        (bool success, ) = msg.sender.call{value: priceAfterFee}("");

        require(success, "Unable to send funds");

        emit Trade(
            msg.sender,
            powerAddress,
            false,
            amount,
            feeAmount,
            priceAfterFee,
            referrer[msg.sender],
            supply - amount + feeAmount
        );
    }
}
