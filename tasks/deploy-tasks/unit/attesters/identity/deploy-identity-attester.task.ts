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

import { IdentityAttester, IdentityAttester__factory } from '../../../../../types';
import { BigNumber, BigNumberish } from 'ethers';

export interface DeployIdentityAttesterArgs {
  attestationsRegistryAddress: string;
  collectionIdFirst: BigNumberish;
  collectionIdLast: BigNumberish;
  verifierAddress: string;
  options?: DeployOptions;
}

export interface DeployedIdentityAttester {
  identityAttester: IdentityAttester;
}

const CONTRACT_NAME = 'IdentityAttester';

async function deploymentAction(
  {
    attestationsRegistryAddress,
    collectionIdFirst = 100,
    collectionIdLast = 0,
    verifierAddress,
    options,
  }: DeployIdentityAttesterArgs,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedIdentityAttester> {
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);

  const deploymentArgs = [
    attestationsRegistryAddress,
    BigNumber.from(collectionIdFirst),
    BigNumber.from(collectionIdLast),
    verifierAddress,
  ];

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

  const identityAttester = IdentityAttester__factory.connect(deployed.address, deployer);
  return { identityAttester };
}

task('deploy-identity-attester')
  .addParam('collectionIdFirst', '')
  .addParam('collectionIdLast', '')
  .addParam('attestationsRegistryAddress', 'Address of the attestations contract')
  .addParam('verifierAddress', 'Address of the verifier')
  .setAction(wrapCommonDeployOptions(deploymentAction));
