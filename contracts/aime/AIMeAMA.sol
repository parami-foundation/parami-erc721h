// SPDX-License-Identifier: MIT
pragma solidity >=0.8.2 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./AIMePower.sol";

contract AIMeAMA is Ownable {
    using SafeMath for uint256;
    
    address public attester;
    uint256 public AIME_CREATOR_POWER_AMOUNT = 7e17;
    uint256 public AIME_REWARD_AMOUNT = 3e17;
    uint256 public AMA_CREDIT_PRICE = 0.01 ether;

    event AIMeCreated(address aimeOwnerAddress, address powerAddress);
    event CreditPurchased(address userAddress);
    event AIMeRewardClaimed(address aimeAddress, address to, uint256 amount);

    mapping(address => address) public aimePowerAddress;

    mapping(address => uint256) public amaCreditBalance;

    mapping(address => mapping(uint256 => bool)) public addressNonceUsed;

    function setAttester(address _attester) public onlyOwner {
        attester = _attester;
    }

    function createAIMe(string memory name, string memory symbol) public {
        require(
            aimePowerAddress[msg.sender] == address(0),
            "AIMe already created"
        );
        AIMePower aimePower = new AIMePower(name, symbol);
        aimePower.mint(msg.sender, AIME_CREATOR_POWER_AMOUNT);
        aimePower.mint(address(this), AIME_REWARD_AMOUNT);

        address powerAddress = address(aimePower);
        aimePowerAddress[msg.sender] = powerAddress;

        emit AIMeCreated(msg.sender, powerAddress);
    }

    function buyAMACredit(uint256 amount) external payable {
        require(msg.value == AMA_CREDIT_PRICE * amount, "Please pay exact price for each credit");
        amaCreditBalance[msg.sender] += amount;
        emit CreditPurchased(msg.sender);
    }

    function claimPowers(
        address aimeAddress,
        uint256 amount,
        uint256 nonce,
        bytes memory signature
    ) external returns (bool) {
        require(aimePowerAddress[aimeAddress] != address(0), "Invalid AIMe");

        // check nonce
        require(!addressNonceUsed[msg.sender][nonce], "Nonce used");
        addressNonceUsed[msg.sender][nonce] = true;

        // check sig
        bytes32 hash = keccak256(
            abi.encodePacked(
                "AMAPowerReward",
                aimeAddress,
                msg.sender,
                amount,
                nonce
            )
        );
        _validateSigner(hash, signature);

        // send power
        IERC20 power = IERC20(aimePowerAddress[aimeAddress]);
        power.transfer(msg.sender, amount);

        // emit event
        emit AIMeRewardClaimed(aimeAddress, msg.sender, amount);
        
        return true;
    }

    function withdraw() external onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }

    function _validateSigner(
        bytes32 hash,
        bytes memory signature
    ) private view returns (bool) {
        // convert to EthSignedMessage hash
        bytes32 message = ECDSA.toEthSignedMessageHash(hash);
        // recover signer address
        address receivedAddress = ECDSA.recover(message, signature);
        // verify recevivedAddress with signer
        require(
            receivedAddress != address(0) && receivedAddress == attester,
            "signature not valid"
        );
        return true;
    }
}