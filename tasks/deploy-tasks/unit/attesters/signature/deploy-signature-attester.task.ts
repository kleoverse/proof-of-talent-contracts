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

import { SignatureAttester, SignatureAttester__factory } from '../../../../../types';
import { BigNumber, BigNumberish } from 'ethers';

export interface DeploySignatureAttesterArgs {
  // address of the attestations contract,
  // which is part of the SAS
  // Proof of Talent Attestation State
  attestationsRegistryAddress: string;
  collectionIdFirst: BigNumberish;
  collectionIdLast: BigNumberish;
  verifierAddress: string;
  migrationContractAddress: string;
  options?: DeployOptions;
}

export interface DeployedSignatureAttester {
  signatureAttester: SignatureAttester;
}

const CONTRACT_NAME = 'SignatureAttester';

async function deploymentAction(
  {
    attestationsRegistryAddress,
    collectionIdFirst = 100,
    collectionIdLast = 0,
    verifierAddress,
    migrationContractAddress,
    options,
  }: DeploySignatureAttesterArgs,
  hre: HardhatRuntimeEnvironment
): Promise<DeployedSignatureAttester> {
  const deployer = await getDeployer(hre);
  const deploymentName = buildDeploymentName(CONTRACT_NAME, options?.deploymentNamePrefix);

  const deploymentArgs = [
    attestationsRegistryAddress,
    BigNumber.from(collectionIdFirst),
    BigNumber.from(collectionIdLast),
    verifierAddress,
    migrationContractAddress,
  ];

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

  const signatureAttester = SignatureAttester__factory.connect(deployed.address, deployer);
  return { signatureAttester };
}

task('deploy-signature-attester')
  .addParam('collectionIdFirst', '')
  .addParam('collectionIdLast', '')
  .addParam('attestationsRegistryAddress', 'Address of the attestations contract')
  .addParam('verifierAddress', 'Address of the verifier')
  .addParam('migrationContractAddress', 'Address of the migration contract')
  .setAction(wrapCommonDeployOptions(deploymentAction));
