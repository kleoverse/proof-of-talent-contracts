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

import { SkillBadge, SkillBadge__factory } from '../../../../../types';
import { BigNumber, BigNumberish } from 'ethers';

export interface DeploySkillBadgeArgs {
  attestationsRegistryAddress: string;
  uri: string;
  options?: DeployOptions;
}

export interface DeployedSkillBadge {
  skillBadge: SkillBadge;
}

const CONTRACT_NAME = 'SkillBadge';

async function deploymentAction(
  { attestationsRegistryAddress, uri, options }: DeploySkillBadgeArgs,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedSkillBadge> {
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);

  const deploymentArgs = [attestationsRegistryAddress, uri];

  await beforeDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, options);

  const initData = '0x';

  if (options?.behindProxy) options.behindProxy = false;
  const deployed = await customDeployContract(
    hre,
    deployer,
    deploymentName,
    CONTRACT_NAME,
    deploymentArgs,
    {
      ...options,
      proxyData: initData,
    }
  );

  await afterDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, deployed, options);

  const skillBadge = SkillBadge__factory.connect(deployed.address, deployer);
  return { skillBadge };
}

task('deploy-skill-badge')
  .addParam('attestationsRegistryAddress', 'Address of the attestations contract')
  .addParam('uri', 'Uri for the metadata')
  .setAction(wrapCommonDeployOptions(deploymentAction));
