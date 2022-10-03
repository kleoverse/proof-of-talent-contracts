import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { recoverTypedSignature, SignTypedDataVersion } from '@metamask/eth-sig-util';
import {
  AttestationsRegistry,
  Badges,
  SignatureAttester,
  TransparentUpgradeableProxy__factory,
} from '../../../../types';
import { RequestStruct } from 'types/Attester';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, utils } from 'ethers';
import { Deployed0 } from 'tasks/deploy-tasks/full/0-deploy-core-and-hydra-s1-simple-and-soulbound.task';
import { deploymentsConfig } from '../../../../tasks/deploy-tasks/deployments-config';
import {
  encodeSignatureGroupProperties,
  generateEIP712TypedSignData,
  generateEIP712TypedSignDataWithDomainType,
  generateSignatureAccounts,
  generateSignatureAttesterGroups,
  generateSignatureLists,
  SignatureAccountData,
  SignatureAttesterDomainName,
  SignatureGroup,
} from '../../../utils';
import { getEventArgs } from '../../../utils/expectEvent';
import { getAddress } from 'ethers/lib/utils';
import { getImplementation } from '../../../../utils';

const config = deploymentsConfig[hre.network.name];
const collectionIdFirst = BigNumber.from(config.signatureAttester.collectionIdFirst);
const collectionIdLast = BigNumber.from(config.signatureAttester.collectionIdLast);

