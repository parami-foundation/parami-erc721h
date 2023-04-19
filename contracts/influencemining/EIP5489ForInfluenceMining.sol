//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../IERC721H.sol";
import "../base64.sol";

contract EIP5489ForInfluenceMining is
    IERC721H,
    ERC721EnumerableUpgradeable,
    OwnableUpgradeable
{
    mapping(uint256 => address) public tokenId2AuthorizedAddress;
    mapping(uint256 => string) public tokenId2ImageUri;
    mapping(uint256 => string) public tokenId2Hyperlink;

    string private defaultHyperlinkPrefix;
    IERC20 ad3Contract;

    mapping(uint256 => uint256) public token2Level;
    mapping(uint256 => uint256) public level2Price;

    mapping(uint256 => uint256) public token2LinkTargetToken;
    mapping(address => bool) public kolWhiteList;

    function initialize(address _ad3Address) public initializer {
        __ERC721_init("Hyperlink NFT Collection", "HNFT");
        __Ownable_init();
        ad3Contract = IERC20(_ad3Address);
    }

    modifier onlyTokenOwner(uint256 tokenId) {
        require(
            tx.origin == ownerOf(tokenId) || _msgSender() == ownerOf(tokenId),
            "should be the token owner"
        );
        _;
    }

    modifier onlySlotManager(uint256 tokenId) {
        require(
            _msgSender() == ownerOf(tokenId) ||
                tokenId2AuthorizedAddress[tokenId] == _msgSender(),
            "address should be authorized"
        );
        _;
    }

    function setSlotUri(uint256 tokenId, string calldata value)
        external
        override
        onlyTokenOwner(tokenId)
    {
        tokenId2Hyperlink[tokenId] = value;

        emit SlotUriUpdated(tokenId, _msgSender(), value);
    }

    function getSlotUri(uint256 tokenId, address slotManagerAddr)
        external
        view
        override
        returns (string memory)
    {
        return tokenId2Hyperlink[tokenId];
    }

    function authorizeSlotTo(uint256 tokenId, address slotManagerAddr)
        external
        override
        onlyTokenOwner(tokenId)
    {
        if (tokenId2AuthorizedAddress[tokenId] != slotManagerAddr) {
            tokenId2AuthorizedAddress[tokenId] = slotManagerAddr;
            emit SlotAuthorizationCreated(tokenId, slotManagerAddr);
        }
    }

    function revokeAuthorization(uint256 tokenId, address slotManagerAddr)
        public
        override
        onlyTokenOwner(tokenId)
    {
        address authorizedAddress = tokenId2AuthorizedAddress[tokenId];

        delete tokenId2Hyperlink[tokenId];

        emit SlotAuthorizationRevoked(tokenId, authorizedAddress);
    }

    function revokeAllAuthorizations(uint256 tokenId)
        external
        override
        onlyTokenOwner(tokenId)
    {
        revokeAuthorization(tokenId, address(0));
    }

    function isSlotManager(uint256 tokenId, address addr)
        public
        view
        returns (bool)
    {
        return tokenId2AuthorizedAddress[tokenId] == addr;
    }

    function mint(string calldata imageUri, uint256 targetLevel) external {
        uint256 tokenId = totalSupply() + 1;
        _safeMint(msg.sender, tokenId);
        tokenId2ImageUri[tokenId] = imageUri;

        if (targetLevel != 0) {
            _upgradeTo(tokenId, targetLevel);
        }
    }

    function _upgradeTo(uint256 tokenId, uint256 targetLevel) private {
        uint256 fromLevel = token2Level[tokenId];
        require(targetLevel > fromLevel, "targetLevel should G.T. fromLevel");

        uint256 fromLevelPrice = level2Price[fromLevel];
        uint256 targetLevelPrice = level2Price[targetLevel];
        require(targetLevelPrice != 0, "targetLevel should exist");
        require(
            targetLevelPrice > fromLevelPrice,
            "targetLevelPrice should G.T. fromLevelPrice"
        );

        uint256 balance = ad3Contract.balanceOf(msg.sender);
        uint256 priceDiff = targetLevelPrice - fromLevelPrice;
        if (targetLevel == 1 || kolWhiteList[msg.sender] == true) {
            priceDiff = 0;
        }

        require(balance > priceDiff, "should have enough ad3");

        ad3Contract.transferFrom(msg.sender, address(this), priceDiff);
        token2Level[tokenId] = targetLevel;
    }

    function upgradeTo(uint256 tokenId, uint256 targetLevel) public {
        require(ownerOf(tokenId) != address(0), "Token should exists");
        _upgradeTo(tokenId, targetLevel);
    }

    function linkTo(uint256 tokenId, uint256 targetTokenId)
        public
        onlyTokenOwner(tokenId)
    {
        token2LinkTargetToken[tokenId] = targetTokenId;
    }

    function manageLevelPrices(
        uint256[] calldata levels,
        uint256[] calldata prices
    ) public onlyOwner {
        require(
            levels.length == prices.length,
            "levels.size should eq to prices.size"
        );
        for (uint256 i = 0; i < levels.length; i++) {
            level2Price[levels[i]] = prices[i];
        }
    }

    function withdrawAllAd3() public onlyOwner {
        uint256 allBalance = ad3Contract.balanceOf(address(this));
        ad3Contract.transfer(owner(), allBalance);
    }

    function updateAd3Address(address _ad3Address) public onlyOwner {
        ad3Contract = IERC20(_ad3Address);
    }

    function addToKolWhiteList(address[] calldata kolAddrs) public onlyOwner {
        for (uint256 i = 0; i < kolAddrs.length; i++) {
            kolWhiteList[kolAddrs[i]] = true;
        }
    }

    function removeFromKolWhiteList(address[] calldata kolAddrs)
        public
        onlyOwner
    {
        for (uint256 i = 0; i < kolAddrs.length; i++) {
            kolWhiteList[kolAddrs[i]] = false;
        }
    }

    function tokenURI(uint256 _tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(_exists(_tokenId), "URI query for nonexistent token");

        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(
                        bytes(
                            abi.encodePacked(
                                '{"name":"',
                                abi.encodePacked(
                                    "Hyperlink NFT Collection # ",
                                    StringsUpgradeable.toString(_tokenId)
                                ),
                                '",',
                                '"description":"Hyperlink NFT collection created with Parami Foundation"',
                                ",",
                                '"image":"',
                                tokenId2ImageUri[_tokenId],
                                '"',
                                "}"
                            )
                        )
                    )
                )
            );
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721EnumerableUpgradeable)
        returns (bool)
    {
        return
            interfaceId == type(IERC721H).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
