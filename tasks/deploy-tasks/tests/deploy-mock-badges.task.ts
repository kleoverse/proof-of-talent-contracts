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
import { MockBadges, MockBadges__factory } from '../../../types';

export interface DeployMockBadgesArgs {
  uri: string;
  skillPoints: BigNumberish;
  options?: DeployOptions;
}

export interface DeployedMockBadges {
  mockBadges: MockBadges;
}

const CONTRACT_NAME = 'MockBadges';

async function deploymentAction(
  { uri, skillPoints, options }: DeployMockBadgesArgs,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedMockBadges> {
  const deployer = await getDeployer(hre);

  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);

  const deploymentArgs = [uri, skillPoints || 0];

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
  const mockBadges = MockBadges__factory.connect(deployed.address, deployer);
  return { mockBadges };
}

task('deploy-mock-badges')
  .addOptionalParam('uri', 'uri for the metadata')
  .setAction(wrapCommonDeployOptions(deploymentAction));
