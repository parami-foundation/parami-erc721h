//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IHyperlinkAsNft {

    /**
     * @dev
     * returns the latest icon uri of a token, which is indicated by `tokenId`
     */
    function getIconUri(uint256 tokenId)
        external
        view
        returns (string memory);

    /**
     * @dev
     * returns the latest poster uri of a token, which is indicated by `tokenId`
     */
    function getPosterUri(uint256 tokenId)
        external
        view
        returns (string memory);
    
    /**
     * @dev
     * returns the latest href uri of a token, which is indicated by `tokenId`
     */
    function getHref(uint256 tokenId)
        external
        view
        returns (string memory); 
}