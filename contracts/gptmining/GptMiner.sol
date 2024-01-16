// SPDX-License-Identifier: MIT
pragma solidity >=0.8.2 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./GPTMinerInscription.sol";

contract GPTMiner is Ownable {
    uint256 public constant DURATION = 7 days;
    uint256 public constant BOOST_AMOUNT_CAP = 1 ether;
    uint256 public constant BOOST_UNIT = 0.001 ether;
    uint256 public constant TOTAL_REWARD = 1e18;
    address public gptMinerInscriptionAddress;
    address public signer;

    constructor() Ownable(msg.sender) {
        GPTMinerInscription nftContract = new GPTMinerInscription();
        gptMinerInscriptionAddress = address(nftContract);
    }

    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public totalSupply = 0; // miningTokenTotalSupply
    
    mapping(address => uint256) public balances; // miningTokenBalances
    mapping(address => uint256) public rewards;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public userBoostAmount;

    event BoostMining(address indexed user, uint256 value, uint256 boostAmount);
    event RewardPaid(address indexed user, uint256 reward);
    event NewMiner(address indexed user, address referrer);
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

    function updateSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Invalid signer address");
        signer = _signer;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return Math.min(block.timestamp, periodFinish);
    }

    function _genMessageHash(address minerAddress) private pure returns (bytes32){
        return keccak256(abi.encodePacked("GPTMiner:", minerAddress));
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored +
            (((lastTimeRewardApplicable() - lastUpdateTime) *
                rewardRate *
                1e18) / totalSupply);
    }

    function earned(address account) public view returns (uint256) {
        return
            ((balances[account] *
                (rewardPerToken() - (userRewardPerTokenPaid[account]))) /
                1e18) + rewards[account];
    }

    function mine(address referrer, bytes memory signature) public {
        require(rewardRate != 0, "Mining not started");
        require(balances[msg.sender] == 0, "Already mining");
        require(block.timestamp < periodFinish, "Mining finished");

        // referrer checks
        require(referrer != msg.sender, "Cannot refer yourself");
        require(balances[referrer] != 0, "Referrer not valid");

        // validate signature
        bytes32 _msgHash = MessageHashUtils.toEthSignedMessageHash(_genMessageHash(msg.sender));
        require(ECDSA.recover(_msgHash, signature) == signer, "Invalid signature");

        _addMiningToken(referrer, 1);
        _addMiningToken(msg.sender, 1);
        emit NewMiner(msg.sender, referrer);
    }

    function boost() public payable {
        require(balances[msg.sender] != 0, "Call mine first");
        require(msg.value >= BOOST_UNIT, "Insufficient payment");

        uint256 currentAmount = userBoostAmount[msg.sender];
        userBoostAmount[msg.sender] += msg.value;
        
        if (currentAmount >= BOOST_AMOUNT_CAP) {
            emit BoostMining(msg.sender, msg.value, 0);
            return;
        }

        uint256 boostAmount;
        if (currentAmount + msg.value > BOOST_AMOUNT_CAP) {
            boostAmount = BOOST_AMOUNT_CAP - currentAmount;
        } else {
            boostAmount = msg.value;
        }

        uint256 boost = boostAmount / BOOST_UNIT;
        _addMiningToken(msg.sender, boost);
        emit BoostMining(msg.sender, msg.value, boost);
    }

    function _addMiningToken(
        address account,
        uint256 amount
    ) private updateReward(account) {
        totalSupply = totalSupply + amount;
        balances[account] = balances[account] + amount;
    }

    function getReward() public updateReward(msg.sender) {
        require(block.timestamp >= periodFinish, "Mining not yet finished");
        uint256 reward = earned(msg.sender);
        if (reward > 0) {
            rewards[msg.sender] = 0;
            GPTMinerInscription(gptMinerInscriptionAddress).safeMint(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    // start mining
    function startMining() external onlyOwner {
        require(signer != address(0), "Signer not set");
        require(rewardRate == 0, "Already started");
        rewardRate = TOTAL_REWARD / DURATION;
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + DURATION;
        _addMiningToken(msg.sender, 1);
        emit MiningStarted();
    }
}
