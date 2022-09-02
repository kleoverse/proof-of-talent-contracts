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
import { MockERC721, MockERC721__factory } from '../../../types';

export interface DeployMockERC721Args {
  // address of the attestations Registry contract
  name: string;
  symbol: string;
  skillPoints: BigNumberish;
  options?: DeployOptions;
}

export interface DeployedMockERC721 {
  mockERC721: MockERC721;
}

const CONTRACT_NAME = 'MockERC721';

async function deploymentAction(
  { name, symbol, skillPoints, options }: DeployMockERC721Args,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedMockERC721> {
  const deployer = await getDeployer(hre);

  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);

  const deploymentArgs = [name, symbol, skillPoints || 0];

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
  const mockERC721 = MockERC721__factory.connect(deployed.address, deployer);
  return { mockERC721 };
}

task('deploy-mock-erc721')
  .addParam('name', 'Name of the contract')
  .addOptionalParam('symbol', 'Symbol of the contract')
  .setAction(wrapCommonDeployOptions(deploymentAction));
