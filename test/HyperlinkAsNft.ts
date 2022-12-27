import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { HyperlinkAsNft } from "../typechain";

describe("ERC721W", function () {
  let contract: HyperlinkAsNft;
  let owner: SignerWithAddress;
  let tokenId: BigNumber;

  beforeEach(async () => {
    const factory = await ethers.getContractFactory("HyperlinkAsNft");
    contract = await upgrades.deployProxy(factory) as HyperlinkAsNft;
    await contract.deployed();
    [owner] = await ethers.getSigners();
  })


  it("Should have correct metadata", async function () {
    const iconUri = "https://ipfs.parami.io/ipfs/QmWjFHRBL56GDsojZZNmzgq1oeYKqFnz7M28viVmDDz1xm";
    const posterUri = "https://ipfs.parami.io/ipfs/QmQxqTJ6kdhoaqWAaea6SRQsjF2BGoxETyK1mikjSdzG2Q";
    const href = "https://twitter.com/intent/follow?screen_name=thenftstar";
    await contract.mint(iconUri, posterUri, href);
    let nft = await contract.tokenURI(1);
    let base64Content = nft.substring("data:application/json;base64,".length);
    let debase64Content = Buffer.from(base64Content, "base64").toString("binary");
    console.log(debase64Content);
    const metadata = JSON.parse(debase64Content) as { name: string, description: string, image: string, poster: string, href: string };
    expect(metadata.image).to.be.eq(iconUri);
    expect(metadata.poster).to.be.eq(posterUri);
    expect(metadata.href).to.be.eq(href);
  });

  it("should have correct iconUri posterUri href", async () => {
    const iconUri = "https://ipfs.parami.io/ipfs/QmWjFHRBL56GDsojZZNmzgq1oeYKqFnz7M28viVmDDz1xm";
    const posterUri = "https://ipfs.parami.io/ipfs/QmQxqTJ6kdhoaqWAaea6SRQsjF2BGoxETyK1mikjSdzG2Q";
    const href = "https://twitter.com/intent/follow?screen_name=thenftstar";
    await contract.mint(iconUri, posterUri, href);
    let iconUriFromRemote = await contract.getIconUri(1);
    expect(iconUriFromRemote).to.be.eq(iconUri);

    let posterUriFromRemote = await contract.getPosterUri(1);
    expect(posterUriFromRemote).to.be.eq(posterUri);

    let hrefFromRemote = await contract.getHref(1);
    expect(hrefFromRemote).to.be.eq(href);
  });

});