describe('Test Signature attester contract', () => {
  let chainId: number;

  // contracts
  let attestationsRegistry: AttestationsRegistry;
  let signatureAttester: SignatureAttester;
  let badges: Badges;

  // Test Signers
  let deployer: SignerWithAddress;
  let randomSigner: SignerWithAddress;
  let proxyAdminSigner: SignerWithAddress;
  let attesterOracle: SignerWithAddress;

  // Test accounts
  let source1: SignatureAccountData;
  let destination1: SignatureAccountData;
  let destination2: SignatureAccountData;

  // Data source test
  let source1Value: number;
  let group1: SignatureGroup;
  let group2: SignatureGroup;

  // Valid request and proof
  let request: RequestStruct;

  before(async () => {
    const signers = await hre.ethers.getSigners();
    [deployer, randomSigner, proxyAdminSigner, attesterOracle] = signers;

    let accounts: SignatureAccountData[] = await generateSignatureAccounts(signers);

    source1 = accounts[0];
    destination1 = accounts[1];
    destination2 = accounts[3];

    // Generate data source
    const allList = await generateSignatureLists(accounts);
    const { groups } = await generateSignatureAttesterGroups(allList);

    group1 = groups[0];
    group2 = groups[1];
    source1Value = group1.data[source1.identifier];
  });

  /*************************************************************************************/
  /********************************** DEPLOYMENTS **************************************/
  /*************************************************************************************/

  describe('Deployments', () => {
    it('Should deploy and setup core', async () => {
      ({ attestationsRegistry, badges, signatureAttester } = (await hre.run(
        '0-deploy-core-and-hydra-s1-simple-and-soulbound',
        {
          options: { log: false },
        }
      )) as Deployed0);
    });
  });

  /*************************************************************************************/
  /***************************** GENERATE VALID ATTESTATION ****************************/
  /*************************************************************************************/

  describe('Generate valid attestation', () => {
    it('Should generate attestation', async () => {
      const deadline = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      request = {
        claims: [
          {
            groupId: group1.id,
            claimedValue: source1Value,
            extraData: encodeSignatureGroupProperties(group1.properties),
          },
        ],
        destination: source1.account,
      };

      const signData = generateEIP712TypedSignData(
        request,
        signatureAttester.address,
        deadline,
        SignatureAttesterDomainName
      );
      const sig = await deployer._signTypedData(signData.domain, signData.types, signData.message);
      const { r, s, v } = utils.splitSignature(sig);
      const data = ethers.utils.defaultAbiCoder.encode(
        ['uint8', 'bytes32', 'bytes32', 'uint256'],
        [v, r, s, deadline]
      );
      const tx = await signatureAttester.generateAttestations(request, data);
      const { events } = await tx.wait();
      const args = getEventArgs(events, 'AttestationGenerated');

      console.log(tx);
      console.log('deployer: ', deployer.address);
      console.log('dest: ', source1.account);
      expect(args.attestation.issuer).to.equal(signatureAttester.address);
      expect(args.attestation.owner).to.equal(BigNumber.from(source1.account).toHexString());
      expect(args.attestation.collectionId).to.equal(collectionIdFirst.add(0));
      expect(args.attestation.value).to.equal(1);
    });

    it('Should update existing attestation', async () => {
      const deadline = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      request = {
        claims: [
          {
            groupId: group1.id,
            // UPATED value here
            claimedValue: source1Value + 1,
            extraData: encodeSignatureGroupProperties(group1.properties),
          },
        ],
        destination: source1.account,
      };
      const signData = generateEIP712TypedSignData(
        request,
        signatureAttester.address,
        deadline,
        SignatureAttesterDomainName
      );
      const sig = await deployer._signTypedData(signData.domain, signData.types, signData.message);
      const { r, s, v } = utils.splitSignature(sig);
      const data = ethers.utils.defaultAbiCoder.encode(
        ['uint8', 'bytes32', 'bytes32', 'uint256'],
        [v, r, s, deadline]
      );
      const tx = await signatureAttester.generateAttestations(request, data);
      const { events } = await tx.wait();
      const args = getEventArgs(events, 'AttestationGenerated');

      expect(args.attestation.issuer).to.equal(signatureAttester.address);
      expect(args.attestation.owner).to.equal(BigNumber.from(source1.account).toHexString());
      expect(args.attestation.collectionId).to.equal(collectionIdFirst.add(0));
      expect(args.attestation.value).to.equal(2);
    });

    it('Should generate attestation from same source-destination pair for another collectionId', async () => {
      const deadline = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      request = {
        claims: [
          {
            groupId: group2.id,
            claimedValue: source1Value,
            extraData: encodeSignatureGroupProperties(group2.properties),
          },
        ],
        destination: source1.account,
      };

      const signData = generateEIP712TypedSignData(
        request,
        signatureAttester.address,
        deadline,
        SignatureAttesterDomainName
      );
      const sig = await deployer._signTypedData(signData.domain, signData.types, signData.message);
      const { r, s, v } = utils.splitSignature(sig);
      const data = ethers.utils.defaultAbiCoder.encode(
        ['uint8', 'bytes32', 'bytes32', 'uint256'],
        [v, r, s, deadline]
      );
      const tx = await signatureAttester.generateAttestations(request, data);
      const { events } = await tx.wait();
      const args = getEventArgs(events, 'AttestationGenerated');

      expect(args.attestation.issuer).to.equal(signatureAttester.address);
      expect(args.attestation.owner).to.equal(BigNumber.from(source1.account).toHexString());
      expect(args.attestation.collectionId).to.equal(collectionIdFirst.add(1));
      expect(args.attestation.value).to.equal(1);
    });
  });

  /*************************************************************************************/
  /********************************* VERIFY REQUEST ************************************/
  /*************************************************************************************/

  describe('Verify request', () => {
    /****************************************/
    /************* _validateInput() *********/
    /****************************************/

    it('Should revert due to mismatch in signature and claim request', async () => {
      const deadline = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      request = {
        claims: [
          {
            groupId: group1.id,
            claimedValue: source1Value,
            extraData: encodeSignatureGroupProperties(group1.properties),
          },
        ],
        destination: source1.account,
      };
      const forgedRequest = {
        claims: [
          {
            groupId: group1.id,
            claimedValue: source1Value + 1,
            extraData: encodeSignatureGroupProperties(group1.properties),
          },
        ],
        destination: source1.account,
      };

      const signData = generateEIP712TypedSignData(
        request,
        signatureAttester.address,
        deadline,
        SignatureAttesterDomainName
      );
      const signDataWithType = generateEIP712TypedSignDataWithDomainType(signData);
      const sig = await deployer._signTypedData(signData.domain, signData.types, signData.message);
      const recovered = recoverTypedSignature({
        // @ts-ignore
        data: {
          ...signDataWithType,
          message: {
            ...signDataWithType.message,
            claimedValue: forgedRequest.claims[0].claimedValue,
          },
        },
        signature: sig,
        version: SignTypedDataVersion.V4,
      });
      const { r, s, v } = utils.splitSignature(sig);
      const data = ethers.utils.defaultAbiCoder.encode(
        ['uint8', 'bytes32', 'bytes32', 'uint256'],
        [v, r, s, deadline]
      );
      await expect(signatureAttester.generateAttestations(forgedRequest, data))
        .to.be.revertedWithCustomError(signatureAttester, `SignatureInvalid`)
        .withArgs(deployer.address, getAddress(recovered));
    });
    it('Should revert due to groupId out of authorized range', async () => {
      const deadline = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      request = {
        claims: [
          {
            groupId: collectionIdLast.sub(collectionIdFirst).add(1),
            claimedValue: source1Value,
            extraData: encodeSignatureGroupProperties(group1.properties),
          },
        ],
        destination: source1.account,
      };

      const signData = generateEIP712TypedSignData(
        request,
        signatureAttester.address,
        deadline,
        SignatureAttesterDomainName
      );
      const sig = await deployer._signTypedData(signData.domain, signData.types, signData.message);
      const { r, s, v } = utils.splitSignature(sig);
      const data = ethers.utils.defaultAbiCoder.encode(
        ['uint8', 'bytes32', 'bytes32', 'uint256'],
        [v, r, s, deadline]
      );

      await expect(signatureAttester.generateAttestations(request, data))
        .revertedWithCustomError(signatureAttester, 'CollectionIdOutOfBound')
        .withArgs(collectionIdLast.add(1));
    });

    /****************************************/
    /************** _verifyProof() **********/
    /****************************************/

    it('Should revert due to signature expiration', async () => {
      let yesterday = new Date();

      yesterday.setDate(yesterday.getDate() - 1);
      const deadline = Math.floor(yesterday.getTime() / 1000);
      request = {
        claims: [
          {
            groupId: group1.id,
            claimedValue: source1Value,
            extraData: encodeSignatureGroupProperties(group1.properties),
          },
        ],
        destination: source1.account,
      };
      const signData = generateEIP712TypedSignData(
        request,
        signatureAttester.address,
        deadline,
        SignatureAttesterDomainName
      );
      const sig = await deployer._signTypedData(signData.domain, signData.types, signData.message);
      const { r, s, v } = utils.splitSignature(sig);
      const data = ethers.utils.defaultAbiCoder.encode(
        ['uint8', 'bytes32', 'bytes32', 'uint256'],
        [v, r, s, deadline]
      );
      await expect(signatureAttester.generateAttestations(request, data))
        .to.be.revertedWithCustomError(signatureAttester, 'SignatureDeadlineExpired')
        .withArgs(deadline);
    });

    it('Should revert due to incorrect verifying contract', async () => {
      const deadline = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      request = {
        claims: [
          {
            groupId: group1.id,
            claimedValue: source1Value,
            extraData: encodeSignatureGroupProperties(group1.properties),
          },
        ],
        destination: source1.account,
      };
      const signData = generateEIP712TypedSignData(
        request,
        randomSigner.address,
        deadline,
        SignatureAttesterDomainName
      );
      const signDataWithType = generateEIP712TypedSignDataWithDomainType(signData);
      const sig = await deployer._signTypedData(signData.domain, signData.types, signData.message);
      const recovered = recoverTypedSignature({
        // @ts-ignore
        data: {
          ...signDataWithType,
          domain: {
            ...signDataWithType.domain,
            verifyingContract: signatureAttester.address,
          },
        },
        signature: sig,
        version: SignTypedDataVersion.V4,
      });
      const { r, s, v } = utils.splitSignature(sig);
      const data = ethers.utils.defaultAbiCoder.encode(
        ['uint8', 'bytes32', 'bytes32', 'uint256'],
        [v, r, s, deadline]
      );
      await expect(signatureAttester.generateAttestations(request, data))
        .to.be.revertedWithCustomError(signatureAttester, `SignatureInvalid`)
        .withArgs(deployer.address, getAddress(recovered));
    });

    it('Should revert due to incorrect signature signer', async () => {
      const deadline = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      request = {
        claims: [
          {
            groupId: group1.id,
            claimedValue: source1Value,
            extraData: encodeSignatureGroupProperties(group1.properties),
          },
        ],
        destination: source1.account,
      };

      const signData = generateEIP712TypedSignData(
        request,
        signatureAttester.address,
        deadline,
        SignatureAttesterDomainName
      );
      const sig = await randomSigner._signTypedData(
        signData.domain,
        signData.types,
        signData.message
      );
      const { r, s, v } = utils.splitSignature(sig);
      const data = ethers.utils.defaultAbiCoder.encode(
        ['uint8', 'bytes32', 'bytes32', 'uint256'],
        [v, r, s, deadline]
      );
      await expect(signatureAttester.generateAttestations(request, data))
        .to.be.revertedWithCustomError(signatureAttester, `SignatureInvalid`)
        .withArgs(deployer.address, randomSigner.address);
    });
  });

  /*************************************************************************************/
  /************************** BEFORE RECORD ATTESTATION ********************************/
  /*************************************************************************************/

  describe('Before record attestation', () => {
    it('Should revert due to source having already been used', async () => {
      const deadline = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      const wrongRequest = { ...request };
      wrongRequest.destination = destination2.account;
      const signData = generateEIP712TypedSignData(
        wrongRequest,
        signatureAttester.address,
        deadline,
        SignatureAttesterDomainName
      );
      const sig = await deployer._signTypedData(signData.domain, signData.types, signData.message);
      const { r, s, v } = utils.splitSignature(sig);
      const data = ethers.utils.defaultAbiCoder.encode(
        ['uint8', 'bytes32', 'bytes32', 'uint256'],
        [v, r, s, deadline]
      );

      await expect(signatureAttester.generateAttestations(wrongRequest, data))
        .to.be.revertedWithCustomError(signatureAttester, `SourceAlreadyUsed`)
        .withArgs(deployer.address);
    });
  });

  /*************************************************************************************/
  /***************************** Delete ATTESTATION ****************************/
  /*************************************************************************************/

  describe('Delete attestation', () => {
    it('Should revert delete attestation', async () => {
      await expect(
        signatureAttester
          .connect(randomSigner)
          .deleteAttestations(
            [collectionIdFirst.add(0), collectionIdFirst.add(1)],
            source1.account,
            '0x'
          )
      )
        .to.be.revertedWithCustomError(signatureAttester, 'NotAttestationOwner')
        .withArgs(collectionIdFirst.add(0), randomSigner.address);
    });
    it('Should delete attestation', async () => {
      const tx = await signatureAttester.deleteAttestations(
        [collectionIdFirst.add(0), collectionIdFirst.add(1)],
        source1.account,
        '0x'
      );
      const { events } = await tx.wait();
      const args = getEventArgs(events, 'AttestationDeleted', 6);
      const args2 = getEventArgs(events, 'AttestationDeleted', 7);

      expect(args.attestation.issuer).to.equal(signatureAttester.address);
      expect(args.attestation.owner).to.equal(BigNumber.from(source1.account).toHexString());
      expect(args.attestation.collectionId).to.equal(collectionIdFirst.add(0));
      expect(args.attestation.value).to.equal(2);

      expect(args2.attestation.issuer).to.equal(signatureAttester.address);
      expect(args2.attestation.owner).to.equal(BigNumber.from(source1.account).toHexString());
      expect(args2.attestation.collectionId).to.equal(collectionIdFirst.add(1));
      expect(args2.attestation.value).to.equal(1);
    });
  });

  /*************************************************************************************/
  /******************************* UPDATE IMPLEMENTATION *******************************/
  /*************************************************************************************/
  describe('Update implementation', () => {
    it('Should update the implementation', async () => {
      const proxyAdminSigner = await ethers.getSigner(
        deploymentsConfig[hre.network.name].deployOptions.proxyAdmin as string
      );

      const { signatureAttester: newSignatureAttester } = await hre.run(
        'deploy-signature-attester',
        {
          collectionIdFirst: config.signatureAttester.collectionIdFirst,
          collectionIdLast: config.signatureAttester.collectionIdLast,
          attestationsRegistryAddress: attestationsRegistry.address,
          verifierAddress: config.signatureAttester.verifierAddress,
          options: { behindProxy: false },
        }
      );

      const signatureAttesterProxy = TransparentUpgradeableProxy__factory.connect(
        signatureAttester.address,
        proxyAdminSigner
      );

      await (await signatureAttesterProxy.upgradeTo(newSignatureAttester.address)).wait();

      const implementationAddress = await getImplementation(signatureAttesterProxy);
      expect(implementationAddress).to.eql(newSignatureAttester.address);
    });
  });
});
