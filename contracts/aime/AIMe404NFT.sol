// SPDX-License-Identifier: MIT
pragma solidity >=0.8.2 <0.9.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./AIMePower.sol";

contract AIMe404NFT is ERC721, Ownable, ERC721Holder {
    using Strings for uint256;
    uint256 public constant AIME_POWER_TOTAL_AMOUNT = 1000000 * 1e18;
    uint256 public CREATOR_REWARD_AMOUNT;
    uint256 public aimePowerReserved;
    address public aimePowerAddress;
    string public avatar;
    address private _factory;
    uint256 private _nextTokenId;
    
    mapping(uint256 => AIMeInfo) public tokenContents;

    error AIMeNFTUnauthorizedAccount(address account);

    modifier onlyFactory() {
        if (factory() != _msgSender()) {
            revert AIMeNFTUnauthorizedAccount(_msgSender());
        }
        _;
    }

    struct AIMeInfo {
        string key;
        string infoType;
        string content;
        string image;
        uint256 amount;
        uint256 currentAmount;
    }

    constructor() ERC721("Kai Kang", "KK") Ownable(msg.sender) {
        _factory = _msgSender();

        AIMePower aimePower = new AIMePower("Kai Kang", "KK");
        aimePower.mint(address(this), AIME_POWER_TOTAL_AMOUNT);
        aimePowerReserved = AIME_POWER_TOTAL_AMOUNT;
        aimePowerAddress = address(aimePower);
        
        // mint initial nfts
        safeMint(address(this), "basic_prompt", "static", "This is the original nft", "QmYR2qU1brQfrLdrf1C8q9nG8bkmnqrYSne254SPYDEfQ4", 0);
    }

    function factory() public view virtual returns (address) {
        return _factory;
    }

    function safeMint(
        address to,
        string memory key,
        string memory infoType,
        string memory content,
        string memory image,
        uint256 amount
    ) public returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        tokenContents[tokenId] = AIMeInfo(key, infoType, content, image, amount, amount);
        aimePowerReserved -= amount;
        return tokenId;
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        _requireOwned(tokenId);

        string memory imageUrl = string(abi.encodePacked(
            "https://aime.mypinata.cloud/ipfs/", tokenContents[tokenId].image
        ));

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "',
                        name(),
                        " #",
                        tokenId.toString(),
                        '", "description": "A block of content of AIME go to https://app.aime.bot',
                        name(),
                        '", "amount": "',
                        tokenContents[tokenId].currentAmount.toString(),
                        '", "image": "',
                        imageUrl,
                        '"}'
                    )
                )
            )
        );
        string memory output = string(
            abi.encodePacked("data:application/json;base64,", json)
        );

        return output;
    }

    /**
     * @dev override {ERC721-transferFrom}.
     */
    function transferFrom(address from, address to, uint256 tokenId) public virtual override {
        if (to == address(0)) {
            revert ERC721InvalidReceiver(address(0));
        }
        // Setting an "auth" arguments enables the `_isAuthorized` check which verifies that the token exists
        // (from != 0). Therefore, it is not needed to verify that the return value is not 0 here.
        address previousOwner = _update(to, tokenId, _msgSender());
        if (previousOwner != from) {
            revert ERC721IncorrectOwner(from, tokenId, previousOwner);
        }

        if (to == address(this)) {
            AIMePower aimePower = AIMePower(aimePowerAddress);
            bool success = aimePower.transfer(from, tokenContents[tokenId].amount);
            require(success, "AIMe404NFT: transfer power failed"); // todo: custom error
        }
    }
}
