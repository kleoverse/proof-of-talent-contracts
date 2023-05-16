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

import { IdentityMerkleAttester, IdentityMerkleAttester__factory } from '../../../../../types';
import { BigNumber, BigNumberish } from 'ethers';

export interface DeployIdentityMerkleAttesterArgs {
  attestationsRegistryAddress: string;
  availableRootsRegistryAddress: string;
  collectionIdFirst: BigNumberish;
  collectionIdLast: BigNumberish;
  migrationContractAddress: string;
  options?: DeployOptions;
}

export interface DeployedIdentityMerkleAttester {
  identityMerkleAttester: IdentityMerkleAttester;
}

const CONTRACT_NAME = 'IdentityMerkleAttester';

async function deploymentAction(
  {
    attestationsRegistryAddress,
    availableRootsRegistryAddress,
    collectionIdFirst = 100,
    collectionIdLast = 0,
    migrationContractAddress,
    options,
  }: DeployIdentityMerkleAttesterArgs,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedIdentityMerkleAttester> {
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);

  const deploymentArgs = [
    attestationsRegistryAddress,
    availableRootsRegistryAddress,
    BigNumber.from(collectionIdFirst),
    BigNumber.from(collectionIdLast),
    migrationContractAddress,
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
      behindProxy: false,
    }
  );

  await afterDeployment(hre, deployer, CONTRACT_NAME, deploymentArgs, deployed, options);

  const identityMerkleAttester = IdentityMerkleAttester__factory.connect(
    deployed.address,
    deployer
  );
  return { identityMerkleAttester };
}

task('deploy-identity-merkle-attester')
  .addParam('collectionIdFirst', '')
  .addParam('collectionIdLast', '')
  .addParam('attestationsRegistryAddress', 'Address of the attestations contract')
  .addParam('availableRootsRegistryAddress', 'address of the registryMerkleRoot contract')
  .addParam('migrationContractAddress', 'Address of the migration contract')
  .setAction(wrapCommonDeployOptions(deploymentAction));
