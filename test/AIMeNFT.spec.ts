import { ethers } from "hardhat";
import { AIMeFactory, AIMeNFT, AIMePower } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { genSig } from "./AIMeFactory.spec";
const { expect } = require("chai");

describe("AIMeNFT", () => {
  let aimeFactoryContract: AIMeFactory;
  let aimeNFTContract: AIMeNFT;
  let aimePowerContract: AIMePower;
  let owner: SignerWithAddress;
  let aimeSigner: SignerWithAddress;
  let signer3: SignerWithAddress;
  let signer4: SignerWithAddress;
  const protocolFeeEthValue = "0.001";
  const powerTotalAmount = ethers.utils.parseEther("1000000");

  beforeEach("init", async () => {
    [owner, aimeSigner, signer3, signer4] = await ethers.getSigners();

    const aimeContractFactory = await ethers.getContractFactory("AIMeFactory");
    aimeFactoryContract = await aimeContractFactory.deploy();
    await aimeFactoryContract.deployed();
  });

  describe("Contract deployed", () => {
    it("aime factory contract deployed with owner", async () => {
      // const aimeSigner = await aimeFactoryContract.aimeSigner();
      // expect(aimeSigner).eq(ethers.constants.AddressZero);
      const ownerAddress = await owner.getAddress();
      const contractOwner = await aimeFactoryContract.owner();
      expect(contractOwner).eq(ownerAddress);
    });
  });

  describe("AIME NFT contract", () => {
    let name = "test_aime";
    let key = "basic_prompt";
    let type = "static";
    let data = "Hello World";
    let image = "image_url";
    let avatar = "avatar_url";

    beforeEach("init AIME NFT contract", async () => {
      // // set signer
      // const txSigner = await aimeFactoryContract
      //   .connect(owner)
      //   .updateSigner(aimeSigner.address);
      // await txSigner.wait();
      // const newSigner = await aimeFactoryContract.aimeSigner();
      // expect(newSigner).eq(aimeSigner.address);

      // create AIME NFT by signer3
      // const currentNonce = await aimeFactoryContract.addressNonce(
      //   signer3.address
      // );
      // const sig = await genSig(
      //   aimeSigner,
      //   signer3.address,
      //   signer3.address,
      //   name,
      //   key,
      //   type,
      //   data,
      //   avatar,
      //   image,
      //   0,
      //   currentNonce
      // );
      const tx = await aimeFactoryContract
        .connect(signer3)
        .createAIME(name, avatar, data, image, aimeSigner.address, {
          value: ethers.utils.parseEther(protocolFeeEthValue),
        });
      const receipt = await tx.wait();
      const aimeCreatedEvent = receipt.events?.find(
        (e: any) => e.event === "AIMeCreated"
      );
      const aimeNftContractAddress = aimeCreatedEvent?.args?.aimeAddress;
      const aimeNFTContractFactory = await ethers.getContractFactory("AIMeNFT");
      aimeNFTContract = await aimeNFTContractFactory.attach(
        aimeNftContractAddress
      );

      const aimePowerAddress = await aimeNFTContract.aimePowerAddress();
      const aimePowerContractFactory = await ethers.getContractFactory(
        "AIMePower"
      );
      aimePowerContract = await aimePowerContractFactory.attach(
        aimePowerAddress
      );
    });

    it("AIME NFT contracts deployed", async () => {
      const aimePowerReserved = await aimeNFTContract.aimePowerReserved();
      expect(aimePowerReserved).eq(powerTotalAmount);
      const factoryAddress = await aimeNFTContract.factory();
      expect(factoryAddress).eq(aimeFactoryContract.address);

      const powerTotalSupply = await aimePowerContract.totalSupply();
      expect(powerTotalSupply).eq(powerTotalAmount);

      const currentPowerSupply = await aimeNFTContract.powersSupply();
      const tradeMinAmount =
        await aimeNFTContract.AIME_POWER_TRADE_MIN_AMOUNT();
      expect(currentPowerSupply).eq(tradeMinAmount);

      const nftInfo = await aimeNFTContract.tokenContents(0);
      expect(nftInfo.key).eq(key);
      expect(nftInfo.dataType).eq(type);
      expect(nftInfo.data).eq(data);
      expect(nftInfo.image).eq(image);
      expect(nftInfo.amount).eq(0);
    });

    it("only factory can mint and update", async () => {
      await expect(
        aimeNFTContract
          .connect(signer3)
          .safeMint(signer3.address, "key", "type", "data", "image", 200)
      ).to.be.revertedWith(`AIMeNFTUnauthorizedAccount("${signer3.address}")`);

      await expect(
        aimeNFTContract
          .connect(signer3)
          .updateAIMeInfo(1, signer3.address, "data", "image_url")
      ).to.be.revertedWith(`AIMeNFTUnauthorizedAccount("${signer3.address}")`);
    });

    describe("manage nft", () => {
      let key = "new_nft_key";
      let type = "new_nft_type";
      let data = "new_nft_data";
      let nft_price = ethers.utils.parseEther("20");
      const tokenId = 1;

      beforeEach("mint new nft to signer3", async () => {
        const currentNonce = await aimeFactoryContract.addressNonce(
          signer3.address
        );
        const sig = await genSig(
          aimeSigner,
          signer3.address,
          aimeNFTContract.address,
          0,
          key,
          type,
          data,
          image,
          nft_price,
          currentNonce
        );
        const reservedAmount = await aimeNFTContract.aimePowerReserved();
        const tx = await aimeFactoryContract
          .connect(signer3)
          .mintAIMeNFT(
            aimeNFTContract.address,
            key,
            type,
            data,
            image,
            nft_price,
            sig,
            { value: ethers.utils.parseEther(protocolFeeEthValue) }
          );
        await tx.wait();
        const reservedAmountAfter = await aimeNFTContract.aimePowerReserved();
        expect(reservedAmountAfter).eq(reservedAmount.sub(nft_price));
      });

      it("mint success", async () => {
        const newNftOwner = await aimeNFTContract.ownerOf(1);
        expect(newNftOwner).eq(signer3.address);
        const newNftInfo = await aimeNFTContract.tokenContents(1);
        expect(newNftInfo.key).eq(key);
        expect(newNftInfo.dataType).eq(type);
        expect(newNftInfo.data).eq(data);
        expect(newNftInfo.image).eq(image);
        expect(newNftInfo.amount).eq(nft_price);
        expect(newNftInfo.currentAmount).eq(nft_price);
      });

      it("owner can update nft info", async () => {
        const updateData = "update_data";
        const updateImage = "update_image";
        const currentNonceFor4 = await aimeFactoryContract.addressNonce(
          signer4.address
        );
        const sigFor4 = await genSig(
          aimeSigner,
          signer4.address,
          aimeNFTContract.address,
          tokenId,
          "",
          "",
          updateData,
          updateImage,
          0,
          currentNonceFor4
        );

        await expect(
          aimeFactoryContract
            .connect(signer4)
            .updateAIMeNFT(
              aimeNFTContract.address,
              tokenId,
              updateData,
              updateImage,
              sigFor4,
              { value: ethers.utils.parseEther(protocolFeeEthValue) }
            )
        ).to.be.revertedWith(`Invalid token owner`);

        const currentNonceFor3 = await aimeFactoryContract.addressNonce(
          signer3.address
        );
        const sigFor3 = await genSig(
          aimeSigner,
          signer3.address,
          aimeNFTContract.address,
          tokenId,
          "",
          "",
          updateData,
          updateImage,
          0,
          currentNonceFor3
        );
        const tx = await aimeFactoryContract
          .connect(signer3)
          .updateAIMeNFT(
            aimeNFTContract.address,
            tokenId,
            updateData,
            updateImage,
            sigFor3,
            { value: ethers.utils.parseEther(protocolFeeEthValue) }
          );
        await tx.wait();
        const updatedNFTData = await aimeNFTContract.tokenContents(tokenId);
        expect(updatedNFTData.data).eq(updateData);
        expect(updatedNFTData.image).eq(updateImage);
      });

      it("owner can sell nft for power", async () => {
        await expect(
          aimeNFTContract.connect(signer4).sellNFT(tokenId)
        ).to.be.revertedWith(
          `ERC721IncorrectOwner("${signer4.address}", ${tokenId}, "${signer3.address}")`
        );

        // signer3 sell nft
        const powerBalanceBefore = await aimePowerContract.balanceOf(
          signer3.address
        );
        const contractBalanceBefore = await aimePowerContract.balanceOf(
          aimeNFTContract.address
        );
        const tx = await aimeNFTContract.connect(signer3).sellNFT(tokenId);
        await tx.wait();
        const powerBalanceAfter = await aimePowerContract.balanceOf(
          signer3.address
        );
        const contractBalanceAfter = await aimePowerContract.balanceOf(
          aimeNFTContract.address
        );
        expect(powerBalanceAfter).eq(powerBalanceBefore.add(nft_price));
        expect(contractBalanceAfter).eq(contractBalanceBefore.sub(nft_price));
        const newNftOwner = await aimeNFTContract.ownerOf(tokenId);
        expect(newNftOwner).eq(aimeNFTContract.address);
      });

      it("can buy nft from AI with original price", async () => {
        await expect(
          aimeNFTContract.connect(signer4).buyNFT(0)
        ).to.be.revertedWith("Cannot buy the first NFT");

        // signer3 sell nft to ai
        const tx = await aimeNFTContract.connect(signer3).sellNFT(tokenId);
        await tx.wait();

        // signer4 buy nft from ai
        await expect(
          aimeNFTContract.connect(signer4).buyNFT(tokenId)
        ).to.be.revertedWith("balance not enough");
        // signer4 buy some power
        const powerAmountToBuy = ethers.utils.parseEther("100");
        const buyPriceWithFee = await aimeNFTContract.getBuyPriceAfterFee(
          powerAmountToBuy
        );
        const txBuyPower = await aimeNFTContract
          .connect(signer4)
          .buyPowers(powerAmountToBuy, { value: buyPriceWithFee });
        await txBuyPower.wait();

        // signer4 has to set allowance before buy nft
        await expect(
          aimeNFTContract.connect(signer4).buyNFT(tokenId)
        ).to.be.revertedWith("allowance not enough");

        const txApprove = await aimePowerContract
          .connect(signer4)
          .approve(aimeNFTContract.address, nft_price);
        await txApprove.wait();

        const userPowerBalanceBefore = await aimePowerContract.balanceOf(
          signer4.address
        );
        const aiPowerBalanceBefore = await aimePowerContract.balanceOf(
          aimeNFTContract.address
        );
        const txBuyNft = await aimeNFTContract.connect(signer4).buyNFT(tokenId);
        await txBuyNft.wait();
        const newNftOwner = await aimeNFTContract.ownerOf(tokenId);
        const userPowerBalanceAfter = await aimePowerContract.balanceOf(
          signer4.address
        );
        const aiPowerBalanceAfter = await aimePowerContract.balanceOf(
          aimeNFTContract.address
        );
        expect(newNftOwner).eq(signer4.address);
        expect(userPowerBalanceAfter).eq(userPowerBalanceBefore.sub(nft_price));
        expect(aiPowerBalanceAfter).eq(aiPowerBalanceBefore.add(nft_price));
      });

      it("can buy nft from other user", async () => {
        // cannot buy if balance not enough
        await expect(
          aimeNFTContract.connect(signer4).buyNFT(tokenId)
        ).to.be.revertedWith("balance not enough");

        // buy some token for signer3 and signer4
        const powerAmountToBuy = ethers.utils.parseEther("100");
        const buyPriceWithFeeFor4 = await aimeNFTContract.getBuyPriceAfterFee(
          powerAmountToBuy
        );
        const txBuyPower4 = await aimeNFTContract
          .connect(signer4)
          .buyPowers(powerAmountToBuy, { value: buyPriceWithFeeFor4 });
        await txBuyPower4.wait();

        const buyPriceWithFeeFor3 = await aimeNFTContract.getBuyPriceAfterFee(
          powerAmountToBuy
        );
        const txBuyPower3 = await aimeNFTContract
          .connect(signer3)
          .buyPowers(powerAmountToBuy, { value: buyPriceWithFeeFor3 });
        await txBuyPower3.wait();

        // signer4 buy nft from signer3
        await expect(
          aimeNFTContract.connect(signer4).buyNFT(tokenId)
        ).to.be.revertedWith("allowance not enough");
        const currentNftPrice = nft_price.mul(12).div(10);
        const txApprove = await aimePowerContract
          .connect(signer4)
          .approve(aimeNFTContract.address, currentNftPrice);
        await txApprove.wait();

        const powerBalanceBefore4 = await aimePowerContract.balanceOf(
          signer4.address
        );
        const powerBalanceBefore3 = await aimePowerContract.balanceOf(
          signer3.address
        );
        const txBuyFrom3 = await aimeNFTContract
          .connect(signer4)
          .buyNFT(tokenId);
        await txBuyFrom3.wait();
        const newNftOwner = await aimeNFTContract.ownerOf(tokenId);
        const powerBalanceAfter4 = await aimePowerContract.balanceOf(
          signer4.address
        );
        const powerBalanceAfter3 = await aimePowerContract.balanceOf(
          signer3.address
        );
        const nftCurrentInfo = await aimeNFTContract.tokenContents(tokenId);
        expect(newNftOwner).eq(signer4.address);
        expect(powerBalanceAfter4).eq(powerBalanceBefore4.sub(currentNftPrice));
        expect(powerBalanceAfter3).eq(powerBalanceBefore3.add(currentNftPrice));
        expect(nftCurrentInfo.amount).eq(nft_price);
        expect(nftCurrentInfo.currentAmount).eq(currentNftPrice);

        // signer4 sell nft to ai for original price
        const powerBalanceBeforeSellAi = await aimePowerContract.balanceOf(
          signer4.address
        );
        const contractBalanceBeforeSellAi = await aimePowerContract.balanceOf(
          aimeNFTContract.address
        );
        const txSellToAi = await aimeNFTContract
          .connect(signer4)
          .sellNFT(tokenId);
        await txSellToAi.wait();
        const powerBalanceAfterSellAi = await aimePowerContract.balanceOf(
          signer4.address
        );
        const contractBalanceAfterSellAi = await aimePowerContract.balanceOf(
          aimeNFTContract.address
        );
        expect(powerBalanceAfterSellAi).eq(
          powerBalanceBeforeSellAi.add(nft_price)
        );
        expect(contractBalanceAfterSellAi).eq(
          contractBalanceBeforeSellAi.sub(nft_price)
        );
      });
    });

    describe("buy and sell power", () => {
      it("can buy power", async () => {
        const minTradeAmount =
          await aimeNFTContract.AIME_POWER_TRADE_MIN_AMOUNT();
        await expect(
          aimeNFTContract.connect(signer4).buyPowers(minTradeAmount.sub(1), {
            value: ethers.utils.parseEther("1"),
          })
        ).to.be.revertedWith("Amount too small");

        const buyPrice = await aimeNFTContract.getBuyPrice(minTradeAmount);
        await expect(
          aimeNFTContract.connect(signer4).buyPowers(minTradeAmount, {
            value: buyPrice,
          })
        ).to.be.revertedWith("Insufficient payment");

        const buyPriceAfterFee = await aimeNFTContract.getBuyPriceAfterFee(
          minTradeAmount
        );
        const userEthBalanceBefore = await ethers.provider.getBalance(
          signer4.address
        );
        const userPowerBalanceBefore = await aimePowerContract.balanceOf(
          signer4.address
        );
        const aimeNftContractEthBalanceBefore =
          await ethers.provider.getBalance(aimeNFTContract.address);
        const aimeNftContractPowerBalanceBefore =
          await aimePowerContract.balanceOf(aimeNFTContract.address);
        const aimeFactoryContractEthBalanceBefore =
          await ethers.provider.getBalance(aimeFactoryContract.address);
        const txBuyPower = await aimeNFTContract
          .connect(signer4)
          .buyPowers(minTradeAmount, {
            value: buyPriceAfterFee,
          });
        const receipt = await txBuyPower.wait();
        const userEthBalanceAfter = await ethers.provider.getBalance(
          signer4.address
        );
        const userPowerBalanceAfter = await aimePowerContract.balanceOf(
          signer4.address
        );
        const aimeNftContractEthBalanceAfter = await ethers.provider.getBalance(
          aimeNFTContract.address
        );
        const aimeNftContractPowerBalanceAfter =
          await aimePowerContract.balanceOf(aimeNFTContract.address);
        const aimeFactoryContractEthBalanceAfter =
          await ethers.provider.getBalance(aimeFactoryContract.address);

        expect(userEthBalanceAfter).eq(
          userEthBalanceBefore
            .sub(buyPriceAfterFee)
            .sub(receipt.cumulativeGasUsed.mul(receipt.effectiveGasPrice))
        );
        expect(userPowerBalanceAfter).eq(
          userPowerBalanceBefore.add(minTradeAmount)
        );
        expect(aimeNftContractEthBalanceAfter).eq(
          aimeNftContractEthBalanceBefore.add(buyPrice)
        );
        expect(aimeNftContractPowerBalanceAfter).eq(
          aimeNftContractPowerBalanceBefore.sub(minTradeAmount)
        );
        expect(aimeFactoryContractEthBalanceAfter).eq(
          aimeFactoryContractEthBalanceBefore.add(
            buyPriceAfterFee.sub(buyPrice)
          )
        );

        // transfer eth fee to owner
        const ownerEthBalanceBefore = await ethers.provider.getBalance(
          owner.address
        );
        const txWithdrawFee = await aimeFactoryContract.withdrawFee();
        const receiptWithdrawFee = await txWithdrawFee.wait();
        const ownerEthBalanceAfter = await ethers.provider.getBalance(
          owner.address
        );
        const aimeFactoryContractEthBalanceAfterWithdrawFee =
          await ethers.provider.getBalance(aimeFactoryContract.address);

        expect(ownerEthBalanceAfter).eq(
          ownerEthBalanceBefore
            .add(aimeFactoryContractEthBalanceAfter)
            .sub(
              receiptWithdrawFee.cumulativeGasUsed.mul(
                receiptWithdrawFee.effectiveGasPrice
              )
            )
        );
        expect(aimeFactoryContractEthBalanceAfterWithdrawFee).eq(0);
      });

      it("can sell power back to contract", async () => {
        const minTradeAmount =
          await aimeNFTContract.AIME_POWER_TRADE_MIN_AMOUNT();
        await expect(
          aimeNFTContract.connect(signer4).sellPowers(minTradeAmount.sub(1))
        ).to.be.revertedWith("Amount too small");
        await expect(
          aimeNFTContract.connect(signer4).sellPowers(minTradeAmount)
        ).to.be.revertedWith("Pool run out");

        // buy power from contract
        const userPowerBalanceBefore = await aimePowerContract.balanceOf(
          signer4.address
        );
        const reservedPowerAmountBeforeBuys =
          await aimeNFTContract.aimePowerReserved();
        const aimeNftContractEthBalanceBeforeBuys =
          await ethers.provider.getBalance(aimeNFTContract.address);
        const aimeNftContractPowerBalanceBeforeBuys =
          await aimePowerContract.balanceOf(aimeNFTContract.address);
        const buyAmount = ethers.utils.parseEther("1");
        const buyPrice1 = await aimeNFTContract.getBuyPriceAfterFee(buyAmount);
        const txBuyPower1 = await aimeNFTContract
          .connect(signer4)
          .buyPowers(buyAmount, { value: buyPrice1 });
        const receiptBuyPower1 = await txBuyPower1.wait();

        const buyPrice2 = await aimeNFTContract.getBuyPriceAfterFee(buyAmount);
        const txBuyPower2 = await aimeNFTContract
          .connect(signer4)
          .buyPowers(buyAmount, { value: buyPrice2 });
        const receiptBuyPower2 = await txBuyPower2.wait();

        const currentSupply = await aimeNFTContract.powersSupply();
        expect(currentSupply).eq(buyAmount.add(buyAmount).add(minTradeAmount));
        const reservedPowerAmountAfterBuys =
          await aimeNFTContract.aimePowerReserved();
        expect(reservedPowerAmountAfterBuys).eq(
          reservedPowerAmountBeforeBuys.sub(buyAmount.add(buyAmount))
        );

        await expect(
          aimeNFTContract.connect(signer3).sellPowers(buyAmount)
        ).to.be.revertedWith("balance not enough");
        await expect(
          aimeNFTContract.connect(signer4).sellPowers(buyAmount)
        ).to.be.revertedWith("allowance not enough");

        // sell and sell
        const userEthBalanceBeforeSells = await ethers.provider.getBalance(
          signer4.address
        );
        const sellPriceFor2Sells = await aimeNFTContract.getSellPrice(
          buyAmount.add(buyAmount)
        );
        const sellPriceFor2SellsAfterFee = await aimeNFTContract.getSellPriceAfterFee(buyAmount.add(buyAmount));
        const fee = sellPriceFor2Sells.sub(sellPriceFor2SellsAfterFee);
        const protocalEthBalanceBeforeSells = await ethers.provider.getBalance(
          aimeFactoryContract.address
        );

        const txApprove = await aimePowerContract
          .connect(signer4)
          .approve(aimeNFTContract.address, buyAmount.add(buyAmount));
        const receiptApprove = await txApprove.wait();

        const txSell1 = await aimeNFTContract
          .connect(signer4)
          .sellPowers(buyAmount.add(buyAmount));
        const receiptSell1 = await txSell1.wait();

        const currentSupplyAfterSells = await aimeNFTContract.powersSupply();
        expect(currentSupplyAfterSells).eq(minTradeAmount);
        const reservedPowerAmountAfterSells =
          await aimeNFTContract.aimePowerReserved();
        expect(reservedPowerAmountAfterSells).eq(reservedPowerAmountBeforeBuys);
        const aimeNftContractPowerBalanceAfterSells =
          await aimePowerContract.balanceOf(aimeNFTContract.address);
        expect(aimeNftContractPowerBalanceAfterSells).eq(
          aimeNftContractPowerBalanceBeforeBuys
        );
        const protocalEthBalanceAfterSells = await ethers.provider.getBalance(
          aimeFactoryContract.address
        );
        expect(protocalEthBalanceAfterSells).eq(
          protocalEthBalanceBeforeSells.add(fee)
        );

        const aimeNftContractEthBalanceAfterSells =
          await ethers.provider.getBalance(aimeNFTContract.address);
        expect(aimeNftContractEthBalanceAfterSells).eq(
          aimeNftContractEthBalanceBeforeBuys
        );

        const userEthBalanceAfterSells = await ethers.provider.getBalance(
          signer4.address
        );
        expect(userEthBalanceAfterSells).eq(
          userEthBalanceBeforeSells
            .add(sellPriceFor2SellsAfterFee)
            .sub(
              receiptSell1.cumulativeGasUsed.mul(receiptSell1.effectiveGasPrice)
            )
            .sub(
              receiptApprove.cumulativeGasUsed.mul(
                receiptApprove.effectiveGasPrice
              )
            )
        );

        const userPowerBalanceAfterSells = await aimePowerContract.balanceOf(
          signer4.address
        );
        expect(userPowerBalanceAfterSells).eq(userPowerBalanceBefore);
        const allowanceAfterSells = await aimePowerContract.allowance(
          signer4.address,
          aimeNFTContract.address
        );
        expect(allowanceAfterSells).eq(0);
      });
    });
  });
});
