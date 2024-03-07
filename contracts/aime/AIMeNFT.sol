// SPDX-License-Identifier: MIT
pragma solidity >=0.8.2 <0.9.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./AIMePower.sol";

contract AIMeNFT is ERC721, Ownable, ERC721Holder {
    uint256 public constant AIME_POWER_TOTAL_AMOUNT = 1000000 * 1e18;
    uint256 public CREATOR_REWARD_AMOUNT;
    uint256 public aimePowerReserved;
    address public aimePowerAddress;
    string public avatar;
    address private _factory;
    using Strings for uint256;
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
    }

    constructor(
        string memory name_,
        string memory symbol_,
        string memory avatar_,
        string memory bio_,
        string memory bioImage_,
        address sender,
        uint256 creatorRewardAmount
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        require(creatorRewardAmount > 0 && creatorRewardAmount <= AIME_POWER_TOTAL_AMOUNT, "Creator Reward Amount out of bound.");
        _factory = _msgSender();

        AIMePower aimePower = new AIMePower(name_, symbol_);
        aimePower.mint(address(this), creatorRewardAmount);
        aimePower.mint(sender, AIME_POWER_TOTAL_AMOUNT - creatorRewardAmount);
        aimePowerReserved = creatorRewardAmount;
        aimePowerAddress = address(aimePower);
        
        avatar = avatar_;
        
        // mint initial nfts
        safeMint(address(this), "basic_prompt", "static", bio_, bioImage_, 0);
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
    ) public onlyFactory returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        tokenContents[tokenId] = AIMeInfo(key, infoType, content, image, amount);
        aimePowerReserved -= amount;
        return tokenId;
    }

    function updateAIMeInfo(
        uint256 tokenId,
        address owner,
        string memory content
    ) public onlyFactory {
        address tokenOwner = _ownerOf(tokenId);
        require(
            tokenOwner == owner && owner != address(0),
            "Invalid token owner"
        );
        tokenContents[tokenId].content = content;
    }

    function sellToken(uint256 tokenId) external {
        _safeTransfer(msg.sender, address(this), tokenId);
        
        AIMePower power = AIMePower(aimePowerAddress);
        power.transfer(msg.sender, tokenContents[tokenId].amount);
        // todo: event
    }

    function buyToken(uint256 tokenId) external {
        AIMePower power = AIMePower(aimePowerAddress);
        uint256 amount = tokenContents[tokenId].amount;
        require(power.balanceOf(msg.sender) >= amount, "balance not enough");
        require(power.allowance(msg.sender, address(this)) >= amount, "allowance not enough");
        power.transferFrom(msg.sender, address(this), amount);
        
        _safeTransfer(address(this), msg.sender, tokenId);
        // todo: event
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        _requireOwned(tokenId);

        string memory imageUrl = tokenContents[tokenId].image;

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "',
                        name(),
                        " #",
                        tokenId.toString(),
                        '", "description": "A block of content of AIME ',
                        name(),
                        '. Go to https://app.aime.bot", "amount": "',
                        tokenContents[tokenId].amount.toString(),
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
}
