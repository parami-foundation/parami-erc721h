// SPDX-License-Identifier: MIT
pragma solidity >=0.8.2 <0.9.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./AIMePower.sol";

contract AIMeNFTV2 is ERC721, Ownable, ERC721Holder {
    // The canonical permit2 contract.
    IPermit2 public immutable PERMIT2;
    AIMePower public immutable aimePower;
    uint256 public constant AIME_POWER_TOTAL_AMOUNT = 1000000 * 1e18;
    uint256 public constant AIME_POWER_SWAP_INIT_AMOUNT = 100000 * 1e18;
    uint256 public constant AIME_NFT_PRICE_FACTOR = 12;
    uint256 public constant NFT_HOLDING_PERIOD = 30 days;
    uint256 public aimePowerReserved;
    uint256 public swapPowerBalance;
    string public avatar;
    address private _factory;
    using Strings for uint256;
    uint256 private _nextTokenId;
    mapping(uint256 => AIMeInfo) public tokenContents;

    error AIMeNFTUnauthorizedAccount(address account);
    event Trade(
        address trader,
        bool isBuy,
        uint256 powerAmount,
        uint256 priceAfterFee,
        uint256 fee,
        uint256 supply
    );

    event TradeNFT(address from, address to, uint256 tokenId, uint256 price);

    event Received(address sender, uint amount);

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
        uint256 timestamp;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        string memory avatar_,
        string memory bio_,
        string memory image_
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        // todo: pass in permit2 address
        PERMIT2 = IPermit2(address(0x000000000022D473030F116dDEE9F6B43aC78BA3));
        _factory = _msgSender();
        aimePower = new AIMePower(name_, symbol_);
        aimePower.mint(address(this), AIME_POWER_TOTAL_AMOUNT);

        swapPowerBalance = AIME_POWER_SWAP_INIT_AMOUNT;
        aimePowerReserved =
            AIME_POWER_TOTAL_AMOUNT -
            AIME_POWER_SWAP_INIT_AMOUNT;

        avatar = avatar_;

        // mint initial nft
        safeMint(address(this), "basic_prompt", "static", bio_, image_, 0);
    }

    function transferPowerFrom(
        address from,
        address to,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) private {
        PERMIT2.permitTransferFrom(
            // The permit message.
            IPermit2.PermitTransferFrom({
                permitted: IPermit2.TokenPermissions({
                    token: aimePower,
                    amount: amount
                }),
                nonce: nonce,
                deadline: deadline
            }),
            // The transfer recipient and amount.
            IPermit2.SignatureTransferDetails({
                to: to,
                requestedAmount: amount
            }),
            // The owner of the tokens, which must also be
            // the signer of the message, otherwise this call
            // will fail.
            from,
            // The packed signature that was the result of signing
            // the EIP712 hash of `permit`.
            signature
        );
    }

    function factory() public view virtual returns (address) {
        return _factory;
    }

    function getAmountOut(
        uint256 value,
        bool _buy
    ) public view returns (uint256) {
        uint256 ethBalance = address(this).balance;
        if (_buy) {
            return (swapPowerBalance * value) / (ethBalance + value);
        } else {
            return (ethBalance * value) / (swapPowerBalance + value);
        }
    }

    function getAmountIn(
        uint256 value,
        bool _buy
    ) public view returns (uint256) {
        uint256 ethBalance = address(this).balance;
        if (_buy) {
            return (ethBalance * value) / (swapPowerBalance - value);
        } else {
            return (swapPowerBalance * value) / (ethBalance - value);
        }
    }

    function getBuyPrice(uint256 amount) public view returns (uint256) {
        return getAmountIn(amount, true);
    }

    function getSellPrice(uint256 amount) public view returns (uint256) {
        return getAmountOut(amount, false);
    }

    function buyPowers(uint256 amount) public payable {
        require(amount < swapPowerBalance, "Insufficient power balance");
        // eth amount
        uint256 ethAmount = ((address(this).balance - msg.value) * amount) /
            (swapPowerBalance - amount);
        require(ethAmount > 0, "Amount too small");
        require(msg.value == ethAmount, "Incorrect payment");

        // transfer power to user
        aimePower.transfer(msg.sender, amount);
        swapPowerBalance -= amount;
        emit Trade(msg.sender, true, amount, ethAmount, 0, 0);
    }

    function sellPowers(
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) public {
        // eth amount
        uint256 ethAmount = getAmountOut(amount, false);
        require(ethAmount > 0, "Amount too small");
        require(address(this).balance >= ethAmount, "Insufficient ETH balance");

        // transfer power
        transferPowerFrom(
            msg.sender,
            address(this),
            amount,
            nonce,
            deadline,
            signature
        );
        swapPowerBalance += amount;

        // transfer eth to user
        (bool success, ) = msg.sender.call{value: ethAmount}("");
        require(success, "Unable to send funds");

        emit Trade(msg.sender, false, amount, ethAmount, 0, 0);
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
        tokenContents[tokenId] = AIMeInfo(
            key,
            dataType,
            data,
            image,
            amount,
            amount,
            block.timestamp
        );
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
        tokenContents[tokenId].timestamp = block.timestamp;
    }

    function sellNFT(uint256 tokenId) external {
        _safeTransfer(msg.sender, address(this), tokenId);

        uint256 duration = block.timestamp - tokenContents[tokenId].timestamp;
        uint256 amount;

        if (duration < NFT_HOLDING_PERIOD) {
            amount = tokenContents[tokenId].amount * duration / NFT_HOLDING_PERIOD;
        } else {
            amount = tokenContents[tokenId].amount;
        }

        // AIMePower power = AIMePower(aimePowerAddress);
        aimePower.transfer(msg.sender, amount);
        emit TradeNFT(msg.sender, address(this), tokenId, amount);
    }

    function buyNFT(
        uint256 tokenId,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(tokenId != 0, "Cannot buy the first NFT");
        address owner = _requireOwned(tokenId);
        uint256 amount;
        if (owner == address(this)) {
            amount = tokenContents[tokenId].amount;
        } else {
            amount =
                (tokenContents[tokenId].currentAmount * AIME_NFT_PRICE_FACTOR) /
                10;
            tokenContents[tokenId].currentAmount = amount;
        }

        // transfer power
        transferPowerFrom(
            msg.sender,
            owner,
            amount,
            nonce,
            deadline,
            signature
        );

        _safeTransfer(owner, msg.sender, tokenId);
        tokenContents[tokenId].timestamp = block.timestamp;
        emit TradeNFT(owner, msg.sender, tokenId, amount);
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        _requireOwned(tokenId);

        string memory tokenName = string(
            abi.encodePacked(name(), " #", tokenId.toString())
        );
        string memory imageUrl = tokenContents[tokenId].image;
        string memory tradeUrl = string(
            abi.encodePacked(
                "https://app.aime.bot/nft/",
                Strings.toHexString(uint256(uint160(address(this))), 20),
                "/",
                tokenId.toString()
            )
        );

        string memory attributes = string(
            abi.encodePacked(
                "[",
                '{"trait_type": "type","value": "',
                tokenContents[tokenId].dataType,
                '"},',
                '{"trait_type": "key","value": "',
                tokenContents[tokenId].key,
                '"},',
                '{"trait_type": "data","value": "',
                tokenContents[tokenId].data,
                '"}',
                "]"
            )
        );

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "',
                        tokenName,
                        '", "description": "A block of content of ',
                        name(),
                        ". Trade at: ",
                        tradeUrl,
                        '", "attributes":',
                        attributes,
                        ', "amount": "',
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

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }
}

// Minimal Permit2 interface, derived from
// https://github.com/Uniswap/permit2/blob/main/src/interfaces/ISignatureTransfer.sol
interface IPermit2 {
    // Token and amount in a permit message.
    struct TokenPermissions {
        // Token to transfer.
        IERC20 token;
        // Amount to transfer.
        uint256 amount;
    }

    // The permit2 message.
    struct PermitTransferFrom {
        // Permitted token and amount.
        TokenPermissions permitted;
        // Unique identifier for this permit.
        uint256 nonce;
        // Expiration for this permit.
        uint256 deadline;
    }

    // Transfer details for permitTransferFrom().
    struct SignatureTransferDetails {
        // Recipient of tokens.
        address to;
        // Amount to transfer.
        uint256 requestedAmount;
    }

    // Consume a permit2 message and transfer tokens.
    function permitTransferFrom(
        PermitTransferFrom calldata permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;
}
