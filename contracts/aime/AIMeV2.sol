// // SPDX-License-Identifier: MIT
// pragma solidity >=0.8.2 <0.9.0;

// import "@openzeppelin/contracts/access/Ownable.sol";
// import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
// import "@openzeppelin/contracts/utils/math/SafeMath.sol";

// import "./AIMePower.sol";

// contract AIMe is Ownable {
//     using SafeMath for uint256;

//     struct Bid {
//         uint256 bidId;
//         string url;
//         string desc;
//         uint256 amount;
//         address advertiser;
//         uint256 time;
//     }

//     address public attester;
//     uint256 public TIMEOUT = 1 days;
//     uint256 public AIME_CREATOR_POWER_AMOUNT = 7e17;
//     uint256 public AIME_REWARD_AMOUNT = 3e17;
//     uint256 public AIME_MIN_BID_AMOUNT = 1e13;

//     event AIMeCreated(address aimeOwnerAddress, address powerAddress);
//     event AIMeAdBid(uint256 bidId, address aimeAddress, address advertiser);
//     event AdBidEnded(uint256 bidId, address aimeAddress, address advertiser);
//     event BidRefunded(
//         uint256 bidId,
//         address aimeAddress,
//         address to,
//         uint256 amount
//     );
//     event AdRewardClaimed(
//         uint256 bidId,
//         address aimeAddress,
//         address to,
//         uint256 amount
//     );
//     event AIMeRewardClaimed(address aimeAddress, address to, uint256 amount);

//     /**
//      * @dev address - nounce - used
//      * @notice used if true, not used if false
//      **/
//     mapping(address => mapping(uint256 => bool)) public addressNonceUsed;

//     // AIMe address => AIMe Power address
//     mapping(address => address) public aimePowerAddress;

//     mapping(address => Bid) public curBid;

//     mapping(address => uint256) public curBidRemain;

//     mapping(address => uint256) public aimeRewardBalance;

//     function _generateRandomNumber() private view returns (uint256) {
//         bytes32 blockHash = blockhash(block.number);
//         bytes memory concatData = abi.encodePacked(
//             blockHash,
//             block.timestamp,
//             block.coinbase
//         );
//         bytes32 hash = keccak256(concatData);
//         return uint256(hash);
//     }

//     function _validateSigner(
//         bytes32 hash,
//         bytes memory signature
//     ) private view returns (bool) {
//         // convert to EthSignedMessage hash
//         bytes32 message = ECDSA.toEthSignedMessageHash(hash);
//         // recover signer address
//         address receivedAddress = ECDSA.recover(message, signature);
//         // verify recevivedAddress with signer
//         require(
//             receivedAddress != address(0) && receivedAddress == attester,
//             "signature not valid"
//         );
//         return true;
//     }

//     function _isAtLeast120Percent(
//         uint256 lastBidAmount,
//         uint256 bidAmount
//     ) private pure returns (bool) {
//         uint256 result = lastBidAmount.mul(12).div(10);
//         return bidAmount >= result;
//     }

//     function setAttester(address _attester) public onlyOwner {
//         attester = _attester;
//     }

//     function createAIMe(string memory name, string memory symbol) public {
//         require(
//             aimePowerAddress[msg.sender] == address(0),
//             "AIMe already created"
//         );
//         AIMePower aimePower = new AIMePower(name, symbol);
//         aimePower.mint(msg.sender, AIME_CREATOR_POWER_AMOUNT);
//         aimePower.mint(address(this), AIME_REWARD_AMOUNT);
//         aimeRewardBalance[msg.sender] = AIME_REWARD_AMOUNT;

//         address powerAddress = address(aimePower);
//         aimePowerAddress[msg.sender] = powerAddress;

//         emit AIMeCreated(msg.sender, powerAddress);
//     }

//     function bidAd(
//         address aimeAddress,
//         string memory url,
//         string memory desc,
//         uint256 amount
//     ) public {
//         require(aimePowerAddress[aimeAddress] != address(0), "Invalid AIMe");
//         require(amount >= AIME_MIN_BID_AMOUNT, "Insufficient bid amount");
//         IERC20 power = IERC20(aimePowerAddress[aimeAddress]);

