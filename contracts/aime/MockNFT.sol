//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract MockNFT is ERC721 {
    using Strings for uint256;
    mapping(uint256 => NFTInfo) public tokenContents;
    uint256 private _nextTokenId;
    string public avatar;
    string public viewer;

    struct NFTInfo {
        string key;
        string content;
        string image;
        string amount;
    }

    constructor() ERC721("Kai Kang", "KK") {
        avatar = 'QmYKGSCn7FF14KNuRPGzy2tVdZc2248AqfXriq69jnewsD';
    }

    function setViewer(string memory _viewer) external {
        viewer = _viewer;
    }

    function mint(string memory key, string memory content, string memory image, string memory amount) external {
        uint256 tokenId = _nextTokenId++;
        tokenContents[tokenId] = NFTInfo(key, content, image, amount);
        _safeMint(msg.sender, tokenId);
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        // string memory url = string(abi.encodePacked(
        //     "https://aime.mypinata.cloud/ipfs/", viewer,
        //     "?image=", tokenContents[tokenId].image,
        //     "&amount=", tokenContents[tokenId].amount,
        //     "&name=", name()
        // ));
        string memory imageUrl = string(abi.encodePacked(
            "https://aime.mypinata.cloud/ipfs/", tokenContents[tokenId].image
        ));

        // url = string(abi.encodePacked(
        //     url,
        //     "&content=", tokenContents[tokenId].content,
        //     "&key=", tokenContents[tokenId].key,
        //     "&avatar=", avatar
        // ));
        
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "NFT Test #',
                        tokenId.toString(),
                        '", "description": "A block of content of AIME go to https://app.aime.bot",',
                        '"image": "',
                        imageUrl,
                        '", "animation_url": "',
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
