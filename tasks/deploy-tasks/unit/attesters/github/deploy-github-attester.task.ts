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

import { GithubAttester, GithubAttester__factory } from '../../../../../types';
import { BigNumber, BigNumberish } from 'ethers';

export interface DeployGithubAttesterArgs {
  // address of the attestations contract,
  // which is part of the SAS
  // Sismo Attestation State
  attestationsRegistryAddress: string;
  collectionIdFirst: BigNumberish;
  collectionIdLast: BigNumberish;
  verifierAddress: string;
  options?: DeployOptions;
}

export interface DeployedGithubAttester {
  githubAttester: GithubAttester;
}

const CONTRACT_NAME = 'GithubAttester';

async function deploymentAction(
  {
    attestationsRegistryAddress,
    collectionIdFirst = 100,
    collectionIdLast = 0,
    verifierAddress,
    options,
  }: DeployGithubAttesterArgs,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedGithubAttester> {
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);

  const deploymentArgs = [
    attestationsRegistryAddress,
    BigNumber.from(collectionIdFirst),
    BigNumber.from(collectionIdLast),
    verifierAddress,
  ];
  console.log('verifierAddress', verifierAddress);

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

  const githubAttester = GithubAttester__factory.connect(deployed.address, deployer);
  return { githubAttester };
}

task('deploy-github-attester')
  .addParam('collectionIdFirst', '')
  .addParam('collectionIdLast', '')
  .addParam('attestationsRegistryAddress', 'Address of the attestations contract')
  .addParam('verifierAddress', 'Address of the verifier')
  .setAction(wrapCommonDeployOptions(deploymentAction));
