import { ethers } from "hardhat";
import { AIMeFactory } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumberish } from "ethers";
const { expect } = require("chai");

export const genSig = async (
  signer: SignerWithAddress,
  creatorAddress: string,
  aimeAddress: string,
  tokenId: BigNumberish,
  key: string,
  type: string,
  data: string,
  image: string,
  amount: BigNumberish,
  nounce: BigNumberish
) => {
  let message = ethers.utils.solidityPack(
    [
      "address",
      "address",
      "uint256",
      "string",
      "string",
      "string",
      "string",
      "uint256",
      "uint256",
    ],
    [
      creatorAddress,
      aimeAddress,
      tokenId,
      key,
      type,
      data,
      image,
      amount,
      nounce,
    ]
  );
  message = ethers.utils.solidityKeccak256(["bytes"], [message]);
  const signature = await signer.signMessage(ethers.utils.arrayify(message));
  return signature;
};

// export const genSigForUpdateNftData = async (
//   signer: SignerWithAddress,
//   creatorAddress: string,
//   aimeAddress: string,
//   tokenId: BigNumberish,
//   data: string,
//   image: string,
//   nounce: BigNumberish
// ) => {
//   let message = ethers.utils.solidityPack(
//     ["address", "address", "uint256", "string", "string", "uint256"],
//     [creatorAddress, aimeAddress, tokenId, data, image, nounce]
//   );
//   message = ethers.utils.solidityKeccak256(["bytes"], [message]);
//   const signature = await signer.signMessage(ethers.utils.arrayify(message));
//   return signature;
// };

