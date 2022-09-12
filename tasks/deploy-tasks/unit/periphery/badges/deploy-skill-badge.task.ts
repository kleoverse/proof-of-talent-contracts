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
  uri: string;
  options?: DeployOptions;
}

export interface DeployedSkillBadge {
  skillBadge: SkillBadge;
}

const CONTRACT_NAME = 'SkillBadge';

async function deploymentAction(
  { uri, options }: DeploySkillBadgeArgs,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedSkillBadge> {
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);

  const deploymentArgs = [uri];

  await beforeDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, options);

  const initData = new SkillBadge__factory(deployer).interface.encodeFunctionData('initialize', [
    uri,
  ]);

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
  .addParam('uri', 'Uri for the metadata')
  .setAction(wrapCommonDeployOptions(deploymentAction));
