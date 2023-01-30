import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { use, expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { BigNumber, Signer } from "ethers";
import { ethers, upgrades } from "hardhat";
import { deployAd3 } from "../scripts/influencemining/deployAD3";
import { AD3, EIP5489ForInfluenceMining } from "../typechain";
use(chaiAsPromised);

let imContract: EIP5489ForInfluenceMining;
let owner: SignerWithAddress;
let signer2: SignerWithAddress;
let tokenId: BigNumber;
let ad3Contract: AD3;

describe("UpgradeLevel", function () {
  beforeEach(async () => {
    await _beforeEach();
  });

  it("Should upgradeLevel", async function () {
    //prepare
    let tokenId = 1;
    let targetLevel = 2;
    const iconUri =
      "https://ipfs.parami.io/ipfs/QmWjFHRBL56GDsojZZNmzgq1oeYKqFnz7M28viVmDDz1xm";
    await imContract
      .connect(owner)
      .manageLevelPrices(
        [1, 2, 3],
        [1n * 10n ** 18n, 2n * 10n ** 18n, 3n * 10n ** 18n]
      );
    await imContract.connect(owner).mint(iconUri);

    //prepare before action stat for verify
    let balanceBefore = await ad3Contract.balanceOf(owner.address);

    //action
    await ad3Contract.connect(owner).approve(imContract.address, 2n * 10n ** 18n);
    await imContract.connect(owner).upgradeTo(tokenId, targetLevel);

    //prepare after action for verify
    let balanceAfter = await ad3Contract.balanceOf(owner.address);
    const level = await imContract.token2Level(tokenId);
    //verify
    expect(level).to.be.eq(targetLevel);
    expect(balanceAfter).to.be.eq(balanceBefore.sub(2n * 10n ** 18n));
  });

  it("Should not upgradeLevel when level not exists", async () => {
    //prepare
    let tokenId = 1;
    let targetLevel = 4;
    const iconUri =
      "https://ipfs.parami.io/ipfs/QmWjFHRBL56GDsojZZNmzgq1oeYKqFnz7M28viVmDDz1xm";
    await imContract
      .connect(owner)
      .manageLevelPrices(
        [1, 2, 3],
        [1n * 10n ** 18n, 2n * 10n ** 18n, 3n * 10n ** 18n]
      );
    await imContract.connect(owner).mint(iconUri);

    //action
    await ad3Contract.connect(owner).approve(imContract.address, 2n * 10n ** 18n);
    let res = imContract.connect(owner).upgradeTo(tokenId, targetLevel);

    //verify
    await expect(res).to.be.rejected.then((e) => {
      console.log(e.message);
      expect(e.message).contains("targetLevel should exist");
    });
  });

  it("Should not upgradeLevel when ad3 balance is not enough", async () => {
    //prepare
    let tokenId = 1;
    let targetLevel = 2;
    const iconUri =
      "https://ipfs.parami.io/ipfs/QmWjFHRBL56GDsojZZNmzgq1oeYKqFnz7M28viVmDDz1xm";
    await imContract
      .connect(owner)
      .manageLevelPrices(
        [1, 2, 3],
        [1n * 10n ** 18n, 2n * 10n ** 18n, 3n * 10n ** 18n]
      );
    await imContract.connect(signer2).mint(iconUri);

    //action
    await expect(
      imContract.connect(signer2).upgradeTo(tokenId, targetLevel)
    ).to.be.rejected.then((e) => {
      console.log(e.message);
      expect(e.message as string).contains("should have enough ad3");
    });
  });
});

describe("withdrawAllAd3", () => {
  beforeEach(async () => {
    await _beforeEach();
  });

  it("should withdrawAllAd3", async () => {
    await ad3Contract.transfer(imContract.address, 20n * 10n ** 18n);

    //prepare stat before action for verify
    let contractBalanceBeforeWithdraw = await ad3Contract.balanceOf(imContract.address);
    let ownerBalanceBeforeWithdraw = await ad3Contract.balanceOf(owner.address);

    //action
    await imContract.withdrawAllAd3();

    //prepare stat after action for verify
    let contractBalanceAfterWithdraw = await ad3Contract.balanceOf(imContract.address);
    let ownerBalanceAfterWithdraw = await ad3Contract.balanceOf(owner.address);

    //verify
    expect(contractBalanceAfterWithdraw).to.be.eq(0n);
    expect(ownerBalanceAfterWithdraw).to.be.eq(ownerBalanceBeforeWithdraw.add(contractBalanceBeforeWithdraw));
  });
});

async function _beforeEach() {
  [owner, signer2] = await ethers.getSigners();
  ad3Contract = await deployAd3(owner.address);
  await ad3Contract.proposeLosslessTurnOff();
  await ad3Contract.executeLosslessTurnOff();

  const factory = await ethers.getContractFactory("EIP5489ForInfluenceMining");
  imContract = (await upgrades.deployProxy(factory, [
    ad3Contract.address,
  ])) as EIP5489ForInfluenceMining;
  await imContract.deployed();

  const balanceOfOwner = await ad3Contract.balanceOf(owner.address);
  console.log("balanceOfOwner is ", balanceOfOwner);
}