//         if (block.timestamp < curBid[aimeAddress].time + TIMEOUT) {
//             require(
//                 _isAtLeast120Percent(curBidRemain[aimeAddress], amount),
//                 "Insufficient bid price"
//             );
//         }

//         if (curBid[aimeAddress].bidId != 0) {
//             emit AdBidEnded(
//                 curBid[aimeAddress].bidId,
//                 aimeAddress,
//                 curBid[aimeAddress].advertiser
//             );
//         }

//         // transfer power from advertiser
//         require(power.balanceOf(msg.sender) >= amount, "balance not enough");
//         require(
//             power.allowance(msg.sender, address(this)) >= amount,
//             "allowance not enough"
//         );
//         power.transferFrom(msg.sender, address(this), amount);

//         // create new bid
//         uint256 newBidId = _generateRandomNumber();
//         curBid[aimeAddress] = Bid(
//             newBidId,
//             url,
//             desc,
//             amount,
//             msg.sender,
//             block.timestamp
//         );
//         curBidRemain[aimeAddress] = amount;
//         emit AIMeAdBid(newBidId, aimeAddress, msg.sender);
//     }

//     function claimBidRefund(
//         address aimeAddress,
//         uint256 bidId,
//         uint256 amount,
//         uint256 nonce,
//         bytes memory signature
//     ) external returns (bool) {
//         require(aimePowerAddress[aimeAddress] != address(0), "Invalid AIMe");
//         IERC20 power = IERC20(aimePowerAddress[aimeAddress]);

//         // cal message hash
//         bytes32 hash = keccak256(
//             abi.encodePacked(
//                 "BidRefund",
//                 aimeAddress,
//                 bidId,
//                 msg.sender,
//                 amount,
//                 nonce
//             )
//         );
//         _validateSigner(hash, signature);

//         // refund powers
//         power.transfer(msg.sender, amount);
//         emit BidRefunded(bidId, aimeAddress, msg.sender, amount);
//         return true;
//     }

//     function claimAdReward(
//         address aimeAddress,
//         uint256 bidId,
//         uint256 amount,
//         uint256 nonce,
//         bytes memory signature
//     ) external returns (bool) {
//         require(aimePowerAddress[aimeAddress] != address(0), "Invalid AIMe");
//         IERC20 power = IERC20(aimePowerAddress[aimeAddress]);

//         // cal message hash
//         bytes32 hash = keccak256(
//             abi.encodePacked(
//                 "AdReward",
//                 aimeAddress,
//                 bidId,
//                 msg.sender,
//                 amount,
//                 nonce
//             )
//         );
//         _validateSigner(hash, signature);

//         // send power
//         if (curBid[aimeAddress].bidId == bidId) {
//             curBidRemain[aimeAddress] -= amount;
//         }
//         power.transfer(msg.sender, amount);

//         emit AdRewardClaimed(
//             curBid[aimeAddress].bidId,
//             aimeAddress,
//             msg.sender,
//             amount
//         );
//         return true;
//     }

//     function claimAIMeReward(
//         address aimeAddress,
//         uint256 amount,
//         uint256 nonce,
//         bytes memory signature
//     ) external returns (bool) {
//         require(aimePowerAddress[aimeAddress] != address(0), "Invalid AIMe");
//         IERC20 power = IERC20(aimePowerAddress[aimeAddress]);

//         // cal message hash
//         bytes32 hash = keccak256(
//             abi.encodePacked(
//                 "AIMeReward",
//                 aimeAddress,
//                 msg.sender,
//                 amount,
//                 nonce
//             )
//         );
//         _validateSigner(hash, signature);

//         // send power
//         require(aimeRewardBalance[aimeAddress] >= amount, "Rewards run out");
//         aimeRewardBalance[aimeAddress] -= amount;
//         power.transfer(msg.sender, amount);

//         emit AIMeRewardClaimed(aimeAddress, msg.sender, amount);
//         return true;
//     }
// }
