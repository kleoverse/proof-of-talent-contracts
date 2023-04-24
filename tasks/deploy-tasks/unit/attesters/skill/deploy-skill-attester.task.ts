import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import {
  getDeployer,
  beforeDeployment,
  afterDeployment,
  buildDeploymentName,
  customDeployContract,
  wrapCommonDeployOptions,
  DeployOptions,
} from '../../../utils';

import { SkillAttester, SkillAttester__factory } from '../../../../../types';
import { BigNumber, BigNumberish } from 'ethers';

export interface DeploySkillAttesterArgs {
  attestationsRegistryAddress: string;
  collectionIdFirst: BigNumberish;
  collectionIdLast: BigNumberish;
  skillBadgeAddress: string;
  migrationContractAddress: string;
  options?: DeployOptions;
}

export interface DeployedSkillAttester {
  skillAttester: SkillAttester;
}

const CONTRACT_NAME = 'SkillAttester';

async function deploymentAction(
  {
    attestationsRegistryAddress,
    collectionIdFirst = 100,
    collectionIdLast = 0,
    skillBadgeAddress,
    migrationContractAddress,
    options,
  }: DeploySkillAttesterArgs,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedSkillAttester> {
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);

  const deploymentArgs = [
    attestationsRegistryAddress,
    BigNumber.from(collectionIdFirst),
    BigNumber.from(collectionIdLast),
    skillBadgeAddress,
    migrationContractAddress,
  ];

  await beforeDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, options);

  const initData = '0x';

  const deployed = await customDeployContract(
    hre,
    deployer,
    deploymentName,
    CONTRACT_NAME,
    deploymentArgs,
    {
      ...options,
      proxyData: initData,
      behindProxy: false,
    }
  );

  await afterDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, deployed, options);

  const skillAttester = SkillAttester__factory.connect(deployed.address, deployer);
  return { skillAttester };
}

task('deploy-skill-attester')
  .addParam('collectionIdFirst', '')
  .addParam('collectionIdLast', '')
  .addParam('attestationsRegistryAddress', 'Address of the attestations contract')
  .addParam('skillBadgeAddress', 'Address of the skill badge contract')
  .addParam('migrationContractAddress', 'Address of the migration contract')
  .setAction(wrapCommonDeployOptions(deploymentAction));
