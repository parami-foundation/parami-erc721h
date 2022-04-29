import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { ERC721WContract, ERC721WRegistry, TestingERC721Contract } from "../typechain";

describe("ERC721W", function () {
    let registry: ERC721WRegistry;
    let erc721: TestingERC721Contract;
    let wrapper: ERC721WContract;
    let owner: SignerWithAddress;
    let addr1: SignerWithAddress;
    let addr2: SignerWithAddress;
    let tokenId: BigNumber;

    beforeEach(async () => {
        const registryFactory = await ethers.getContractFactory("ERC721WRegistry")
        registry = await registryFactory.deploy();
        await registry.deployed();

        const testingErc721ContractFactory = await ethers.getContractFactory("TestingERC721Contract");
        erc721 = await testingErc721ContractFactory.deploy();
        await erc721.deployed();

        await registry.createERC721wContract(erc721.address, "initialURI");

        const getAddressOfWrapper = registry.getERC721wAddressFor(erc721.address);
        wrapper = await ethers.getContractAt("ERC721WContract", await getAddressOfWrapper);

        [owner, addr1, addr2] = await ethers.getSigners()

        erc721.mint()
        tokenId = await erc721.tokenOfOwnerByIndex(owner.address, 0);
    })

    it("Should have correct metadata", async function () {
        const originalName = await erc721.name();
        const originalSymbol = await erc721.symbol();

        expect(await wrapper.getWrappedContract()).to.equal(erc721.address);
        expect(await wrapper.symbol()).to.equal("W" + originalSymbol);
        expect(await wrapper.name()).to.equal("Wrapped " + originalName);
        expect(await wrapper.getCreator()).to.equal(owner.address);
    });

    it("Should revert when not approved", async () => {
        await expect(wrapper.wrap(tokenId)).to.be.revertedWith("should approve tokenId first");
    });

    describe("wrapped", function () {
        beforeEach(async () => {
            await erc721.approve(wrapper.address, tokenId);
            await wrapper.wrap(tokenId)
        });

        it("Should wrap", async () => {
            const wrappedTokenId = await wrapper.tokenOfOwnerByIndex(owner.address, 0);

            expect(wrappedTokenId).to.be.equal(tokenId);
            expect(await erc721.balanceOf(owner.address)).to.be.equals(0);
        });

        it("Should be able to set value", async () => {
            await wrapper.authorize(tokenId, addr1.address);
            await wrapper.authorize(tokenId, addr2.address);

            const value = "value";
            await wrapper.connect(addr1).setValue(tokenId, value);
            await wrapper.connect(addr2).setValue(tokenId, value);

            expect(await wrapper.isAddressAuthroized(tokenId, addr1.address)).to.be.true;
            expect(await wrapper.getValue(tokenId, addr1.address)).to.be.equal(value);
            expect(await wrapper.getAuthroizedAddresses(tokenId)).to.be.contains(addr1.address, addr2.address).and.to.be.length(2);
        });

        it("Should revert when not authroized", async () => {
            await expect(wrapper.connect(addr1).setValue(tokenId, "value"))
                .to.be.revertedWith("address should be authorized");
        });

        it("Should be able to revoke", async() => {
            await wrapper.authorize(tokenId, addr1.address);
            await wrapper.connect(addr1).setValue(tokenId, "value");
            await wrapper.revoke(tokenId, addr1.address);

            expect(await wrapper.getValue(tokenId, addr1.address)).to.be.equal("");
            expect(await wrapper.isAddressAuthroized(tokenId, addr1.address)).to.be.false;
            await expect(wrapper.connect(addr1).setValue(tokenId, "value")).to.be.revertedWith("address should be authorized");
        });

        it("Should be able to revoke all", async() => {
        });

        it("Should be able to unwrap", async() => {

            await wrapper.authorize(tokenId, addr1.address);
            await wrapper.authorize(tokenId, addr2.address);

            const value = "value";
            await wrapper.connect(addr1).setValue(tokenId, value);
            await wrapper.connect(addr2).setValue(tokenId, value);

            await wrapper.unwrap(tokenId);
            expect(await erc721.balanceOf(owner.address)).equals(1);
            expect(await wrapper.balanceOf(owner.address)).equals(0);
            expect(await wrapper.getValue(tokenId, addr1.address)).equals("");
            expect(await wrapper.isAddressAuthroized(tokenId, addr1.address)).to.be.false;
        });

        it("Should be able to wrap again after unwrap", async() => {
            await wrapper.unwrap(tokenId);

            await erc721.approve(wrapper.address, tokenId);
            await wrapper.wrap(tokenId);

            expect(await wrapper.balanceOf(owner.address)).equals(1);
            expect(await wrapper.ownerOf(tokenId)).equals(owner.address);
            expect(await erc721.ownerOf(tokenId)).equals(wrapper.address);
        });

        it("Should be able to trade wrapped token", async() => {
            await wrapper.transferFrom(owner.address, addr1.address, tokenId);

            expect(await wrapper.ownerOf(tokenId)).equals(addr1.address);

            await expect(wrapper.unwrap(tokenId)).to.be.revertedWith("should be the token owner")
            await wrapper.connect(addr1).unwrap(tokenId);

            expect(await erc721.ownerOf(tokenId)).equals(addr1.address);
        });

        it("Should have same tokenURI",  async() => {
            const originalTokenUri = await erc721.tokenURI(tokenId);
            expect(await wrapper.tokenURI(tokenId)).equals(originalTokenUri);
        });

        it("Should display contract URI", async() => {
            expect(await wrapper.contractURI()).to.be.equal("initialURI");
        });

        it("Should revert when unwrap if not token owner", async() => {
            await wrapper.authorize(tokenId, addr1.address);
            await expect(wrapper.connect(addr1).unwrap(tokenId)).to.be.revertedWith("should be the token owner");
        })

        it("Should be able to set contract uri", async() => {
            await expect(wrapper.connect(addr1).setContractURI("addr1")).to.be.reverted;

            await wrapper.setContractURI("owner");
            expect(await wrapper.contractURI()).to.be.equal("owner");
        });

    });



});
