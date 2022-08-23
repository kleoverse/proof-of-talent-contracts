import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import hre, { ethers } from 'hardhat';
import { expect } from 'chai';
import { MockAttestationsRegistry, SkillBadge } from 'types';
import {
  DeployedSkillBadge,
  DeploySkillBadgeArgs,
} from 'tasks/deploy-tasks/unit/periphery/badges/deploy-skill-badge.task';

describe('Test Skill Badge contract', () => {
  let deployer: SignerWithAddress;
  let secondDeployer: SignerWithAddress;
  let admin: SignerWithAddress;
  let notAdmin: SignerWithAddress;
  let user: SignerWithAddress;
  let dummyContract: SignerWithAddress;

  let skillBadge: SkillBadge;
  let mockAttestationsRegistry: MockAttestationsRegistry;

  before(async () => {
    [deployer, secondDeployer, admin, notAdmin, user, dummyContract] = await ethers.getSigners();
  });

  /*************************************************************************************/
  /********************************** DEPLOYMENTS **************************************/
  /*************************************************************************************/
  describe('Deployments', () => {
    it('Should deploy, setup and test the constructed values of the contract', async () => {
      ({ mockAttestationsRegistry } = await hre.run('deploy-mock-attestations-registry', {
        badges: dummyContract.address,
        attestationValue: 2,
        options: {
          behindProxy: false,
        },
      }));

      ({ skillBadge } = (await hre.run('deploy-skill-badge', {
        attestationsRegistryAddress: mockAttestationsRegistry.address,
        uri: 'https://dummyUri.com/',
        options: {
          behindProxy: false,
        },
      } as DeploySkillBadgeArgs)) as DeployedSkillBadge);

      expect(await skillBadge.owner()).to.equal(deployer.address);
      expect(await mockAttestationsRegistry.getAttestationValue(1, user.address)).to.equal(2);
    });
  });

  /*************************************************************************************/
  /********************************** Set Skill data ***********************************/
  /*************************************************************************************/
  describe('Skill data setter', () => {
    it('should revert due skill data setter not being admin', async () => {
      await expect(skillBadge.connect(notAdmin).setSkillData(0, [1], [10])).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('should set skill data', async () => {
      await skillBadge.setSkillData(0, [1], [10]);
      await skillBadge.setSkillData(0, [2], [5]);
      expect(await skillBadge.getSkillToCredWeight(0, 1)).to.equal(10);
      expect(await skillBadge.getSkillToCredWeight(0, 2)).to.equal(5);
    });
  });

  /*************************************************************************************/
  /********************************** Get Skill balance ***********************************/
  /*************************************************************************************/
  describe('Skill balance getter', () => {
    it('should get skill balance', async () => {
      expect(await skillBadge.balanceOf(user.address, 0)).to.equal(30);
    });
  });
});
