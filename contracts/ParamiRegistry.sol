//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "./IHyperlinkAsNft.sol";

error NotIERC721();
error NotOwner();
error NotRegistered();
error AlreadyRegistered();
error LowPrice();
error NotHyperlinkNFT();

contract ParamiRegistry is OwnableUpgradeable {
  
  event AdSpaceRegistered(address nftAddress, uint256 tokenId);
  event AdSpaceUnregistered(address nftAddress, uint256 tokenId);
  event AdBid(address nftAddress, uint256 tokenId, address hnftAddress, uint256 hnftTokenId, uint256 price);

  IERC20 _AD3;

  struct AD {
    address hnftAddress;
    uint256 tokenId;
    uint256 price;
    uint timestamp;
  }

  uint256 private outBidPricePercentage;
  uint256 private adDuration;
  mapping(address => mapping(uint256 => bool)) private nftRegistrar;
  mapping(address => mapping(uint256 => AD)) private nftAddress2TokenId2AD;

  modifier isNftOwner(address nftAddress, uint256 tokenId, address spender) {
    if (!(IERC165)(nftAddress).supportsInterface(
        type(IERC721).interfaceId
    )) {
      revert NotIERC721();
    }

    IERC721 nft = IERC721(nftAddress);
    address owner = nft.ownerOf(tokenId);
    
    if (spender != owner) {
      revert NotOwner();
    }
    
    _;
  }

  modifier notRegistered(address nftAddress, uint256 tokenId) {
    if (isRegistered(nftAddress, tokenId)) {
      revert AlreadyRegistered();
    }
    _;
  }

  modifier registered(address nftAddress, uint256 tokenId) {
    if (!isRegistered(nftAddress, tokenId)) {
      revert NotRegistered();
    }
    _;
  }

  modifier checkAllowance(uint amount) {
    require(_AD3.allowance(_msgSender(), address(this)) >= amount, "Insufficient allowance");
    _;
  }

  modifier isHyperlinkNft(address hnftAddress) {
    if (!(IERC165)(hnftAddress).supportsInterface(
        type(IHyperlinkAsNft).interfaceId
    )) {
      revert NotHyperlinkNFT();
    }
    _;
  }

  function isRegistered(address nftAddress, uint256 tokenId) public view returns(bool) {
    return nftRegistrar[nftAddress][tokenId];
  }

  function initialize(address ad3ERC20) initializer public {
    __Ownable_init();
    _AD3 = IERC20(ad3ERC20);
    outBidPricePercentage = 20;
    adDuration = 24 hours;
  }

  function setOutBidPricePercentage(uint256 percentage) external onlyOwner {
    outBidPricePercentage = percentage;
  }

  function getOutBidPricePercentage() external view returns(uint256) {
    return outBidPricePercentage;
  }

  function setAdDuration(uint256 duration) external onlyOwner {
    adDuration = duration;
  }

  function getAdDuration() external view returns(uint256) {
    return adDuration;
  }

  function register(address nftAddress, uint256 tokenId) external 
    isNftOwner(nftAddress, tokenId, _msgSender())
    notRegistered(nftAddress, tokenId)
  {
    nftRegistrar[nftAddress][tokenId] = true;
    emit AdSpaceRegistered(nftAddress, tokenId);
  }

  function unregister(address nftAddress, uint256 tokenId) external 
    isNftOwner(nftAddress, tokenId, _msgSender())
    registered(nftAddress, tokenId)
  {
    delete nftRegistrar[nftAddress][tokenId];
    delete nftAddress2TokenId2AD[nftAddress][tokenId];
    emit AdSpaceUnregistered(nftAddress, tokenId);
  }

  function bid(address nftAddress, uint256 tokenId, address hnftAddress, uint256 hnftTokenId, uint256 price) external
    registered(nftAddress, tokenId)
    checkAllowance(price)
    isHyperlinkNft(hnftAddress)
  {
    AD memory currentAd = nftAddress2TokenId2AD[nftAddress][tokenId];

    if (block.timestamp < (currentAd.timestamp + adDuration)) {
      if (price < (currentAd.price * (100 + outBidPricePercentage) / 100)) {
        revert LowPrice();
      }
    }

    nftAddress2TokenId2AD[nftAddress][tokenId] = AD(hnftAddress, hnftTokenId, price, block.timestamp);
    
    // todo: lock ad3 / send to bridge?
    _AD3.transferFrom(_msgSender(), address(this), price);

    emit AdBid(nftAddress, tokenId, hnftAddress, hnftTokenId, price);
  }

  function getAd(address nftAddress, uint256 tokenId) external view returns (AD memory) {
    return nftAddress2TokenId2AD[nftAddress][tokenId];
  }
}