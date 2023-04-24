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
} from '../../../../tasks/deploy-tasks/utils';

import { AttesterDataMigration__factory, AttesterDataMigration } from '../../../../types';

export interface DeployAttesterDataMigration {
  // owner of the contract
  options?: DeployOptions;
}

export interface DeployedAttesterDataMigration {
  attesterDataMigration: AttesterDataMigration;
}

const CONTRACT_NAME = 'AttesterDataMigration';

async function deploymentAction(
  { options }: DeployAttesterDataMigration,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedAttesterDataMigration> {
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);
  const deploymentArgs = [];

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

  const attesterDataMigration = AttesterDataMigration__factory.connect(deployed.address, deployer);
  return { attesterDataMigration };
}

task('deploy-attester-data-migration').setAction(wrapCommonDeployOptions(deploymentAction));
