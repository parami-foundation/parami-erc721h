// SPDX-License-Identifier: MIT
pragma solidity >=0.8.2 <0.9.0;

import "./AIMeNFT.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract AIMeFactory is Ownable {
    uint256 public protocolFee = 0.001 ether;

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
    event Received(address sender, uint amount);

    mapping(address => uint256) public addressNonce;
    mapping(address => address) public aimeSigners;
    mapping(string => address) public aimeAddresses;

    function updateProtocolFee(uint256 _fee) external onlyOwner {
        protocolFee = _fee;
    }

    function _genMessageHash(
        address creatorAddress,
        address aimeAddress,
        uint256 tokenId,
        string memory key,
        string memory dataType,
        string memory data,
        string memory image,
        uint256 amount,
        uint256 nonce
    ) private pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    creatorAddress,
                    aimeAddress,
                    tokenId,
                    key,
                    dataType,
                    data,
                    image,
                    amount,
                    nonce
                )
            );
    }

    function createAIME(
        string memory name_,
        string memory avatar_,
        string memory bio_,
        string memory image_,
        address aimeSigner
    ) public payable {
        require(msg.value >= protocolFee, "Insufficient payment");
        require(aimeAddresses[name_] == address(0), "AIME already exists");
        AIMeNFT aime = new AIMeNFT(string(abi.encodePacked("AIME:", name_)), name_, avatar_, bio_, image_);
        address aimeAddress = address(aime);
        aimeAddresses[name_] = aimeAddress;
        aimeSigners[aimeAddress] = aimeSigner;
        emit AIMeCreated(msg.sender, address(aime));
    }

    function mintAIMeNFT(
        address aimeAddress,
        string memory key,
        string memory dataType,
        string memory data,
        string memory image,
        uint256 amount,
        bytes memory signature
    ) public payable {
        require(msg.value >= protocolFee, "Insufficient payment");
        address signer = aimeSigners[aimeAddress];
        if (signer != address(0)) {
            bytes32 _msgHash = MessageHashUtils.toEthSignedMessageHash(
                _genMessageHash(msg.sender, aimeAddress, 0, key, dataType, data, image, amount, addressNonce[msg.sender])
            );
            require(ECDSA.recover(_msgHash, signature) == signer, "Invalid signature");
            addressNonce[msg.sender] += 1;
        }
        
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
    ) public payable {
        require(msg.value >= protocolFee, "Insufficient payment");
        address signer = aimeSigners[aimeAddress];
        if (signer != address(0)) {
            bytes32 _msgHash = MessageHashUtils.toEthSignedMessageHash(
                _genMessageHash(msg.sender, aimeAddress, tokenId, "", "", data, image, 0, addressNonce[msg.sender])
            );
            require(ECDSA.recover(_msgHash, signature) == signer, "Invalid signature");
            addressNonce[msg.sender] += 1;
        }
        
        AIMeNFT aime = AIMeNFT(aimeAddress);
        aime.updateAIMeInfo(tokenId, msg.sender, data, image);
        emit AIMeNFTUpdated(msg.sender, aimeAddress, tokenId, data);
    }

    function withdrawFee() public onlyOwner {
        uint amount = address(this).balance;
        (bool success, ) = owner().call{value: amount}("");
        require(success, "Failed to send Ether");
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }
}
