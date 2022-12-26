//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

error NotIERC721();
error NotOwner();
error NotRegistered();
error AlreadyRegistered();

contract ParamiRegistry is OwnableUpgradeable {

  using EnumerableSet for EnumerableSet.AddressSet;
  using EnumerableSet for EnumerableSet.UintSet;
  
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

  EnumerableSet.AddressSet private nftAddressSet;
  mapping(address => EnumerableSet.UintSet) private nftAddress2TokenIdSet;
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

  function isRegistered(address nftAddress, uint256 tokenId) public view returns(bool) {
    return nftAddressSet.contains(nftAddress) && nftAddress2TokenIdSet[nftAddress].contains(tokenId);
  }

  function initialize(address ad3ERC20) initializer public {
    __Ownable_init();
    _AD3 = IERC20(ad3ERC20);
  }

  function register(address contractAddr, uint256 tokenId) external 
    isNftOwner(contractAddr, tokenId, _msgSender())
    notRegistered(contractAddr, tokenId)
  {
    nftAddressSet.add(contractAddr);
    nftAddress2TokenIdSet[contractAddr].add(tokenId);

    emit AdSpaceRegistered(contractAddr, tokenId);
  }

  function unregister(address nftAddress, uint256 tokenId) external 
    isNftOwner(nftAddress, tokenId, _msgSender())
    registered(nftAddress, tokenId)
  {
    nftAddress2TokenIdSet[nftAddress].remove(tokenId);
    if (nftAddress2TokenIdSet[nftAddress].length() == 0) {
      nftAddressSet.remove(nftAddress);
    }
    
    emit AdSpaceUnregistered(nftAddress, tokenId);
  }

  function bid(address nftAddress, uint256 tokenId, address hnftAddress, uint256 hnftTokenId, uint256 price) external
    registered(nftAddress, tokenId)
    checkAllowance(price)
  {
    AD memory currentAd = nftAddress2TokenId2AD[nftAddress][tokenId];

    if (block.timestamp < (currentAd.timestamp + 24 hours)) {
      require(price > currentAd.price, "LowPrice");
    }

    // todo: validates hnft
    // supportsInterface IHyperlinkAsNft

    nftAddress2TokenId2AD[nftAddress][tokenId] = AD(hnftAddress, hnftTokenId, price, block.timestamp);
    
    // todo: lock ad3 / send to bridge?
    _AD3.transferFrom(_msgSender(), address(this), price);

    emit AdBid(nftAddress, tokenId, hnftAddress, hnftTokenId, price);
  }

  function getNftAddresses() external view returns (address[] memory) {
    return nftAddressSet.values();
  }

  function getNftTokens(address nftAddress) external view returns (uint256[] memory) {
    return nftAddress2TokenIdSet[nftAddress].values();
  }

  function getAd(address nftAddress, uint256 tokenId) external view returns (AD memory) {
    return nftAddress2TokenId2AD[nftAddress][tokenId];
  }
}