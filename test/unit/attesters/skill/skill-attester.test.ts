import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import {
  AttestationsRegistry,
  MockSkillBadge,
  SkillAttester,
  TransparentUpgradeableProxy__factory,
} from '../../../../types';
import { RequestStruct } from 'types/Attester';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { Deployed0 } from 'tasks/deploy-tasks/full/0-deploy-core-and-hydra-s1-simple-and-soulbound.task';
import { deploymentsConfig } from '../../../../tasks/deploy-tasks/deployments-config';
import {
  encodeSkillGroupProperties,
  generateSkillAccounts,
  generateSkillAttesterGroups,
  generateSkillLists,
  SkillAccountData,
  SkillGroup,
} from '../../../utils';
import { getEventArgs } from '../../../utils/expectEvent';
import {
  DeployedMockSkillBadge,
  DeployMockSkillBadgeArgs,
} from 'tasks/deploy-tasks/tests/deploy-mock-skill-badge.task';
import { getImplementation } from '../../../../utils';
import { getCommonOptions } from '../../../../tasks/utils/common-options';

const config = deploymentsConfig[hre.network.name];
const collectionIdFirst = BigNumber.from(config.skillAttester.collectionIdFirst);
const collectionIdLast = BigNumber.from(config.skillAttester.collectionIdLast);

