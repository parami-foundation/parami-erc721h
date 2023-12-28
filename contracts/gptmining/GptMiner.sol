// SPDX-License-Identifier: MIT
pragma solidity >=0.8.2 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./GPTPower.sol";

contract GPTMiner is Ownable {
    using SafeMath for uint256;

    uint256 public constant DURATION = 1 days;
    uint256 public constant boostUnit = 0.01 ether;
    uint256 public constant totalReward = 1e18;
    address public gptPowerAddress;

    // constructor() Ownable(msg.sender) {}

    constructor() {
        GPTPower powerToken = new GPTPower("GPT Power", "GPT");
        gptPowerAddress = address(powerToken);
        powerToken.mint(address(this), totalReward);
    }

    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored; // todo: change name
    uint256 public totalSupply = 0; // miningTokenTotalSupply
    mapping(address => uint256) public balances; // miningTokenBalances
    mapping(address => uint256) public rewards;
    mapping(address => uint256) public userRewardPerTokenPaid;

    // todo: change name
    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event MiningStarted();

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return Math.min(block.timestamp, periodFinish);
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable()
                    .sub(lastUpdateTime)
                    .mul(rewardRate)
                    .mul(1e18)
                    .div(totalSupply)
            );
    }

    function earned(address account) public view returns (uint256) {
        return
            balances[account]
                .mul(rewardPerToken().sub(userRewardPerTokenPaid[account]))
                .div(1e18)
                .add(rewards[account]);
    }

    // todo: add signature
    function mine(address referrer) public {
        require(rewardRate != 0, "Mining not started");
        require(balances[msg.sender] == 0, "Already mining");

        // referrer checks
        require(referrer != msg.sender, "Cannot refer yourself");
        require(balances[referrer] != 0, "Referrer not valid");

        // todo: validate signature

        // todo: change mining token amount
        _addMiningToken(referrer, 1);
        _addMiningToken(msg.sender, 1);
    }

    function boost() public payable {
        require(balances[msg.sender] != 0, "Call mine first");
        require(msg.value >= boostUnit, "Insufficient payment");

        uint256 boostAmount = msg.value.div(boostUnit);
        _addMiningToken(msg.sender, boostAmount);

        // todo: emit boost event
    }

    function _addMiningToken(
        address account,
        uint256 amount
    ) private updateReward(account) {
        totalSupply = totalSupply.add(amount);
        balances[account] = balances[account].add(amount);
    }

    // todo: change to claim reward
    function getReward() public updateReward(msg.sender) {
        uint256 reward = earned(msg.sender);
        if (reward > 0) {
            rewards[msg.sender] = 0;
            // todo: transfer power to msg.sender (or mint at here)
            GPTPower(gptPowerAddress).transfer(msg.sender, reward);
            // yfi.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    // start mining
    function startMining() external onlyOwner {
        require(rewardRate == 0, "Already started");
        rewardRate = totalReward.div(DURATION);
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(DURATION);
        _addMiningToken(msg.sender, 1);
        emit MiningStarted();
    }

    // function notifyRewardAmount(
    //     uint256 reward
    // ) external onlyOwner updateReward(address(0)) {
    //     if (block.timestamp >= periodFinish) {
    //         rewardRate = reward.div(DURATION);
    //     } else {
    //         uint256 remaining = periodFinish.sub(block.timestamp);
    //         uint256 leftover = remaining.mul(rewardRate);
    //         rewardRate = reward.add(leftover).div(DURATION);
    //     }
    //     lastUpdateTime = block.timestamp;
    //     periodFinish = block.timestamp.add(DURATION);
    //     emit RewardAdded(reward);
    // }
}
