//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract ParamiCCTP is Ownable {

    uint256 public chainDomain;

    mapping (uint256 => address) public assetIdToERC20Contract;

    uint256 nonce;

    mapping (uint256 => mapping ( uint256 => bool)) public sourceDomainToNonceToUsed;

    constructor(uint256 _chainDomain) {
        chainDomain = _chainDomain;
    }

    event Deposited(uint256 indexed nonce, uint256 indexed assetId, uint256 amount, uint256 sourceDomain, address indexed sender, uint256 destDomain, bytes destinationRecepient);

    event Withdrawed(uint256 indexed nonce, uint256 indexed assetId, uint256 amount, uint256 sourceDomain, bytes sender, uint256 destDomain, address indexed destinationRecepient);


    function registerAsset(uint256 assetId, address erc20Contract) public onlyOwner {
        assetIdToERC20Contract[assetId] = erc20Contract;
    }

    function deposit(uint256 assetId, uint256 amount, uint256 destinationDomain, bytes memory destinationRecepient) public {
        address erc20Contract = assetIdToERC20Contract[assetId];
        require(erc20Contract != address(0), "asset not registered");
        ERC20 erc20 = ERC20(erc20Contract);
        require(erc20.transferFrom(_msgSender(), address(this), amount), "transfer failed");

        nonce++;
        emit Deposited(nonce, assetId, amount, chainDomain, _msgSender(), destinationDomain, destinationRecepient);
    }

    function withdraw(uint256 nonce, uint256 assetId, uint256 amount, uint256 sourceDomain, bytes memory sourceSender, address destinationRecepient, bytes memory signature) public {
        address signer = verifySignature(nonce, assetId, amount, sourceDomain, sourceSender, destinationRecepient, signature);
        require(sourceDomainToNonceToUsed[sourceDomain][nonce] == false, "nonce already used");
        require(signer == this.owner(), "invalid signature");

        address erc20Contract = assetIdToERC20Contract[assetId];
        require(erc20Contract != address(0), "asset not registered");

        sourceDomainToNonceToUsed[sourceDomain][nonce] = true;

        ERC20 erc20 = ERC20(erc20Contract);
        erc20.transfer(destinationRecepient, amount);

        emit Withdrawed(nonce, assetId, amount, sourceDomain, sourceSender, chainDomain, destinationRecepient);
    }

    function verifySignature(uint256 nonce, uint256 assetId, uint256 amount, uint256 sourceDomain, bytes memory sourceSender, address destinationRecepient, bytes memory signature) public view returns (address) {
        bytes32 messageHash = keccak256(abi.encodePacked(nonce, assetId, amount, sourceDomain, sourceSender, chainDomain, destinationRecepient));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        address signer = recoverSigner(ethSignedMessageHash, signature);
        return signer;
    }

    function recoverSigner(
        bytes32 _ethSignedMessageHash,
        bytes memory _signature
    ) public pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);

        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    function splitSignature(
        bytes memory sig
    ) public pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "invalid signature length");

        assembly {
            /*
            First 32 bytes stores the length of the signature

            add(sig, 32) = pointer of sig + 32
            effectively, skips first 32 bytes of signature

            mload(p) loads next 32 bytes starting at the memory address p into memory
            */

            // first 32 bytes, after the length prefix
            r := mload(add(sig, 32))
            // second 32 bytes
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }

        // implicitly return (r, s, v)
    }

    function withdrawByOwner(uint256 assetId, uint256 amount, address destinationRecepient) public onlyOwner {
        address erc20Contract = assetIdToERC20Contract[assetId];
        require(erc20Contract != address(0), "asset not registered");

        ERC20 erc20 = ERC20(erc20Contract);
        erc20.transfer(destinationRecepient, amount);
    }
}