describe("AIMe Factory and NFT Contract", () => {
  let aimeFactoryContract: AIMeFactory;
  let owner: SignerWithAddress;
  let aimeSigner: SignerWithAddress;
  let signer3: SignerWithAddress;
  const protocolFeeEthValue = "0.001";

  beforeEach("init", async () => {
    [owner, aimeSigner, signer3] = await ethers.getSigners();

    const aimeContractFactory = await ethers.getContractFactory("AIMeFactory");
    aimeFactoryContract = await aimeContractFactory.deploy();
    await aimeFactoryContract.deployed();
  });

  describe("Contract deploy", () => {
    it("aime contract deployed with owner", async () => {
      console.log("aimeContract address", aimeFactoryContract.address);
      // const aimeSigner = await aimeFactoryContract.aimeSigner();
      // expect(aimeSigner).eq(ethers.constants.AddressZero);
      const ownerAddress = await owner.getAddress();
      const contractOwner = await aimeFactoryContract.owner();
      expect(contractOwner).eq(ownerAddress);
    });

    // it("owner can set signer", async () => {
    //   const tx = await aimeFactoryContract
    //     .connect(owner)
    //     .updateSigner(aimeSigner.address);
    //   await tx.wait();
    //   const newSigner = await aimeFactoryContract.aimeSigner();
    //   expect(newSigner).eq(aimeSigner.address);

    //   await expect(
    //     aimeFactoryContract.connect(signer3).updateSigner(owner.address)
    //   ).to.be.revertedWith(`OwnableUnauthorizedAccount("${signer3.address}")`);
    // });

    it("owner can set protocol fee", async () => {
      const feeBefore = await aimeFactoryContract.protocolFee();
      expect(feeBefore).eq(ethers.utils.parseEther(protocolFeeEthValue));

      const newFee = ethers.utils.parseEther("1");
      const tx = await aimeFactoryContract
        .connect(owner)
        .updateProtocolFee(newFee);
      await tx.wait();
      const feeAfter = await aimeFactoryContract.protocolFee();
      expect(feeAfter).eq(newFee);

      await expect(
        aimeFactoryContract
          .connect(signer3)
          .updateProtocolFee(ethers.utils.parseEther(protocolFeeEthValue))
      ).to.be.revertedWith(`OwnableUnauthorizedAccount("${signer3.address}")`);
    });
  });

  describe("Create AIMe", () => {
    let name = "test_aime";
    let key = "basic_prompt";
    let type = "static";
    let data = "Hello World";
    let image = "image_url";
    let avatar = "avatar_url";

    it("can not create aime for free or not enough fee", async () => {
      await expect(
        aimeFactoryContract.createAIME(
          "",
          "",
          "",
          "",
          ethers.constants.AddressZero
        )
      ).to.be.revertedWith("Insufficient payment");

      await expect(
        aimeFactoryContract.createAIME(
          "",
          "",
          "",
          "",
          ethers.constants.AddressZero,
          { value: ethers.utils.parseEther("0.00001") }
        )
      ).to.be.revertedWith("Insufficient payment");
    });

    it("can create aime with fee", async () => {
      const tx = await aimeFactoryContract.createAIME(
        name,
        avatar,
        data,
        image,
        ethers.constants.AddressZero,
        { value: ethers.utils.parseEther(protocolFeeEthValue) }
      );
      await tx.wait();
    });

    it("can create aime with signer", async () => {
      const tx = await aimeFactoryContract.createAIME(
        name,
        avatar,
        data,
        image,
        aimeSigner.address,
        { value: ethers.utils.parseEther(protocolFeeEthValue) }
      );
      await tx.wait();

      const aimeAddress = await aimeFactoryContract.aimeAddresses(name);
      const aimeSignerAddress = await aimeFactoryContract.aimeSigners(
        aimeAddress
      );
      expect(aimeSignerAddress).eq(aimeSigner.address);
    });

    it("can not create aime with same name", async () => {
      const tx = await aimeFactoryContract.createAIME(
        name,
        avatar,
        data,
        image,
        aimeSigner.address,
        { value: ethers.utils.parseEther(protocolFeeEthValue) }
      );
      await tx.wait();

      await expect(
        aimeFactoryContract.createAIME(
          name,
          avatar,
          data,
          image,
          aimeSigner.address,
          { value: ethers.utils.parseEther(protocolFeeEthValue) }
        )
      ).to.be.revertedWith("AIME already exists");
    });

    it("can create aime and receive fee", async () => {
      // const currentNonce = await aimeFactoryContract.connect(owner).addressNonce(owner.address);
      // expect(currentNonce).eq(0);
      const contractBalanceBefore = await ethers.provider.getBalance(
        aimeFactoryContract.address
      );

      // const sig = await genSig(
      //   aimeSigner,
      //   owner.address,
      //   owner.address,
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
        .connect(owner)
        .createAIME(name, avatar, data, image, ethers.constants.AddressZero, {
          value: ethers.utils.parseEther(protocolFeeEthValue),
        });
      const receipt = await tx.wait();
      const aimeCreatedEvent = receipt.events?.find(
        (e: any) => e.event === "AIMeCreated"
      );
      console.log("gas used for create AIME:", receipt.gasUsed);
      const aimeNftContractAddress = aimeCreatedEvent?.args?.aimeAddress;
      console.log("aime address:", aimeNftContractAddress);
      // const newNonce = await aimeFactoryContract.addressNonce(owner.address);
      // expect(newNonce).eq(currentNonce.add(1));

      const contractBalanceAfter = await ethers.provider.getBalance(
        aimeFactoryContract.address
      );
      const balanceDiff = contractBalanceAfter.sub(contractBalanceBefore);
      expect(balanceDiff).eq(ethers.utils.parseEther(protocolFeeEthValue));
    });

    it("can withdraw protocol fee", async () => {
      // first create aime
      const tx = await aimeFactoryContract
        .connect(owner)
        .createAIME(name, avatar, data, image, ethers.constants.AddressZero, {
          value: ethers.utils.parseEther(protocolFeeEthValue),
        });
      await tx.wait();

      // withdraw protocol fee
      const balanceBefore = await ethers.provider.getBalance(owner.address);
      const tx2 = await aimeFactoryContract.connect(owner).withdrawFee();
      const receipt = await tx2.wait();
      // console.log('receipt:', receipt);
      const balanceAfter = await ethers.provider.getBalance(owner.address);
      const balanceDiff = balanceAfter
        .add(receipt.cumulativeGasUsed.mul(receipt.effectiveGasPrice))
        .sub(balanceBefore);
      expect(balanceDiff).eq(ethers.utils.parseEther(protocolFeeEthValue));
      expect(await ethers.provider.getBalance(aimeFactoryContract.address)).eq(
        0
      );
    });

    it("only owner can withdraw protocol fee", async () => {
      // first create aime
      const tx = await aimeFactoryContract
        .connect(owner)
        .createAIME(name, avatar, data, image, ethers.constants.AddressZero, {
          value: ethers.utils.parseEther(protocolFeeEthValue),
        });
      await tx.wait();

      // withdraw protocol fee
      await expect(
        aimeFactoryContract.connect(signer3).withdrawFee()
      ).to.be.revertedWith(`OwnableUnauthorizedAccount("${signer3.address}")`);
    });

    describe("Mint AIME NFT", () => {
      let aimeNftContractAddress: string;
      let name = "aime_name";
      let key = "new_key";
      let type = "editable";
      let data = "new_data_for_new_key";
      let avatar = "new_avatar_url";
      let image = "new_image_url";
      let nft_price = ethers.utils.parseEther("200");

      beforeEach("create a new aime", async () => {
        // const currentNonce = await aimeFactoryContract.connect(owner).addressNonce(owner.address);
        // const tx = await aimeFactoryContract
        //   .connect(owner)
        //   .updateSigner(aimeSigner.address);
        // await tx.wait();
        // const newSigner = await aimeFactoryContract.aimeSigner();
        // expect(newSigner).eq(aimeSigner.address);
        // const sig = await genSig(
        //   aimeSigner,
        //   owner.address,
        //   owner.address,
        //   name,
        //   "basic_prompt",
        //   "static",
        //   data,
        //   avatar,
        //   image,
        //   0,
        //   currentNonce
        // );

        // create aime with aimeSigner
        const txCreate = await aimeFactoryContract
          .connect(owner)
          .createAIME(name, avatar, data, image, aimeSigner.address, {
            value: ethers.utils.parseEther(protocolFeeEthValue),
          });
        // await tx.wait();
        // const tx_create = await aimeFactoryContract.connect(owner).createAIME(name, name, avatar, data, image, sig, creatorRewardAmount, { value: ethers.utils.parseEther("0.001") });
        const receipt = await txCreate.wait();
        const aimeCreatedEvent = receipt.events?.find(
          (e: any) => e.event === "AIMeCreated"
        );
        aimeNftContractAddress = aimeCreatedEvent?.args?.aimeAddress;
      });

      it("can not mint if fee not enough", async () => {
        const currentNonce = await aimeFactoryContract.addressNonce(
          signer3.address
        );
        const sig = await genSig(
          aimeSigner,
          signer3.address,
          aimeNftContractAddress,
          "0",
          key,
          type,
          data,
          image,
          nft_price,
          currentNonce
        );
        await expect(
          aimeFactoryContract.mintAIMeNFT(
            aimeNftContractAddress,
            key,
            type,
            data,
            image,
            nft_price,
            sig
          )
        ).to.be.revertedWith("Insufficient payment");

        await expect(
          aimeFactoryContract.mintAIMeNFT(
            aimeNftContractAddress,
            key,
            type,
            data,
            image,
            nft_price,
            sig,
            { value: ethers.utils.parseEther("0.0001") }
          )
        ).to.be.revertedWith("Insufficient payment");
      });

      it("can mint with fee and sig", async () => {
        const currentNonce = await aimeFactoryContract.addressNonce(
          signer3.address
        );
        const sig = await genSig(
          aimeSigner,
          signer3.address,
          aimeNftContractAddress,
          "0",
          key,
          type,
          data,
          image,
          nft_price,
          currentNonce
        );

        const contractBalanceBefore = await ethers.provider.getBalance(
          aimeFactoryContract.address
        );
        const tx = await aimeFactoryContract
          .connect(signer3)
          .mintAIMeNFT(
            aimeNftContractAddress,
            key,
            type,
            data,
            image,
            nft_price,
            sig,
            { value: ethers.utils.parseEther(protocolFeeEthValue) }
          );
        const receipt = await tx.wait();
        const contractBalanceAfter = await ethers.provider.getBalance(
          aimeFactoryContract.address
        );
        const nonceAfter = await aimeFactoryContract.addressNonce(
          signer3.address
        );
        expect(nonceAfter).eq(currentNonce.add(1));
        expect(contractBalanceAfter.sub(contractBalanceBefore)).eq(
          ethers.utils.parseEther(protocolFeeEthValue)
        );

        const mintEvent = receipt.events?.find(
          (e: any) => e.event === "AIMeNFTMinted"
        );
        // console.log("mintEvent:", mintEvent);
        expect(mintEvent?.args?.creator).eq(signer3.address);
        expect(mintEvent?.args?.aimeAddress).eq(aimeNftContractAddress);

        // cannot reuse the same sig
        await expect(
          aimeFactoryContract
            .connect(signer3)
            .mintAIMeNFT(
              aimeNftContractAddress,
              key,
              type,
              data,
              image,
              nft_price,
              sig,
              { value: ethers.utils.parseEther(protocolFeeEthValue) }
            )
        ).to.be.revertedWith("Invalid signature");
      });

      describe("Update NFT data", () => {
        const newData = "new_data";
        const newImage = "new_image";
        const tokenId = 1;

        beforeEach("mint an nft for signer3", async () => {
          const currentNonce = await aimeFactoryContract.addressNonce(
            signer3.address
          );
          const sig = await genSig(
            aimeSigner,
            signer3.address,
            aimeNftContractAddress,
            "0",
            key,
            type,
            data,
            image,
            nft_price,
            currentNonce
          );

          const tx = await aimeFactoryContract
            .connect(signer3)
            .mintAIMeNFT(
              aimeNftContractAddress,
              key,
              type,
              data,
              image,
              nft_price,
              sig,
              { value: ethers.utils.parseEther(protocolFeeEthValue) }
            );
          await tx.wait();
        });

        it("can not update the nft data without enough fee", async () => {
          const currentNonce = await aimeFactoryContract.addressNonce(
            signer3.address
          );
          const sig = await genSig(
            aimeSigner,
            signer3.address,
            aimeNftContractAddress,
            tokenId,
            "",
            "",
            newData,
            newImage,
            0,
            currentNonce
          );

          await expect(
            aimeFactoryContract
              .connect(signer3)
              .updateAIMeNFT(aimeNftContractAddress, 1, newData, newImage, sig)
          ).to.be.revertedWith("Insufficient payment");
          await expect(
            aimeFactoryContract
              .connect(signer3)
              .updateAIMeNFT(
                aimeNftContractAddress,
                1,
                newData,
                newImage,
                sig,
                { value: ethers.utils.parseEther("0.0001") }
              )
          ).to.be.revertedWith("Insufficient payment");
        });

        it("can update the nft data with fee", async () => {
          const currentNonce = await aimeFactoryContract.addressNonce(
            signer3.address
          );
          const sig = await genSig(
            aimeSigner,
            signer3.address,
            aimeNftContractAddress,
            tokenId,
            "",
            "",
            newData,
            newImage,
            0,
            currentNonce
          );

          const contractBalanceBefore = await ethers.provider.getBalance(
            aimeFactoryContract.address
          );
          const tx = await aimeFactoryContract
            .connect(signer3)
            .updateAIMeNFT(aimeNftContractAddress, 1, newData, newImage, sig, {
              value: ethers.utils.parseEther(protocolFeeEthValue),
            });
          const receipt = await tx.wait();
          const contractBalanceAfter = await ethers.provider.getBalance(
            aimeFactoryContract.address
          );
          const nonceAfter = await aimeFactoryContract.addressNonce(
            signer3.address
          );
          expect(nonceAfter).eq(currentNonce.add(1));
          expect(contractBalanceAfter.sub(contractBalanceBefore)).eq(
            ethers.utils.parseEther(protocolFeeEthValue)
          );

          const updateEvent = receipt.events?.find(
            (e: any) => e.event === "AIMeNFTUpdated"
          );
          expect(updateEvent?.args?.nftOwner).eq(signer3.address);
          expect(updateEvent?.args?.aimeAddress).eq(aimeNftContractAddress);
        });
      });
    });
  });

  describe("AIME with no signer", async () => {
    const name = 'aime_no_signer';
    const type = 'static';
    const key = 'key';
    const avatar = 'avatar';
    const data = 'data';
    const image = 'image';
    const nftPrice = ethers.utils.parseEther("200");
    let aimeNftAddress: string;
    const newData = "new_data";
    const newImage = "new_image";

    beforeEach("Create aime with no signer", async () => {
      const tx = await aimeFactoryContract.createAIME(
        name,
        avatar,
        data,
        image,
        ethers.constants.AddressZero,
        { value: ethers.utils.parseEther(protocolFeeEthValue) }
      );
      await tx.wait();

      aimeNftAddress = await aimeFactoryContract.aimeAddresses(name);
      const aimeSignerAddress = await aimeFactoryContract.aimeSigners(
        aimeNftAddress
      );
      expect(aimeSignerAddress).eq(ethers.constants.AddressZero);
    });

    it("can mint nft without sig", async () => {
      const tx = await aimeFactoryContract
        .connect(signer3)
        .mintAIMeNFT(aimeNftAddress, key, type, data, image, nftPrice, "0x11", {
          value: ethers.utils.parseEther(protocolFeeEthValue),
        });
      const receipt = await tx.wait();
      const mintEvent = receipt.events?.find(
        (e: any) => e.event === "AIMeNFTMinted"
      );
      expect(mintEvent?.args?.creator).eq(signer3.address);
      expect(mintEvent?.args?.aimeAddress).eq(aimeNftAddress);
    });

    it("can update nft without sig", async () => {
      const tx = await aimeFactoryContract
        .connect(signer3)
        .mintAIMeNFT(aimeNftAddress, key, type, data, image, nftPrice, "0x11", {
          value: ethers.utils.parseEther(protocolFeeEthValue),
        });
      const receipt = await tx.wait();
      const mintEvent = receipt.events?.find(
        (e: any) => e.event === "AIMeNFTMinted"
      );
      const tokenId = mintEvent?.args?.tokenId;

      const tx2 = await aimeFactoryContract
        .connect(signer3)
        .updateAIMeNFT(aimeNftAddress, tokenId, newData, newImage, "0x11", {
          value: ethers.utils.parseEther(protocolFeeEthValue),
        });
      const receipt2 = await tx2.wait();
      const updateEvent = receipt2.events?.find(
        (e: any) => e.event === "AIMeNFTUpdated"
      );
      expect(updateEvent?.args?.nftOwner).eq(signer3.address);
      expect(updateEvent?.args?.data).eq(newData);
    });
  });
});
