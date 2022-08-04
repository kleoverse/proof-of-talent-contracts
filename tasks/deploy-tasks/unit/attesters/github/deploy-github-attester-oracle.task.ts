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

import { GithubAttesterOracle, GithubAttesterOracle__factory } from '../../../../../types';
import { BigNumber, BigNumberish } from 'ethers';

export interface DeployGithubAttesterOracleArgs {
  owner: string;
  // address of the attester oracle
  attesterOracleAddress: string;
  // address of the attestations contract,
  // which is part of the SAS
  // Sismo Attestation State
  attestationsRegistryAddress: string;
  collectionIdFirst: BigNumberish;
  collectionIdLast: BigNumberish;
  options?: DeployOptions;
}

export interface DeployedGithubAttesterOracle {
  githubAttesterOracle: GithubAttesterOracle;
}

const CONTRACT_NAME = 'GithubAttesterOracle';

async function deploymentAction(
  {
    owner,
    attesterOracleAddress,
    attestationsRegistryAddress,
    collectionIdFirst = 100,
    collectionIdLast = 0,
    options,
  }: DeployGithubAttesterOracleArgs,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedGithubAttesterOracle> {
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);

  const deploymentArgs = [
    owner,
    attestationsRegistryAddress,
    attesterOracleAddress,
    BigNumber.from(collectionIdFirst),
    BigNumber.from(collectionIdLast),
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

  const githubAttesterOracle = GithubAttesterOracle__factory.connect(deployed.address, deployer);
  return { githubAttesterOracle };
}

task('deploy-github-attester-oracle')
  .addParam('collectionIdFirst', '')
  .addParam('collectionIdLast', '')
  .addParam('owner', 'Address of the owner')
  .addParam('attesterOracleAddress', 'Address of the attester oracle')
  .addParam('attestationsRegistryAddress', 'Address of the attestations contract')
  .setAction(wrapCommonDeployOptions(deploymentAction));