describe('Test Skill attester contract', () => {
  // contracts
  let skillAttester: SkillAttester;
  let mockSkillBadge: MockSkillBadge;
  let attestationsRegistry: AttestationsRegistry;

  // Test Signers
  let deployer: SignerWithAddress;
  let secondDeployer: SignerWithAddress;
  let randomSigner: SignerWithAddress;
  let proxyAdminSigner: SignerWithAddress;
  let attesterOracle: SignerWithAddress;
  let mockAttestationsRegistry: SignerWithAddress;
  let notAdmin: SignerWithAddress;

  // Test accounts
  let source1: SkillAccountData;
  let destination1: SkillAccountData;
  let destination2: SkillAccountData;

  // Data source test
  let source1Value: number;
  let group1: SkillGroup;
  let group2: SkillGroup;

  // Valid request and proof
  let request: RequestStruct;

  before(async () => {
    const signers = await hre.ethers.getSigners();
    [
      deployer,
      randomSigner,
      proxyAdminSigner,
      attesterOracle,
      mockAttestationsRegistry,
      notAdmin,
      secondDeployer,
    ] = signers;

    let accounts: SkillAccountData[] = await generateSkillAccounts(signers);

    source1 = accounts[0];
    destination1 = accounts[1];
    destination2 = accounts[3];

    // Generate data source
    const allList = await generateSkillLists(accounts);
    const { groups } = await generateSkillAttesterGroups(allList);

    group1 = groups[0];
    group2 = groups[1];
    source1Value = group1.data[source1.account];
  });

  /*************************************************************************************/
  /********************************** DEPLOYMENTS **************************************/
  /*************************************************************************************/

  describe('Deployments', () => {
    it('Should deploy and setup core', async () => {
      ({ mockSkillBadge } = (await hre.run('deploy-mock-skill-badge', {
        attestationsRegistryAddress: mockAttestationsRegistry.address,
        uri: 'https://dummyUri.com/',
        skillPoints: BigNumber.from('30').toString(),
        options: {
          behindProxy: false,
        },
      } as DeployMockSkillBadgeArgs)) as DeployedMockSkillBadge);

      ({ attestationsRegistry } = (await hre.run(
        '0-deploy-core-and-hydra-s1-simple-and-soulbound',
        {
          options: { log: false },
        }
      )) as Deployed0);
      ({ skillAttester } = await hre.run('deploy-skill-attester', {
        collectionIdFirst: config.skillAttester.collectionIdFirst,
        collectionIdLast: config.skillAttester.collectionIdLast,
        attestationsRegistryAddress: attestationsRegistry.address,
        skillBadgeAddress: mockSkillBadge.address,
      }));
      await hre.run('attestations-registry-authorize-range', {
        attestationsRegistryAddress: attestationsRegistry.address,
        attesterAddress: skillAttester.address,
        collectionIdFirst: config.skillAttester.collectionIdFirst,
        collectionIdLast: config.skillAttester.collectionIdLast,
        options: getCommonOptions({ log: false }),
      });
    });
  });

  /*************************************************************************************/
  /***************************** GENERATE VALID ATTESTATION ****************************/
  /*************************************************************************************/

  describe('Generate valid attestation', () => {
    it('Should generate attestation', async () => {
      request = {
        claims: [
          {
            groupId: group1.id,
            claimedValue: await mockSkillBadge.balanceOf(source1.account, 0),
            extraData: encodeSkillGroupProperties(group1.properties),
          },
        ],
        destination: destination1.account,
      };

      const tx = await skillAttester.generateAttestations(request, '0x');
      const { events } = await tx.wait();
      const args = getEventArgs(events, 'AttestationGenerated');

      expect(args.attestation.issuer).to.equal(skillAttester.address);
      expect(args.attestation.owner).to.equal(BigNumber.from(destination1.account).toHexString());
      expect(args.attestation.collectionId).to.equal(collectionIdFirst.add(0));
      expect(args.attestation.value).to.equal(30);
      expect(args.attestation.extraData).to.equal(request.claims[0].extraData);
    });

    it('Should update existing attestation', async () => {
      request = {
        claims: [
          {
            groupId: group1.id,
            claimedValue: await mockSkillBadge.balanceOf(source1.account, 0),
            extraData: encodeSkillGroupProperties(group1.properties),
          },
        ],
        destination: destination1.account,
      };

      const tx = await skillAttester.generateAttestations(request, '0x');
      const { events } = await tx.wait();
      const args = getEventArgs(events, 'AttestationGenerated');

      expect(args.attestation.issuer).to.equal(skillAttester.address);
      expect(args.attestation.owner).to.equal(BigNumber.from(destination1.account).toHexString());
      expect(args.attestation.collectionId).to.equal(collectionIdFirst.add(0));
      expect(args.attestation.value).to.equal(30);
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

    it('Should revert due to requesting more than eligible claim value', async () => {
      const claimValue = await mockSkillBadge.balanceOf(source1.account, 0);
      const invalidClaimValue = (await mockSkillBadge.balanceOf(source1.account, 0)).add(10);
      request = {
        claims: [
          {
            groupId: group1.id,
            claimedValue: invalidClaimValue,
            extraData: encodeSkillGroupProperties(group1.properties),
          },
        ],
        destination: destination1.account,
      };

      await expect(skillAttester.generateAttestations(request, '0x'))
        .to.be.revertedWithCustomError(skillAttester, 'ClaimValueInvalid')
        .withArgs(claimValue, invalidClaimValue);
    });
    it('Should revert due to groupId out of authorized range', async () => {
      request = {
        claims: [
          {
            groupId: collectionIdLast.sub(collectionIdFirst).add(1),
            claimedValue: await mockSkillBadge.balanceOf(source1.account, 0),
            extraData: encodeSkillGroupProperties(group1.properties),
          },
        ],
        destination: destination1.account,
      };

      await expect(skillAttester.generateAttestations(request, '0x'))
        .revertedWithCustomError(skillAttester, 'CollectionIdOutOfBound')
        .withArgs(collectionIdLast.add(1));
    });

    /****************************************/
    /************** _verifyProof() **********/
    /****************************************/

    it('Should revert due to signature expiration', async () => {});
  });

  /*************************************************************************************/
  /************************** BEFORE RECORD ATTESTATION ********************************/
  /*************************************************************************************/

  describe('Before record attestation', () => {
    it('Should revert due to source having already been used', async () => {
      const claimValue = await mockSkillBadge.balanceOf(source1.account, 0);

      request = {
        claims: [
          {
            groupId: group1.id,
            claimedValue: claimValue,
            extraData: encodeSkillGroupProperties(group1.properties),
          },
        ],
        destination: destination2.account,
      };

      await expect(skillAttester.generateAttestations(request, '0x'))
        .to.be.revertedWithCustomError(skillAttester, `SourceAlreadyUsed`)
        .withArgs(deployer.address);
    });
  });

  /*************************************************************************************/
  /***************************** Delete ATTESTATION ****************************/
  /*************************************************************************************/

  describe('Delete attestation', () => {
    it('Should revert delete attestation', async () => {
      await expect(
        skillAttester.deleteAttestations(
          [collectionIdFirst.add(0), collectionIdFirst.add(1)],
          destination1.account,
          '0x'
        )
      )
        .to.be.revertedWithCustomError(skillAttester, 'NotAttestationOwner')
        .withArgs(collectionIdFirst.add(0), deployer.address);
    });
    it('Should delete attestation', async () => {
      const tx = await skillAttester
        .connect(await ethers.getSigner(destination1.account))
        .deleteAttestations(
          [collectionIdFirst.add(0), collectionIdFirst.add(1)],
          destination1.account,
          '0x'
        );
      const { events } = await tx.wait();
      const args = getEventArgs(events, 'AttestationDeleted', 6);
      const args2 = getEventArgs(events, 'AttestationDeleted', 7);

      expect(args.attestation.issuer).to.equal(skillAttester.address);
      expect(args.attestation.owner).to.equal(BigNumber.from(destination1.account).toHexString());
      expect(args.attestation.collectionId).to.equal(collectionIdFirst.add(0));
      expect(args.attestation.value).to.equal(30);

      // Empty burn, no attestation was present to begin with
      expect(args2.attestation.issuer).to.equal(ethers.constants.AddressZero);
      expect(args2.attestation.owner).to.equal(BigNumber.from(destination1.account).toHexString());
      expect(args2.attestation.collectionId).to.equal(collectionIdFirst.add(1));
      expect(args2.attestation.value).to.equal(0);
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

      const { skillAttester: newSkillAttester } = await hre.run('deploy-skill-attester', {
        collectionIdFirst: config.skillAttester.collectionIdFirst,
        collectionIdLast: config.skillAttester.collectionIdLast,
        attestationsRegistryAddress: attestationsRegistry.address,
        skillBadgeAddress: mockSkillBadge.address,
        options: { behindProxy: false },
      });

      const skillAttesterProxy = TransparentUpgradeableProxy__factory.connect(
        skillAttester.address,
        proxyAdminSigner
      );

      await (await skillAttesterProxy.upgradeTo(newSkillAttester.address)).wait();

      const implementationAddress = await getImplementation(skillAttesterProxy);
      expect(implementationAddress).to.eql(newSkillAttester.address);
    });
  });
});
