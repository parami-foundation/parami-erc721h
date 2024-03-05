// SPDX-License-Identifier: MIT
pragma solidity >=0.8.2 <0.9.0;

import "./AIMeNFT.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract AIMeFactory is Ownable {
    address public signer;

    constructor() Ownable(msg.sender) {}

    event AIMeCreated(address creator, address aimeAddress);
    event AIMeNFTMinted(
        address creator,
        address aimeAddress,
        uint256 tokenId,
        string key,
        string infoType,
        string content,
        uint256 amount
    );
    event AIMeNFTUpdated(
        address nftOwner,
        address aimeAddress,
        uint256 tokenId,
        string content
    );

    // todo: change this
    mapping(address => address) public aimeContracts;
    mapping(address => mapping(uint256 => bool)) public addressNonceUsed;
    mapping(address => uint256) public addressNonce;

    function updateSigner(address _signer) external onlyOwner {
        signer = _signer;
    }

    function _genMessageHash(
        address creatorAddress,
        address aimeAddress,
        string memory key,
        string memory infoType,
        string memory content,
        uint256 amount,
        uint256 nonce
    ) private pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    creatorAddress,
                    aimeAddress,
                    key,
                    infoType,
                    content,
                    amount,
                    nonce
                )
            );
    }

    function createAIME(
        string memory name_,
        string memory symbol_,
        string memory avatar_,
        string memory bio_,
        string memory bio_image_,
        uint256 nonce,
        bytes memory signature,
        uint256 creatorRewardAmount
    ) public returns (address) {
        // todo: validate signature
        // todo: require nonce = currentNonce
        bytes32 _msgHash = MessageHashUtils.toEthSignedMessageHash(
            _genMessageHash(msg.sender, msg.sender, "basic_prompt", "static", bio_, 0, nonce)
        );
        // require(signer != address(0) && ECDSA.recover(_msgHash, signature) == signer, "Invalid signature");
        // todo: nonce++

        AIMeNFT aime = new AIMeNFT(name_, symbol_, avatar_, bio_, bio_image_, msg.sender, creatorRewardAmount);
        aimeContracts[msg.sender] = address(aime);
        emit AIMeCreated(msg.sender, address(aime));
        return address(aime);
    }

    function mintAIMeNFT(
        address aimeAddress,
        string memory key,
        string memory infoType,
        string memory content,
        string memory image,
        uint256 amount,
        uint256 nonce,
        bytes memory signature
    ) public {
        // todo: validate signature
        // todo: require nonce = currentNonce
        bytes32 _msgHash = MessageHashUtils.toEthSignedMessageHash(
            _genMessageHash(msg.sender, aimeAddress, key, infoType, content, amount, nonce)
        );
        // require(signer != address(0) && ECDSA.recover(_msgHash, signature) == signer, "Invalid signature");
        // todo: nonce++

        AIMeNFT aime = AIMeNFT(aimeAddress);
        uint256 tokenId = aime.safeMint(msg.sender, key, infoType, content, image, amount);
        emit AIMeNFTMinted(
            msg.sender,
            aimeAddress,
            tokenId,
            key,
            infoType,
            content,
            amount
        );
    }

    function updateAIMeNFT(
        address aimeAddress,
        uint256 tokenId,
        string memory content
    ) public {
        // todo: check all args and signature
        AIMeNFT aime = AIMeNFT(aimeAddress);
        aime.updateAIMeInfo(tokenId, msg.sender, content);
        emit AIMeNFTUpdated(msg.sender, aimeAddress, tokenId, content);
    }
}
