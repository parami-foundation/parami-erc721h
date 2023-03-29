import { expect } from "chai";
import { ethers } from "hardhat";
import { ParamiCCTP, AD3, MockLssController} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("CCTPBridge", function () {
  let bridgeContract: ParamiCCTP;
  let ad3Contract: AD3;
  let lssControllerContract: MockLssController;
  let ad3Owner: SignerWithAddress;
  let bridgeOwner: SignerWithAddress;
  let assetId: number;

  beforeEach(async () => {
    [ad3Owner, bridgeOwner] = await ethers.getSigners();

    const controllerFactroy = await ethers.getContractFactory("MockLssController");
    lssControllerContract = (await controllerFactroy.deploy()) as MockLssController;

    const ad3Factory = await ethers.getContractFactory("AD3");
    ad3Contract = (await ad3Factory.deploy(10000, "AD3", "AD3", ad3Owner.address, ad3Owner.address, 10000, lssControllerContract.address)) as AD3;

    const paramiCCTP = await ethers.getContractFactory("ParamiCCTP");
    bridgeContract = await paramiCCTP.connect(bridgeOwner).deploy(1);

    assetId = 10000;
    await bridgeContract.connect(bridgeOwner).registerAsset(assetId, ad3Contract.address);
    bridgeContract = bridgeContract.connect(ad3Owner);
  });

  it("Should Deposit Ad3", async function () {
    await ad3Contract.approve(bridgeContract.address, 100);

    const recepientBytes = ethers.utils.formatBytes32String("abdc");
    const domain = 1;

    let preAd3Balance = await ad3Contract.balanceOf(ad3Owner.address);
    let preBridgeBalance = await ad3Contract.balanceOf(bridgeContract.address);

    await expect(bridgeContract.deposit(assetId, 100, 2, recepientBytes)).to.emit(bridgeContract, "Deposited").withArgs(1, assetId, 100, domain, ad3Owner.address, 2, recepientBytes);

    let postAd3Balance = await ad3Contract.balanceOf(ad3Owner.address);
    let postBridgeBalance = await ad3Contract.balanceOf(bridgeContract.address);
    expect(postAd3Balance).to.equal(preAd3Balance.sub(100));
    expect(postBridgeBalance).to.equal(preBridgeBalance.add(100));
    expect(preAd3Balance.add(preBridgeBalance)).to.equal(postAd3Balance.add(postBridgeBalance));
  });

  it("Should withdraw", async function () {
    const sourceDomain = 2;
    const source = ethers.utils.formatBytes32String("abdc");
    const nonce = 1;
    const amount = 100;
    const destDomain = 1;
    const destAddr = ad3Owner.address;

    await ad3Contract.approve(bridgeContract.address, 100);
    await bridgeContract.deposit(assetId, amount, sourceDomain, source);

    const digest = generateMessageHash(nonce, sourceDomain, source, assetId, amount, destDomain, destAddr);

    const signatureStringsig = await bridgeOwner.signMessage(ethers.utils.arrayify(digest));

    let preAd3Balance = await ad3Contract.balanceOf(ad3Owner.address);
    let preBridgeBalance = await ad3Contract.balanceOf(bridgeContract.address);

    await expect(bridgeContract.withdraw(nonce, assetId, amount, sourceDomain, source, destAddr, signatureStringsig)).to.emit(bridgeContract, "Withdrawed").withArgs(nonce, assetId, amount, sourceDomain, source, destDomain, destAddr);

    let postAd3Balance = await ad3Contract.balanceOf(ad3Owner.address);
    let postBridgeBalance = await ad3Contract.balanceOf(bridgeContract.address);
    expect(postAd3Balance).to.equal(preAd3Balance.add(100));
    expect(postBridgeBalance).to.equal(preBridgeBalance.sub(100));
    expect(preAd3Balance.add(preBridgeBalance)).to.equal(postAd3Balance.add(postBridgeBalance));
  });

  it("Should fail to withdraw if withdrawed before", async function () {
    const sourceDomain = 2;
    const source = ethers.utils.formatBytes32String("abdc");
    const nonce = 1;
    const amount = 100;
    const destDomain = 1;
    const destAddr = ad3Owner.address;

    await ad3Contract.approve(bridgeContract.address, 100);
    await bridgeContract.deposit(assetId, amount, sourceDomain, source);

    const digest = generateMessageHash(nonce, sourceDomain, source, assetId, amount, destDomain, destAddr);

    const signatureStringsig = await bridgeOwner.signMessage(ethers.utils.arrayify(digest));

    await bridgeContract.withdraw(nonce, assetId, amount, sourceDomain, source, destAddr, signatureStringsig);
    await expect(bridgeContract.withdraw(nonce, assetId, amount, sourceDomain, source, destAddr, signatureStringsig)).to.be.revertedWith("nonce already used");

  });

  it("should fail when signauture not valid", async function () {
    const sourceDomain = 2;
    const source = ethers.utils.formatBytes32String("abdc");
    const nonce = 1;
    const amount = 100;
    const destDomain = 1;
    const destAddr = ad3Owner.address;

    await ad3Contract.approve(bridgeContract.address, 100);
    await bridgeContract.deposit(assetId, amount, sourceDomain, source);

    const digest = generateMessageHash(nonce, sourceDomain, source, assetId, amount, destDomain, destAddr);
    const signatureStringsig = await ad3Owner.signMessage(ethers.utils.arrayify(digest));

    let preAd3Balance = await ad3Contract.balanceOf(ad3Owner.address);
    let preBridgeBalance = await ad3Contract.balanceOf(bridgeContract.address);
    await expect(bridgeContract.withdraw(nonce, assetId, amount, sourceDomain, source, destAddr, signatureStringsig)).to.be.revertedWith("invalid signature");
    let postAd3Balance = await ad3Contract.balanceOf(ad3Owner.address);
    let postBridgeBalance = await ad3Contract.balanceOf(bridgeContract.address);

    expect(postAd3Balance).to.equal(preAd3Balance);
    expect(postBridgeBalance).to.equal(preBridgeBalance);

  });

  it("should fail to deposit when balance is not enough", async function () {
    const sourceDomain = 2;
    const source = ethers.utils.formatBytes32String("abdc");
    const amount = 100;

    await ad3Contract.connect(bridgeOwner).approve(bridgeContract.address, 100);
    await expect(bridgeContract.connect(bridgeOwner).deposit(assetId, amount, sourceDomain, source)).to.be.revertedWith("ERC20: transfer amount exceeds balance");
  });

  it("Owner should be able to withdraw", async function () {
    const sourceDomain = 2;
    const source = ethers.utils.formatBytes32String("abdc");
    const nonce = 1;
    const amount = 100;
    const destDomain = 1;
    const destAddr = ad3Owner.address;

    await ad3Contract.approve(bridgeContract.address, 100);
    await bridgeContract.deposit(assetId, amount, sourceDomain, source);

    let preAd3Balance = await ad3Contract.balanceOf(bridgeOwner.address);
    await bridgeContract.connect(bridgeOwner).withdrawByOwner(assetId, amount, bridgeOwner.address);
    let postAd3Balance = await ad3Contract.balanceOf(bridgeOwner.address);
    expect(postAd3Balance).to.equal(preAd3Balance.add(100));
  });

  it("Should not be able to withdraw if not owner", async function () {
    const sourceDomain = 2;
    const source = ethers.utils.formatBytes32String("abdc");
    const nonce = 1;
    const amount = 100;
    const destDomain = 1;
    const destAddr = ad3Owner.address;

    await ad3Contract.approve(bridgeContract.address, 100);
    await bridgeContract.deposit(assetId, amount, sourceDomain, source);

    await expect(bridgeContract.connect(ad3Owner).withdrawByOwner(assetId, amount, bridgeOwner.address)).to.be.revertedWith("Ownable: caller is not the owner");
  });
});

function generateMessageHash(nonce: number,
                     sourceDomain: number,
                     sender: string,
                     assetId: number,
                     amount: number,
                     destDomain: number,
                     destinationRecepient: string,
                     ): string {
    const messageBytes = ethers.utils.solidityPack(['uint256', 'uint256', 'uint256', 'uint256', 'bytes', 'uint256', 'address'], [nonce, assetId, amount, sourceDomain, sender, destDomain, destinationRecepient]);
    const messageDigest = ethers.utils.keccak256(messageBytes);
    return messageDigest;
}
