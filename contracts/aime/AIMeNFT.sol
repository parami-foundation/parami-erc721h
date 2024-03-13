// SPDX-License-Identifier: MIT
pragma solidity >=0.8.2 <0.9.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./AIMePower.sol";

contract AIMeNFT is ERC721, Ownable, ERC721Holder {
    address public protocolFeeDestination;
    uint256 public constant AIME_POWER_TOTAL_AMOUNT = 1000000 * 1e18;
    uint256 public constant AIME_NFT_PRICE_FACTOR = 12;
    uint256 public CREATOR_REWARD_AMOUNT;
    uint256 public aimePowerReserved;
    address public aimePowerAddress;
    string public avatar;
    address private _factory;
    using Strings for uint256;
    uint256 private _nextTokenId;
    mapping(uint256 => AIMeInfo) public tokenContents;
    uint8 public constant protocolFeePercent = 5; // 5%
    uint256 public powersSupply;

    error AIMeNFTUnauthorizedAccount(address account);
    event Trade(
        address trader,
        bool isBuy,
        uint256 powerAmount,
        uint256 priceAfterFee,
        uint256 fee,
        uint256 supply
    );

    event TradeNFT(
        address from,
        address to,
        uint256 tokenId,
        uint256 price
    );

    modifier onlyFactory() {
        if (factory() != _msgSender()) {
            revert AIMeNFTUnauthorizedAccount(_msgSender());
        }
        _;
    }

    struct AIMeInfo {
        string key;
        string dataType;
        string data;
        string image;
        uint256 amount;
        uint256 currentAmount;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        string memory avatar_,
        string memory bio_,
        string memory image_,
        address sender,
        uint256 creatorRewardAmount
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        require(creatorRewardAmount > 0 && creatorRewardAmount <= AIME_POWER_TOTAL_AMOUNT, "Creator Reward Amount out of bound.");
        _factory = _msgSender();

        AIMePower aimePower = new AIMePower(name_, symbol_);
        CREATOR_REWARD_AMOUNT = creatorRewardAmount;
        aimePower.mint(address(this), creatorRewardAmount);
        // todo: mint tokens to creator?
        // aimePower.mint(sender, AIME_POWER_TOTAL_AMOUNT - creatorRewardAmount);
        aimePowerReserved = creatorRewardAmount;
        aimePowerAddress = address(aimePower);
        
        avatar = avatar_;
        powersSupply = 0;
        
        // mint initial nfts
        safeMint(address(this), "basic_prompt", "static", bio_, image_, 0);
    }

    function factory() public view virtual returns (address) {
        return _factory;
    }

    function setFeeDestination(address _feeDestination) public onlyFactory() {
        protocolFeeDestination = _feeDestination;
    }

    function _calculateFeeAmount(
        uint256 amount
    ) private view returns (uint256) {
        return amount * protocolFeePercent / 100;
    }

    function _price_curve(uint256 x) private pure returns (uint256) {
        // todo: change to a better curve
        return x <= 0 ? 0 : (x * x / 1e18) * x / 3;
    }

    function getPrice(
        uint256 supply,
        uint256 amount
    ) public pure returns (uint256) {
        return
            ((_price_curve(supply + amount) - _price_curve(supply)) * 1 ether) /
            160000 /
            1e18 /
            1e18;
    }

    function getBuyPrice(
        uint256 amount
    ) public view returns (uint256) {
        return getPrice(powersSupply, amount);
    }

    function getSellPrice(
        uint256 amount
    ) public view returns (uint256) {
        return getPrice(powersSupply - amount, amount);
    }

    function getBuyPriceAfterFee(
        uint256 amount
    ) public view returns (uint256) {
        uint256 feeAmount = _calculateFeeAmount(amount);
        uint256 price = getBuyPrice(amount + feeAmount);
        return price;
    }

    function getSellPriceAfterFee(
        uint256 amount
    ) public view returns (uint256) {
        uint256 feeAmount = _calculateFeeAmount(amount);
        uint256 price = getSellPrice(amount - feeAmount);
        return price;
    }

    function buyPowers(uint256 amount) public payable {
        require(amount > 0, "Amount must be greater than 0");
        uint256 feeAmount = _calculateFeeAmount(amount);
        uint256 price = getBuyPrice(amount);
        uint256 priceAfterFee = getBuyPrice(amount + feeAmount);
        uint256 fee = priceAfterFee - price;
        
        require(msg.value >= priceAfterFee, "Insufficient payment");

        // transfer power to user
        AIMePower power = AIMePower(aimePowerAddress);
        power.transfer(msg.sender, amount);
        aimePowerReserved -= amount;
        powersSupply += amount;

        // transfer fee to protocol
        (bool success, ) = protocolFeeDestination.call{value: fee}("");
        require(success, "Unable to send funds");

        emit Trade(
            msg.sender,
            true,
            amount,
            priceAfterFee,
            fee,
            powersSupply
        );
    }

    function sellPowers(uint256 amount) public {
        require(powersSupply >= amount, 'pool run out');

        uint256 feeAmount = _calculateFeeAmount(amount);
        uint256 priceAfterFee = getSellPrice(amount - feeAmount);
        uint256 price = getSellPrice(amount);
        uint256 fee = price - priceAfterFee;
        
        // transfer power from user
        AIMePower power = AIMePower(aimePowerAddress);
        require(power.balanceOf(msg.sender) >= amount, "balance not enough");
        require(power.allowance(msg.sender, address(this)) >= amount, "allowance not enough");
        power.transferFrom(msg.sender, address(this), amount);
        powersSupply -= amount;
        aimePowerReserved += amount;

        // transfer eth to user
        (bool success1, ) = msg.sender.call{value: priceAfterFee}("");
        require(success1, "Unable to send funds");

        // transfer fee to protocol
        (bool success2, ) = protocolFeeDestination.call{value: fee}("");
        require(success2, "Unable to send funds");

        emit Trade(
            msg.sender,
            false,
            amount,
            priceAfterFee,
            fee,
            powersSupply
        );
    }

    function safeMint(
        address to,
        string memory key,
        string memory dataType,
        string memory data,
        string memory image,
        uint256 amount
    ) public onlyFactory returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        tokenContents[tokenId] = AIMeInfo(key, dataType, data, image, amount, amount);
        aimePowerReserved -= amount;
        return tokenId;
    }

    function updateAIMeInfo(
        uint256 tokenId,
        address owner,
        string memory data,
        string memory image
    ) public onlyFactory {
        address tokenOwner = _ownerOf(tokenId);
        require(
            tokenOwner == owner && owner != address(0),
            "Invalid token owner"
        );
        tokenContents[tokenId].data = data;
        tokenContents[tokenId].image = image;
    }

    function sellNFT(uint256 tokenId) external {
        _safeTransfer(msg.sender, address(this), tokenId);
        
        AIMePower power = AIMePower(aimePowerAddress);
        power.transfer(msg.sender, tokenContents[tokenId].amount);
        emit TradeNFT(msg.sender, address(this), tokenId, tokenContents[tokenId].amount);
    }
    
    function buyNFT(uint256 tokenId) external {
        AIMePower power = AIMePower(aimePowerAddress);
        address owner = _requireOwned(tokenId);
        uint256 amount;
        if (owner == address(this)) {
            amount = tokenContents[tokenId].amount;
        } else {
            amount = tokenContents[tokenId].currentAmount * AIME_NFT_PRICE_FACTOR / 10;
            tokenContents[tokenId].currentAmount = amount;
        }

        require(power.balanceOf(msg.sender) >= amount, "balance not enough");
        require(power.allowance(msg.sender, address(this)) >= amount, "allowance not enough");
        power.transferFrom(msg.sender, owner, amount);

        _safeTransfer(owner, msg.sender, tokenId);
        emit TradeNFT(owner, msg.sender, tokenId, amount);
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        _requireOwned(tokenId);

        string memory imageUrl = tokenContents[tokenId].image;

        // todo: add traits
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
                        '. Go to https://app.aime.bot/chat/',address(this), '/', tokenId.toString(), '", "amount": "',
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
