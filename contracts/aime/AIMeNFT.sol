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
    uint256 public aimePowerReserved;
    address public aimePowerAddress;
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
        uint256 amount;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        string memory bio_
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        _factory = _msgSender();

        AIMePower aimePower = new AIMePower(name_, symbol_);
        aimePower.mint(address(this), AIME_POWER_TOTAL_AMOUNT);
        aimePowerReserved = AIME_POWER_TOTAL_AMOUNT;
        aimePowerAddress = address(aimePower);

        // mint initial nfts
        safeMint(address(this), "static", "name", name_, 0);
        safeMint(address(this), "static", "bio", bio_, 0);
    }

    function factory() public view virtual returns (address) {
        return _factory;
    }

    function safeMint(
        address to,
        string memory key,
        string memory infoType,
        string memory content,
        uint256 amount
    ) public onlyFactory returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        tokenContents[tokenId] = AIMeInfo(key, infoType, content, amount);
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

        string[9] memory parts;

        parts[
            0
        ] = '<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMin meet" viewBox="0 0 420 420"><style>.base { fill: white; font-family: serif; font-size: 14px; }</style><rect width="100%" height="100%" fill="black" /><text x="10" y="20" class="base">';

        parts[1] = "{";

        parts[2] = '</text><text x="30" y="40" class="base">"';

        parts[3] = tokenContents[tokenId].infoType;

        parts[4] = '": "';

        parts[5] = tokenContents[tokenId].content;

        parts[6] = '"</text><text x="10" y="60" class="base">';

        parts[7] = "}";

        parts[8] = "</text></svg>";

        string memory output = string(
            abi.encodePacked(
                parts[0],
                parts[1],
                parts[2],
                parts[3],
                parts[4],
                parts[5],
                parts[6],
                parts[7],
                parts[8]
            )
        );

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
                        '", "amount": "',
                        tokenContents[tokenId].amount.toString(),
                        '", "image": "data:image/svg+xml;base64,',
                        Base64.encode(bytes(output)),
                        '"}'
                    )
                )
            )
        );
        output = string(
            abi.encodePacked("data:application/json;base64,", json)
        );

        return output;
    }
}
