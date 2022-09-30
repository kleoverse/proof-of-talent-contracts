import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import {
  DeployedAvailableRootsRegistry,
  DeployAvailableRootsRegistry,
} from '../unit/periphery/deploy-available-roots-registry.task';
import { DeployOptions, getDeployer } from '../utils';
import { DeployCoreArgs, DeployedCore } from '../batch/deploy-core.task';
import { deploymentsConfig } from '../../deploy-tasks/deployments-config';
import { getCommonOptions } from '../../utils/common-options';
import { OwnableTransferOwnershipArgs } from '../../helpers/authorizations/ownable-transfer-ownership.task';
import { AuthorizeRangeArgs } from '../../helpers/authorizations/attestations-registry-authorize-range.task';
import { AccessControlGrantRoleArgs } from '../../helpers/authorizations/access-control-grant-role.task';
import {
  AttestationsRegistry,
  AvailableRootsRegistry,
  Badges,
  Front,
  SignatureAttester,
  IdentityMerkleAttester,
  SkillAttester,
  SkillBadge,
} from 'types';
import {
  DeployedSignatureAttester,
  DeploySignatureAttesterArgs,
} from '../unit/attesters/signature/deploy-signature-attester.task';
import {
  DeployedIdentityMerkleAttester,
  DeployIdentityMerkleAttesterArgs,
} from '../unit/attesters/merkle/deploy-identity-merkle-attester.task';
import {
  DeployedSkillAttester,
  DeploySkillAttesterArgs,
} from '../unit/attesters/skill/deploy-skill-attester.task';
import {
  DeployedSkillBadge,
  DeploySkillBadgeArgs,
} from '../unit/periphery/badges/deploy-skill-badge.task';

export interface Deployed0 {
  attestationsRegistry: AttestationsRegistry;
  badges: Badges;
  front: Front;
  availableRootsRegistry: AvailableRootsRegistry;
  signatureAttester: SignatureAttester;
  identityMerkleAttester: IdentityMerkleAttester;
  skillAttester: SkillAttester;
  skillBadge: SkillBadge;
}

