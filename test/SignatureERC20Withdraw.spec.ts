import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { verify } from "crypto";
import { BigNumber, BigNumberish, Contract } from "ethers";
import { stat } from "fs";
import { ethers, upgrades } from "hardhat";
import { string } from "hardhat/internal/core/params/argumentTypes";
import { deployAd3 } from "../scripts/influencemining/deployAD3";
import { AD3, SignatureERC20Withdraw } from "../typechain";

let owner: SignerWithAddress;
let signer2: SignerWithAddress;
let ad3Contract: AD3;
let utContract: SignatureERC20Withdraw;
const chainIdInContract = 5;
describe("SignatureERC20Withdraw", () => {
  beforeEach("init", async () => {
    await _beforeEach();
  });
  describe("withdraw", () => {
    it("should success", async () => {
      const params = {
        ...validParams(),
      };

      const context = newTestContext(params);

      await context.action();
      const { before, after } = await context.getBeforeAndAfter();
      //verify
      //1. userBalance increased as expected
      expect(after!.userBalance).to.be.eq(
        before!.userBalance.add(params.amount)
      );
      //2. contractBalance decreased as expected
      expect(after!.contractBalance).to.be.eq(
        before!.contractBalance.sub(params.amount)
      );
    });

    it("should fail when signature not valid", async () => {
      const params: Params = {
        ...validParams(),
        validSig: false,
      };

      const testContext = await newTestContext(params);

      const res = testContext.action();
      //verify
      //3. error
      await expect(res).to.be.rejected.then((e) => {
        expect(e.message).contain("signature not valid");
      });
      testContext.expectStatNotChanged();
    });

    it("should fail when chainId not matched with contract", async () => {
      //prepare
      const params = {
        ...validParams(),
        chainId: chainIdInContract + 200,
      };
      const context = await newTestContext(params);
      //action
      let res = context.action();
      //verify

      //3. error
      await expect(res).to.be.rejected.then((e) => {
        expect(e.message).contains(
          "chainId in params should match the contract's chainId"
        );
      });
      context.expectStatNotChanged();
    });

    it("should fail when  contract balance not enough", async () => {
      //prepare
      const params = {
        ...validParams(),
        amount: ethers.utils.parseUnits("100", 18),
        contractInitBalance: ethers.utils.parseUnits("50", 18),
      } as Params;

      const context = newTestContext(params);
      //action
      const res = context.action();
      //verify
      //3. error
      await expect(res).to.be.rejected.then((e) => {
        expect(e.message).contains("LERC20: transfer amount exceeds balance");
      });

      context.expectStatNotChanged();
    });

    it("should fail when nounce used", async () => {
      await newTestContext(validParams()).action();

      const context = newTestContext({ ...validParams() });
      const res = context.action();

      await expect(res).to.be.rejected.then((e) => {
        expect(e.message).contains("nounce must not used");
      });

      context.expectStatNotChanged();
    });

    it("should fail when paused", async () => {
      const params = validParams();
      const context = newTestContext(params);
      //action
      await utContract.ownerPause();
      const res = context.action();

      await expect(res).to.be.rejected.then((e) => {
        expect(e.message).contains("Pausable: paused");
      });
      context.expectStatNotChanged();
    });

    type Params = {
      attester: SignerWithAddress;
      to: string;
      chainId: BigNumberish;
      amount: BigNumberish;
      nounce: BigNumberish;
      validSig: boolean;
      contractInitBalance: BigNumberish;
    };

    const validParams = () => {
      return {
        attester: owner,
        to: "0x2C71b3E0B068C4d365AdD4035Dc7f8eB6dC6C910",
        chainId: chainIdInContract,
        amount: ethers.utils.parseUnits("100", 18),
        nounce: 121,
        // control behavior
        validSig: true,
        contractInitBalance: ethers.utils.parseUnits("10000", 18),
      };
    };

    type Stat = { userBalance: BigNumber; contractBalance: BigNumber };

    const newTestContext = (_params: Params) => {
      const genSig = async (
        attester: SignerWithAddress,
        to: string,
        chainId: BigNumberish,
        amount: BigNumberish,
        nounce: BigNumberish
      ) => {
        let message = ethers.utils.solidityPack(
          ["address", "uint256", "uint256", "uint256"],
          [to, chainId, amount, nounce]
        );
        message = ethers.utils.solidityKeccak256(["bytes"], [message]);
        const signature = await attester.signMessage(
          ethers.utils.arrayify(message)
        );
        return signature;
      };

      const getStat = async () => {
        const userBalance = await ad3Contract.balanceOf(_params.to);
        const contractBalance = await ad3Contract.balanceOf(utContract.address);
        return { userBalance, contractBalance };
      };

      let before: Stat | undefined = undefined;
      let after: Stat | undefined = undefined;

      return {
        params: _params,
        validParams: {} as Params,
        getBeforeAndAfter: () => {
          return { before, after };
        },
        action: async () => {
          await ad3Contract.transfer(
            utContract.address,
            _params.contractInitBalance
          );
          let sig = await genSig(
            _params.attester,
            _params.to,
            _params.chainId,
            _params.validSig
              ? _params.amount
              : BigNumber.from(_params.amount).add(20),
            _params.nounce
          );

          before = await getStat();
          try {
            await utContract.withdraw(
              _params.to,
              _params.chainId,
              _params.amount,
              _params.nounce,
              sig
            );
          } catch (e) {
            throw e;
          } finally {
            after = await getStat();
          }
        },
        expectStatNotChanged: () => {
          //1. userBalance not changed
          expect(after!.userBalance).to.be.eq(before!.userBalance);
          //2. contractBalance not changed
          expect(after!.contractBalance).to.be.eq(before!.contractBalance);
        },
      };
    };
  });

  describe("OwnerPausable", () => {
    describe("ownerPause", () => {
      it("should success", async () => {
        await utContract.connect(owner).ownerPause();
        const res = await utContract.paused();
        expect(res).to.be.eq(true);
        const paused = await utContract.paused();
        expect(paused).to.be.eq(true);
      });

      it("should fail when msg.send is not owner", async () => {
        const res = utContract.connect(signer2).ownerPause();
        expectErrorMessageContains(res, "Ownable: caller is not the owner");
        const paused = await utContract.paused();
        expect(paused).to.be.eq(false);
      });

      it("should fail when paused", async () => {
        await utContract.connect(owner).ownerPause();
        const res = utContract.connect(owner).ownerPause();
        expectErrorMessageContains(res, "Pausable: paused");
      });
    });

    describe("ownerUnpause", () => {
      it("should success", async () => {
        await utContract.connect(owner).ownerPause();
        await utContract.connect(owner).ownerUnPause();
        const res = await utContract.connect(owner).paused();
        expect(res).to.be.eq(false);
      });

      it("should fail when msg.sender is not owner", async () => {
        await utContract.connect(owner).ownerPause();
        const res = utContract.connect(signer2).ownerUnPause();
        expectErrorMessageContains(res, "Ownable: caller is not the owner");
        const paused = await utContract.connect(owner).paused();
        expect(paused).to.be.eq(true);
      });

      it("should fail when not paused", async () => {
        await utContract.connect(owner).ownerPause();
        await utContract.connect(owner).ownerUnPause();
        const res = utContract.connect(owner).ownerUnPause();
        expectErrorMessageContains(res, "Pausable: not paused");
        const paused = await utContract.connect(owner).paused();
        expect(paused).to.be.eq(false);
      });
    });
  });

  describe("OwnerWithdrawable", () => {
    describe("withdrawAllOfERC20", () => {
      it("should success", async () => {
        await ad3Contract.transfer(utContract.address, 20n * 10n ** 18n);

        //prepare stat before action for verify
        let contractBalanceBeforeWithdraw = await ad3Contract.balanceOf(
          utContract.address
        );
        let ownerBalanceBeforeWithdraw = await ad3Contract.balanceOf(
          owner.address
        );

        //action
        await utContract.withdrawAllOfERC20(ad3Contract.address);

        //prepare stat after action for verify
        let contractBalanceAfterWithdraw = await ad3Contract.balanceOf(
          utContract.address
        );
        let ownerBalanceAfterWithdraw = await ad3Contract.balanceOf(
          owner.address
        );

        //verify
        expect(contractBalanceAfterWithdraw).to.be.eq(0n);
        expect(ownerBalanceAfterWithdraw).to.be.eq(
          ownerBalanceBeforeWithdraw.add(contractBalanceBeforeWithdraw)
        );
      });

      it("should fail when not owner", async () => {
        await ad3Contract.transfer(utContract.address, 20n * 10n ** 18n);
        const res = utContract
          .connect(signer2)
          .withdrawAllOfERC20(ad3Contract.address);
        expectErrorMessageContains(res, "Ownable: caller is not the owner");
      });
    });
  });
});
const _beforeEach = async () => {
  [owner, signer2] = await ethers.getSigners();
  ad3Contract = await deployAd3(owner.address);
  await ad3Contract.proposeLosslessTurnOff();
  await ad3Contract.executeLosslessTurnOff();

  const factory = await ethers.getContractFactory("SignatureERC20Withdraw");
  utContract = (await upgrades.deployProxy(factory, [
    ad3Contract.address,
    chainIdInContract /**goerli */,
    owner.address,
  ])) as SignatureERC20Withdraw;
  await utContract.deployed();
};

const expectErrorMessageContains = (res: Promise<any>, partialMsg: string) => {
  expect(res).to.be.rejected.then((e) => {
    expect(e.message).contains(partialMsg);
  });
};
