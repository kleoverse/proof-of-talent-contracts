import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import hre, { ethers } from 'hardhat';
import { expect } from 'chai';
import {
  MockBadges,
  MockERC721,
  SkillBadge,
  SkillBadge__factory,
  TransparentUpgradeableProxy__factory,
} from '../../../../types';
import {
  DeployedSkillBadge,
  DeploySkillBadgeArgs,
} from 'tasks/deploy-tasks/unit/periphery/badges/deploy-skill-badge.task';
import {
  DeployedMockBadges,
  DeployMockBadgesArgs,
} from 'tasks/deploy-tasks/tests/deploy-mock-badges.task';
import {
  DeployedMockERC721,
  DeployMockERC721Args,
} from 'tasks/deploy-tasks/tests/deploy-mock-erc721.task';
import { deploymentsConfig } from '../../../../tasks/deploy-tasks/deployments-config';
import { getImplementation } from '../../../../utils';

describe('Test Skill Badge contract', () => {
  let deployer: SignerWithAddress;
  let secondDeployer: SignerWithAddress;
  let admin: SignerWithAddress;
  let notAdmin: SignerWithAddress;
  let user: SignerWithAddress;
  let dummyContract: SignerWithAddress;

  let skillBadge: SkillBadge;
  let mockERC721: MockERC721;
  let mockBadges: MockBadges;

  before(async () => {
    [deployer, secondDeployer, admin, notAdmin, user, dummyContract] = await ethers.getSigners();
  });

  /*************************************************************************************/
  /********************************** DEPLOYMENTS **************************************/
  /*************************************************************************************/
  describe('Deployments', () => {
    it('Should deploy, setup and test the constructed values of the contract', async () => {
      ({ mockBadges } = (await hre.run('deploy-mock-badges', {
        uri: 'https://dummyUri.com/',
        skillPoints: 2,
        options: {
          behindProxy: false,
        },
      } as DeployMockBadgesArgs)) as DeployedMockBadges);

      ({ mockERC721 } = (await hre.run('deploy-mock-erc721', {
        name: 'Mock erc721',
        symbol: 'MERC721',
        skillPoints: 2,
        options: {
          behindProxy: false,
        },
      } as DeployMockERC721Args)) as DeployedMockERC721);

      ({ skillBadge } = (await hre.run('deploy-skill-badge', {
        uri: 'https://dummyUri.com/',
      } as DeploySkillBadgeArgs)) as DeployedSkillBadge);

      expect(await skillBadge.owner()).to.equal(deployer.address);
      expect(await mockBadges.balanceOf(user.address, 1)).to.equal(2);
      expect(await mockERC721.balanceOf(user.address)).to.equal(2);
    });
  });

  /*************************************************************************************/
  /********************************** Set Skill data ***********************************/
  /*************************************************************************************/
  describe('Skill data setter', () => {
    it('should revert due skill data setter not being admin', async () => {
      await expect(
        skillBadge
          .connect(notAdmin)
          .setSkillData(0, [1, 0], [mockBadges.address, mockERC721.address], [1, 0], [10, 5])
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('should revert due mismatch in credIds and weights args length', async () => {
      const skillId = 0;
      const tokenIds = [1, 0];
      const addresses = [mockBadges.address, mockBadges.address, mockERC721.address];
      const contractType = [1, 1, 0];
      const weights = [10, 5, 5];
      await expect(skillBadge.setSkillData(skillId, tokenIds, addresses, contractType, weights))
        .revertedWithCustomError(skillBadge, 'LengthMismatch')
        .withArgs('credIds vs weights');
    });

    it('should revert due mismatch in weights and addresses args length', async () => {
      const skillId = 0;
      const tokenIds = [1, 2, 0];
      const addresses = [mockBadges.address, mockERC721.address];
      const contractType = [1, 1, 0];
      const weights = [10, 5, 5];
      await expect(skillBadge.setSkillData(skillId, tokenIds, addresses, contractType, weights))
        .revertedWithCustomError(skillBadge, 'LengthMismatch')
        .withArgs('weights vs addresses');
    });

    it('should revert due mismatch in addresses and contractTypes args length', async () => {
      const skillId = 0;
      const tokenIds = [1, 2, 0];
      const addresses = [mockBadges.address, mockBadges.address, mockERC721.address];
      const contractType = [1, 0];
      const weights = [10, 5, 5];
      await expect(skillBadge.setSkillData(skillId, tokenIds, addresses, contractType, weights))
        .revertedWithCustomError(skillBadge, 'LengthMismatch')
        .withArgs('addresses vs contractTypes');
    });

    it('should set skill data for first skill', async () => {
      const skillId = 0;
      const tokenIds = [1, 2, 0];
      const addresses = [mockBadges.address, mockBadges.address, mockERC721.address];
      const contractType = [1, 1, 0];
      const weights = [10, 5, 5];
      await expect(skillBadge.setSkillData(skillId, tokenIds, addresses, contractType, weights))
        .emit(skillBadge, 'SkillDataSet')
        .withArgs(skillId, tokenIds, addresses, contractType, weights);
      expect(await skillBadge.getSkillToCredWeight(0, mockBadges.address, 1)).to.equal(10);
      expect(await skillBadge.getSkillToCredWeight(0, mockBadges.address, 2)).to.equal(5);
      expect(await skillBadge.getSkillToCredWeight(0, mockERC721.address, 0)).to.equal(5);
    });

    it('should set skill data for second skill', async () => {
      const skillId = 1;
      const tokenIds = [1, 0];
      const addresses = [mockBadges.address, mockERC721.address];
      const contractType = [1, 0];
      const weights = [10, 5];
      await expect(skillBadge.setSkillData(skillId, tokenIds, addresses, contractType, weights))
        .emit(skillBadge, 'SkillDataSet')
        .withArgs(skillId, tokenIds, addresses, contractType, weights);
      expect(await skillBadge.getSkillToCredWeight(1, mockBadges.address, 1)).to.equal(10);
      expect(await skillBadge.getSkillToCredWeight(1, mockERC721.address, 0)).to.equal(5);
    });
  });

  /*************************************************************************************/
  /********************************** Get Skill data ***********************************/
  /*************************************************************************************/
  describe('Skill data getter', () => {
    it('should get skill balance', async () => {
      expect(await skillBadge.balanceOf(user.address, 0)).to.equal(40);
      expect(await skillBadge.balanceOf(user.address, 1)).to.equal(30);
    });

    it('should get skill balance in batch', async () => {
      expect(await skillBadge.balanceOfBatch([user.address, user.address], [0, 1])).to.deep.equal([
        40, 30,
      ]);
    });

    it('should get cred data of skill', async () => {
      expect(await skillBadge.getSkillToCredData(0)).to.deep.equal([
        [1, 2, 0],
        [mockBadges.address, mockBadges.address, mockERC721.address],
        [1, 1, 0],
      ]);
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

      const { skillBadge: newSkillBadge } = await hre.run('deploy-skill-badge', {
        uri: 'https://token_cdn.domain/',
        owner: secondDeployer.address,
        options: { behindProxy: false },
      });
      const skillBadgeProxy = TransparentUpgradeableProxy__factory.connect(
        skillBadge.address,
        proxyAdminSigner
      );

      await (await skillBadgeProxy.upgradeTo(newSkillBadge.address)).wait();

      const implementationAddress = await getImplementation(skillBadgeProxy);
      expect(implementationAddress).to.eql(newSkillBadge.address);
    });
  });
});
