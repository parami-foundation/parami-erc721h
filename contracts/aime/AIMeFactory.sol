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
        string data,
        uint256 amount
    );
    event AIMeNFTUpdated(
        address nftOwner,
        address aimeAddress,
        uint256 tokenId,
        string data
    );

    mapping(address => uint256) public addressNonce;

    function updateSigner(address _signer) external onlyOwner {
        signer = _signer;
    }

    function _genMessageHash(
        address creatorAddress,
        address aimeAddress,
        string memory key,
        string memory dataType,
        string memory data,
        string memory avatar,
        string memory image,
        uint256 amount,
        uint256 nonce
    ) private pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    creatorAddress,
                    aimeAddress,
                    key,
                    dataType,
                    data,
                    avatar,
                    image,
                    amount,
                    nonce
                )
            );
    }

    function _genMessageHashForUpdate(
        address creatorAddress,
        address aimeAddress,
        uint256 tokenId,
        string memory data,
        string memory image,
        uint256 nonce
    ) private pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    creatorAddress,
                    aimeAddress,
                    tokenId,
                    data,
                    image,
                    nonce
                )
            );
    }

    function createAIME(
        string memory name_,
        string memory symbol_,
        string memory avatar_,
        string memory bio_,
        string memory image_,
        bytes memory signature,
        uint256 creatorRewardAmount
    ) public returns (address) {
        // todo: validate signature
        bytes32 _msgHash = MessageHashUtils.toEthSignedMessageHash(
            _genMessageHash(msg.sender, msg.sender, "basic_prompt", "static", bio_, avatar_, image_, 0, addressNonce[msg.sender])
        );
        // require(signer != address(0) && ECDSA.recover(_msgHash, signature) == signer, "Invalid signature");
        addressNonce[msg.sender] += 1;

        AIMeNFT aime = new AIMeNFT(string(abi.encodePacked("AIME:", name_)), symbol_, avatar_, bio_, image_, msg.sender, creatorRewardAmount);
        emit AIMeCreated(msg.sender, address(aime));
        return address(aime);
    }

    function mintAIMeNFT(
        address aimeAddress,
        string memory key,
        string memory dataType,
        string memory data,
        string memory image,
        uint256 amount,
        bytes memory signature
    ) public {
        // todo: validate signature
        bytes32 _msgHash = MessageHashUtils.toEthSignedMessageHash(
            _genMessageHash(msg.sender, aimeAddress, key, dataType, data, "", image, amount, addressNonce[msg.sender])
        );
        // require(signer != address(0) && ECDSA.recover(_msgHash, signature) == signer, "Invalid signature");
        addressNonce[msg.sender] += 1;

        AIMeNFT aime = AIMeNFT(aimeAddress);
        uint256 tokenId = aime.safeMint(msg.sender, key, dataType, data, image, amount);
        emit AIMeNFTMinted(
            msg.sender,
            aimeAddress,
            tokenId,
            key,
            dataType,
            data,
            amount
        );
    }

    function updateAIMeNFT(
        address aimeAddress,
        uint256 tokenId,
        string memory data,
        string memory image,
        bytes memory signature
    ) public {
        // todo: validate signature
        bytes32 _msgHash = MessageHashUtils.toEthSignedMessageHash(
            _genMessageHashForUpdate(msg.sender, aimeAddress, tokenId, data, image, addressNonce[msg.sender])
        );
        addressNonce[msg.sender] += 1;
        AIMeNFT aime = AIMeNFT(aimeAddress);
        aime.updateAIMeInfo(tokenId, msg.sender, data, image);
        emit AIMeNFTUpdated(msg.sender, aimeAddress, tokenId, data);
    }
}
