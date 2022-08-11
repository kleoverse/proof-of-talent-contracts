import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { recoverTypedSignature, SignTypedDataVersion } from '@metamask/eth-sig-util';
import { AttestationsRegistry, Badges, IdentityAttester } from 'types';
import { RequestStruct } from 'types/Attester';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, utils } from 'ethers';
import { Deployed0 } from 'tasks/deploy-tasks/full/0-deploy-core-and-hydra-s1-simple-and-soulbound.task';
import { deploymentsConfig } from '../../../../tasks/deploy-tasks/deployments-config';
import {
  encodeIdentityGroupProperties,
  generateEIP712TypedSignData,
  generateEIP712TypedSignDataWithDomainType,
  generateIdentityAccounts,
  generateIdentityAttesterGroups,
  generateIdentityLists,
  IdentityAccountData,
  IdentityGroup,
  IdentityAttesterDomainName,
} from '../../../utils';
import { getEventArgs } from '../../../utils/expectEvent';
import { getAddress } from 'ethers/lib/utils';

const config = deploymentsConfig[hre.network.name];
const collectionIdFirst = BigNumber.from(config.identityAttester.collectionIdFirst);
const collectionIdLast = BigNumber.from(config.identityAttester.collectionIdLast);

describe('Test Identity attester contract', () => {
  let chainId: number;

  // contracts
  let attestationsRegistry: AttestationsRegistry;
  let identityAttester: IdentityAttester;
  let badges: Badges;

  // Test Signers
  let deployer: SignerWithAddress;
  let randomSigner: SignerWithAddress;
  let proxyAdminSigner: SignerWithAddress;
  let attesterOracle: SignerWithAddress;

  // Test accounts
  let source1: IdentityAccountData;
  let destination1: IdentityAccountData;
  let destination2: IdentityAccountData;

  // Data source test
  let source1Value: number;
  let group1: IdentityGroup;
  let group2: IdentityGroup;

  // Valid request and proof
  let request: RequestStruct;

  before(async () => {
    const signers = await hre.ethers.getSigners();
    [deployer, randomSigner, proxyAdminSigner, attesterOracle] = signers;

    let accounts: IdentityAccountData[] = await generateIdentityAccounts(signers);

    source1 = accounts[0];
    destination1 = accounts[1];
    destination2 = accounts[3];

    // Generate data source
    const allList = await generateIdentityLists(accounts);
    const { groups } = await generateIdentityAttesterGroups(allList);

    group1 = groups[0];
    group2 = groups[1];
    source1Value = group1.data[source1.identifier];
  });

  /*************************************************************************************/
  /********************************** DEPLOYMENTS **************************************/
  /*************************************************************************************/

  describe('Deployments', () => {
    it('Should deploy and setup core', async () => {
      ({ attestationsRegistry, badges, identityAttester } = (await hre.run(
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
            extraData: encodeIdentityGroupProperties(
              group1.properties,
              source1.account,
              source1.username
            ),
          },
        ],
        destination: destination1.account,
      };

      const signData = generateEIP712TypedSignData(
        request,
        identityAttester.address,
        deadline,
        IdentityAttesterDomainName
      );
      const sig = await deployer._signTypedData(signData.domain, signData.types, signData.message);
      const { r, s, v } = utils.splitSignature(sig);
      const data = ethers.utils.defaultAbiCoder.encode(
        ['uint8', 'bytes32', 'bytes32', 'uint256'],
        [v, r, s, deadline]
      );
      const tx = await identityAttester.generateAttestations(request, data);
      const { events } = await tx.wait();
      const args = getEventArgs(events, 'AttestationGenerated');

      expect(args.attestation.issuer).to.equal(identityAttester.address);
      expect(args.attestation.owner).to.equal(BigNumber.from(destination1.account).toHexString());
      expect(args.attestation.collectionId).to.equal(collectionIdFirst.add(0));
      expect(args.attestation.value).to.equal(1);
      expect(args.attestation.timestamp).to.equal(group1.properties.generationTimestamp);
      expect(args.attestation.extraData).to.equal(request.claims[0].extraData);
    });
    it('Should update existing attestation', async () => {
      const deadline = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      request = {
        claims: [
          {
            groupId: group1.id,
            // UPATED value here
            claimedValue: source1Value + 1,
            extraData: encodeIdentityGroupProperties(
              group1.properties,
              source1.account,
              source1.username
            ),
          },
        ],
        destination: destination1.account,
      };
      const signData = generateEIP712TypedSignData(
        request,
        identityAttester.address,
        deadline,
        IdentityAttesterDomainName
      );
      const sig = await deployer._signTypedData(signData.domain, signData.types, signData.message);
      const { r, s, v } = utils.splitSignature(sig);
      const data = ethers.utils.defaultAbiCoder.encode(
        ['uint8', 'bytes32', 'bytes32', 'uint256'],
        [v, r, s, deadline]
      );
      const tx = await identityAttester.generateAttestations(request, data);
      const { events } = await tx.wait();
      const args = getEventArgs(events, 'AttestationGenerated');

      expect(args.attestation.issuer).to.equal(identityAttester.address);
      expect(args.attestation.owner).to.equal(BigNumber.from(destination1.account).toHexString());
      expect(args.attestation.collectionId).to.equal(collectionIdFirst.add(0));
      expect(args.attestation.value).to.equal(2);
      expect(args.attestation.timestamp).to.equal(group1.properties.generationTimestamp);
      expect(args.attestation.extraData).to.equal(request.claims[0].extraData);
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
            extraData: encodeIdentityGroupProperties(
              group1.properties,
              source1.account,
              source1.username
            ),
          },
        ],
        destination: destination1.account,
      };
      const forgedRequest = {
        claims: [
          {
            groupId: group1.id,
            claimedValue: source1Value + 1,
            extraData: encodeIdentityGroupProperties(
              group1.properties,
              source1.account,
              source1.username
            ),
          },
        ],
        destination: destination1.account,
      };

      const signData = generateEIP712TypedSignData(
        request,
        identityAttester.address,
        deadline,
        IdentityAttesterDomainName
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
      await expect(identityAttester.generateAttestations(forgedRequest, data))
        .to.be.revertedWithCustomError(identityAttester, `SignatureInvalid`)
        .withArgs(deployer.address, getAddress(recovered));
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
            extraData: encodeIdentityGroupProperties(
              group1.properties,
              source1.account,
              source1.username
            ),
          },
        ],
        destination: destination1.account,
      };
      const signData = generateEIP712TypedSignData(
        request,
        identityAttester.address,
        deadline,
        IdentityAttesterDomainName
      );
      const sig = await deployer._signTypedData(signData.domain, signData.types, signData.message);
      const { r, s, v } = utils.splitSignature(sig);
      const data = ethers.utils.defaultAbiCoder.encode(
        ['uint8', 'bytes32', 'bytes32', 'uint256'],
        [v, r, s, deadline]
      );
      await expect(identityAttester.generateAttestations(request, data))
        .to.be.revertedWithCustomError(identityAttester, 'SignatureDeadlineExpired')
        .withArgs(deadline);
    });

    it('Should revert due to incorrect verifying contract', async () => {
      const deadline = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      request = {
        claims: [
          {
            groupId: group1.id,
            claimedValue: source1Value,
            extraData: encodeIdentityGroupProperties(
              group1.properties,
              source1.account,
              source1.username
            ),
          },
        ],
        destination: destination1.account,
      };
      const signData = generateEIP712TypedSignData(
        request,
        randomSigner.address,
        deadline,
        IdentityAttesterDomainName
      );
      const signDataWithType = generateEIP712TypedSignDataWithDomainType(signData);
      const sig = await deployer._signTypedData(signData.domain, signData.types, signData.message);
      const recovered = recoverTypedSignature({
        // @ts-ignore
        data: {
          ...signDataWithType,
          domain: {
            ...signDataWithType.domain,
            verifyingContract: identityAttester.address,
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
      await expect(identityAttester.generateAttestations(request, data))
        .to.be.revertedWithCustomError(identityAttester, `SignatureInvalid`)
        .withArgs(deployer.address, getAddress(recovered));
    });

    it('Should revert due to incorrect signature signer', async () => {
      const deadline = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      request = {
        claims: [
          {
            groupId: group1.id,
            claimedValue: source1Value,
            extraData: encodeIdentityGroupProperties(
              group1.properties,
              source1.account,
              source1.username
            ),
          },
        ],
        destination: destination1.account,
      };

      const signData = generateEIP712TypedSignData(
        request,
        identityAttester.address,
        deadline,
        IdentityAttesterDomainName
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
      await expect(identityAttester.generateAttestations(request, data))
        .to.be.revertedWithCustomError(identityAttester, `SignatureInvalid`)
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
        identityAttester.address,
        deadline,
        IdentityAttesterDomainName
      );
      const sig = await deployer._signTypedData(signData.domain, signData.types, signData.message);
      const { r, s, v } = utils.splitSignature(sig);
      const data = ethers.utils.defaultAbiCoder.encode(
        ['uint8', 'bytes32', 'bytes32', 'uint256'],
        [v, r, s, deadline]
      );

      await expect(identityAttester.generateAttestations(wrongRequest, data))
        .to.be.revertedWithCustomError(identityAttester, `SourceAlreadyUsed`)
        .withArgs(deployer.address);
    });
  });
});
