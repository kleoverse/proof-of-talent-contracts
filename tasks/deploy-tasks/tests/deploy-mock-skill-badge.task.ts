import { BigNumberish } from 'ethers';
import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import {
  afterDeployment,
  beforeDeployment,
  buildDeploymentName,
  customDeployContract,
  DeployOptions,
  getDeployer,
  wrapCommonDeployOptions,
} from '../../../tasks/deploy-tasks/utils';
import { MockSkillBadge, MockSkillBadge__factory } from '../../../types';

export interface DeployMockSkillBadgeArgs {
  // address of the attestations Registry contract
  attestationsRegistryAddress: string;
  uri: string;
  skillPoints: BigNumberish;
  options?: DeployOptions;
}

export interface DeployedMockSkillBadge {
  mockSkillBadge: MockSkillBadge;
}

const CONTRACT_NAME = 'MockSkillBadge';

async function deploymentAction(
  { attestationsRegistryAddress, uri, skillPoints, options }: DeployMockSkillBadgeArgs,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedMockSkillBadge> {
  const deployer = await getDeployer(hre);

  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);

  const deploymentArgs = [attestationsRegistryAddress, uri, skillPoints];

  await beforeDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, options);

  const deployed = await customDeployContract(
    hre,
    deployer,
    deploymentName,
    CONTRACT_NAME,
    deploymentArgs,
    options
  );

  await afterDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, deployed, options);
  const mockSkillBadge = MockSkillBadge__factory.connect(deployed.address, deployer);
  return { mockSkillBadge };
}

task('deploy-mock-skill-badge')
  .addParam('attestationsRegistryAddress', 'Address of the attestations contract')
  .addOptionalParam('uri', 'uri for metadata')
  .addOptionalParam('skillPoints', 'mock skill points data')
  .setAction(wrapCommonDeployOptions(deploymentAction));
