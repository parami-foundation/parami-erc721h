// SPDX-License-Identifier: MIT
pragma solidity >=0.8.2 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./GPTPower.sol";

contract GPTMinerV2 is Ownable {
    uint256 public constant DURATION = 7 days;
    uint256 public constant BOOST_AMOUNT_CAP = 1 ether;
    uint256 public constant BOOST_UNIT = 0.001 ether;
    uint256 public constant TOTAL_REWARD = 1000000000 * 1e18;
    uint256 public constant INTEL_BOOST_AMOUNT = 1;
    address public gptsTokenAddress;
    address public signer;
    address public receiver;

    constructor() Ownable(msg.sender) {
        GPTPower tokenContract = new GPTPower("GPTscription", "GPTs");
        gptsTokenAddress = address(tokenContract);
    }

    uint256 public miningStart = 0;
    uint256 public miningFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public totalSupply = 0;
    uint256 public miners = 0;

    mapping(address => uint256) public balances; // miningTokenBalances
    mapping(address => uint256) public rewards;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public userBoostAmount;
    mapping(uint256 => bool) public intelBoostNonceUsed;

    event BoostMining(address indexed user, uint256 value, uint256 boostAmount);
    event IntelBoost(address indexed user, uint256 value);
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

    function updateReceiver(address _receiver) external onlyOwner {
        require(_receiver != address(0), "Invalid receiver address");
        receiver = _receiver;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return Math.min(block.timestamp, miningFinish);
    }

    function _genMessageHash(
        address minerAddress
    ) private pure returns (bytes32) {
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
        require(block.timestamp < miningFinish, "Mining finished");

        // referrer checks
        require(referrer != msg.sender, "Cannot refer yourself");
        require(balances[referrer] != 0, "Referrer not valid");

        // validate signature
        bytes32 _msgHash = MessageHashUtils.toEthSignedMessageHash(
            _genMessageHash(msg.sender)
        );
        require(
            ECDSA.recover(_msgHash, signature) == signer,
            "Invalid signature"
        );

        _addMiningToken(referrer, 1);
        _addMiningToken(msg.sender, 1);
        miners += 1;
        emit NewMiner(msg.sender, referrer);
    }

    function intelBoost(bytes memory signature, uint256 nonce) external {
        require(balances[msg.sender] != 0, "Call mine first");
        require(!intelBoostNonceUsed[nonce], "Nonce already used");

        // validate signature
        bytes32 _msgHash = MessageHashUtils.toEthSignedMessageHash(
            keccak256(abi.encodePacked("IntelBoost:", msg.sender, nonce))
        );
        require(
            ECDSA.recover(_msgHash, signature) == signer,
            "Invalid signature"
        );

        intelBoostNonceUsed[nonce] = true;
        _addMiningToken(msg.sender, INTEL_BOOST_AMOUNT);
        emit IntelBoost(msg.sender, INTEL_BOOST_AMOUNT);
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

        uint256 boostMiningAmount = boostAmount / BOOST_UNIT;
        _addMiningToken(msg.sender, boostMiningAmount);
        emit BoostMining(msg.sender, msg.value, boostMiningAmount);
    }

    function _addMiningToken(
        address account,
        uint256 amount
    ) private updateReward(account) {
        totalSupply = totalSupply + amount;
        balances[account] = balances[account] + amount;
    }

    function getReward() public updateReward(msg.sender) {
        require(block.timestamp >= miningFinish, "Mining not yet finished");
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            GPTPower(gptsTokenAddress).mint(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    // start mining
    function startMining() external onlyOwner {
        require(signer != address(0), "Signer not set");
        require(rewardRate == 0, "Already started");
        rewardRate = TOTAL_REWARD / DURATION;
        lastUpdateTime = block.timestamp;
        miningStart = block.timestamp;
        miningFinish = block.timestamp + DURATION;
        _addMiningToken(msg.sender, 1);
        miners += 1;
        emit MiningStarted();
    }

    function withdraw() external onlyOwner {
        payable(receiver).transfer(address(this).balance);
    }
}