async function deploymentAction(
  { options }: { options: DeployOptions },
  hre: HardhatRuntimeEnvironment
): Promise<Deployed0> {
  const deployer = await getDeployer(hre);
  const config = deploymentsConfig[hre.network.name];
  options = { ...config.deployOptions, ...options };
  if (options.manualConfirm || options.log) {
    console.log('0-deploy-core-and-signature-and-skill-and-identity-merkle: ', hre.network.name);
  }
  // Only deploy contracts without giving final ownership.
  // Owners of the different contract are the deployer
  const { attestationsRegistry, badges, front } = (await hre.run('deploy-core', {
    uri: config.badges.uri,
    frontFirstCollectionId: config.front.collectionIdFirst,
    frontLastCollectionId: config.front.collectionIdLast,
    registryOwner: deployer.address,
    badgeOwner: deployer.address,
    options,
  } as DeployCoreArgs)) as DeployedCore;

  const { availableRootsRegistry } = (await hre.run('deploy-available-roots-registry', {
    options,
  })) as DeployAvailableRootsRegistry as DeployedAvailableRootsRegistry;

  const { skillBadge } = (await hre.run('deploy-skill-badge', {
    uri: config.skillBadge.uri,
    options,
  } as DeploySkillBadgeArgs)) as DeployedSkillBadge;

  const signatureAttesterArgs: DeploySignatureAttesterArgs = {
    collectionIdFirst: config.signatureAttester.collectionIdFirst,
    collectionIdLast: config.signatureAttester.collectionIdLast,
    attestationsRegistryAddress: attestationsRegistry.address,
    verifierAddress: config.signatureAttester.verifierAddress,
    options,
  };

  const { signatureAttester } = (await hre.run(
    'deploy-signature-attester',
    signatureAttesterArgs
  )) as DeployedSignatureAttester;

  const identityMerkleAttesterArgs: DeployIdentityMerkleAttesterArgs = {
    collectionIdFirst: config.identityMerkleAttester.collectionIdFirst,
    collectionIdLast: config.identityMerkleAttester.collectionIdLast,
    attestationsRegistryAddress: attestationsRegistry.address,
    availableRootsRegistryAddress: availableRootsRegistry.address,
    options,
  };

  const { identityMerkleAttester } = (await hre.run(
    'deploy-identity-merkle-attester',
    identityMerkleAttesterArgs
  )) as DeployedIdentityMerkleAttester;

  const skillAttesterArgs: DeploySkillAttesterArgs = {
    collectionIdFirst: config.skillAttester.collectionIdFirst,
    collectionIdLast: config.skillAttester.collectionIdLast,
    attestationsRegistryAddress: attestationsRegistry.address,
    skillBadgeAddress: skillBadge.address,
    options,
  };

  const { skillAttester } = (await hre.run(
    'deploy-skill-attester',
    skillAttesterArgs
  )) as DeployedSkillAttester;

  // Give to the attester the authorization to write on the attestations Registry
  if (options.manualConfirm || options.log) {
    console.log(`
    ----------------------------------------------------------------
    * Authorize SignatureAttester to record on the AttestationsRegistry`);
  }
  await hre.run('attestations-registry-authorize-range', {
    attestationsRegistryAddress: attestationsRegistry.address,
    attesterAddress: signatureAttester.address,
    collectionIdFirst: config.signatureAttester.collectionIdFirst,
    collectionIdLast: config.signatureAttester.collectionIdLast,
    options: getCommonOptions(options),
  } as AuthorizeRangeArgs);

  if (options.manualConfirm || options.log) {
    console.log(`
    ----------------------------------------------------------------
    * Authorize IdentityMerkleAttester to record on the AttestationsRegistry`);
  }
  await hre.run('attestations-registry-authorize-range', {
    attestationsRegistryAddress: attestationsRegistry.address,
    attesterAddress: identityMerkleAttester.address,
    collectionIdFirst: config.identityMerkleAttester.collectionIdFirst,
    collectionIdLast: config.identityMerkleAttester.collectionIdLast,
    options: getCommonOptions(options),
  } as AuthorizeRangeArgs);

  if (options.manualConfirm || options.log) {
    console.log(`
    ----------------------------------------------------------------
    * Authorize SkillAttester to record on the AttestationsRegistry`);
  }
  await hre.run('attestations-registry-authorize-range', {
    attestationsRegistryAddress: attestationsRegistry.address,
    attesterAddress: skillAttester.address,
    collectionIdFirst: config.skillAttester.collectionIdFirst,
    collectionIdLast: config.skillAttester.collectionIdLast,
    options: getCommonOptions(options),
  } as AuthorizeRangeArgs);

  // ----------  SET FINAL OWNERSHIP -------------
  if (options.manualConfirm || options.log) {
    console.log(`
    ----------------------------------------------------------------
    * Transfer AttestationsRegistry ownership`);
  }
  await hre.run('ownable-transfer-ownership', {
    contractAddress: attestationsRegistry.address,
    newOwner: config.attestationsRegistry.owner,
    options: getCommonOptions(options),
  } as OwnableTransferOwnershipArgs);

  // Move ownership commitmentMapper ownership
  if (options.manualConfirm || options.log) {
    console.log(`
    ----------------------------------------------------------------
    * Transfer AvailableRootsRegistry ownership`);
  }
  await hre.run('ownable-transfer-ownership', {
    contractAddress: availableRootsRegistry.address,
    newOwner: config.availableRootsRegistry.owner,
    options: getCommonOptions(options),
  } as OwnableTransferOwnershipArgs);

  // Move admin ownership of the access control contract the "owner".
  if (options.manualConfirm || options.log) {
    console.log(`
    ----------------------------------------------------------------
    * Granting role DEFAULT_ADMIN_ROLE of Badges to the Badges contract owner`);
  }
  await hre.run('access-control-grant-role', {
    contractAddress: badges.address,
    role: await badges.DEFAULT_ADMIN_ROLE(),
    accountAddress: config.badges.owner,
    options: getCommonOptions(options),
  } as AccessControlGrantRoleArgs);

  if (options.manualConfirm || options.log) {
    console.log(`
    ************************************************************
    *                           RECAP                          *
    ************************************************************

    date: ${new Date().toISOString()}

    ** Common **
      proxyAdmin: ${config.deployOptions.proxyAdmin}

    * Front
      -> proxy: ${(await hre.deployments.all()).Front.address}
      -> implem: ${(await hre.deployments.all()).FrontImplem.address}

    * AttestationsRegistry
      -> proxy: ${(await hre.deployments.all()).AttestationsRegistry.address}
      -> implem: ${(await hre.deployments.all()).AttestationsRegistryImplem.address}
      owner: ${config.attestationsRegistry.owner}
    
    * Badges
      -> proxy: ${(await hre.deployments.all()).Badges.address}
      -> implem: ${(await hre.deployments.all()).BadgesImplem.address}
      uri: ${config.badges.uri}
    
    * Skill Badge
      -> proxy: ${(await hre.deployments.all()).SkillBadge.address}
      -> implem: ${(await hre.deployments.all()).SkillBadgeImplem.address}
      uri: ${config.skillBadge.uri}

    * SignatureAttester:
      -> proxy: ${(await hre.deployments.all()).SignatureAttester.address}
      -> implem: ${(await hre.deployments.all()).SignatureAttesterImplem.address}
      collectionIdFirst: ${config.signatureAttester.collectionIdFirst}
      collectionIdLast: ${config.signatureAttester.collectionIdLast}

    * IdentityMerkleAttester:
      -> proxy: ${(await hre.deployments.all()).IdentityMerkleAttester.address}
      -> implem: ${(await hre.deployments.all()).IdentityMerkleAttester.address}
      collectionIdFirst: ${config.identityMerkleAttester.collectionIdFirst}
      collectionIdLast: ${config.identityMerkleAttester.collectionIdLast}

    * SkillAttester:
      -> proxy: ${(await hre.deployments.all()).SkillAttester.address}
      -> implem: ${(await hre.deployments.all()).SkillAttesterImplem.address}
      collectionIdFirst: ${config.skillAttester.collectionIdFirst}
      collectionIdLast: ${config.skillAttester.collectionIdLast}
    
    * AvailableRootsRegistry: 
      -> proxy: ${(await hre.deployments.all()).AvailableRootsRegistry.address}
      -> implem: ${(await hre.deployments.all()).AvailableRootsRegistryImplem.address}
      owner: ${config.availableRootsRegistry.owner}

  `);
  }

  return {
    signatureAttester,
    identityMerkleAttester,
    skillAttester,
    availableRootsRegistry,
    front,
    badges,
    attestationsRegistry,
    skillBadge,
  };
}

task('0-deploy-core-and-signature-and-skill-and-identity-merkle').setAction(deploymentAction);
