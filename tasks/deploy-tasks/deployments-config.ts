import { DeploymentsConfigTypes } from './utils/deployments-config-types';
import { ethers } from 'ethers';

const COMMITMENT_MAPPER_EDDSA_PUB_KEY_PROD = [
  '0x0c6c16efc72c198f4549bd069f1e57f091885234b9c140286d80ef431151d644',
  '0x12c54731563d974ead25d469d2263fdf0e230d5a09f6cd40a06e60210610d642',
];

const COMMITMENT_MAPPER_EDDSA_PUB_KEY_STAGING = [
  '0x1e468ad0fcde4edec429cd41eb28a0e78d4f31fa2c25172ef677468b2b38a9dc',
  '0x2b6e9a8e3b8ed419cca51e2e2ee7ae07d2902454deca17d7da7b00ae4a798add',
];

const COMMITMENT_MAPPER_TESTER = [
  '3268380547641047729088085784617708493474401130426516096643943726492544573596',
  '15390691699624678165709040191639591743681460873292995904381058558679154201615',
];

const THREE_DAYS = '295200';
// Rinkeby
const ALPHA_GOERLI_OWNER = '0x1Fe64E7E5ce645a751c239f9F656b136F41D4aE0';
const ALPHA_GOERLI_ROOTS_OWNER_RELAYER = '0x1Fe64E7E5ce645a751c239f9F656b136F41D4aE0';
const ALPHA_GOERLI_PROXY_ADMIN = '0xA02CDdFa44B8C01b4257F54ac1c43F75801E8175';
const ALPHA_GOERLI_VERIFIER = '0x1Fe64E7E5ce645a751c239f9F656b136F41D4aE0';
// Polygon
const ALPHA_POLYGON_OWNER = '0xe5c7bd50c532C518Fc2613C2934Bd2003940298C';
const ALPHA_POLYGON_ROOTS_OWNER_RELAYER = '0xe5c7bd50c532C518Fc2613C2934Bd2003940298C';
const ALPHA_POLYGON_PROXY_ADMIN = '0x1Fe64E7E5ce645a751c239f9F656b136F41D4aE0';
const ALPHA_POLYGON_VERIFIER = '0xe5c7bd50c532C518Fc2613C2934Bd2003940298C';

export const deploymentsConfig: DeploymentsConfigTypes = {
  polygon: {
    deployOptions: {
      manualConfirm: true,
      log: true,
      behindProxy: true,
      proxyAdmin: ALPHA_POLYGON_PROXY_ADMIN,
    },
    badges: {
      owner: ALPHA_POLYGON_OWNER,
      // Badges Metadata URI for the Badges contract
      uri: 'https://lsccfzddbsxbldlhvfco.supabase.co/storage/v1/object/public/badges/polygon/metadata/{id}.json',
    },
    signatureAttester: {
      collectionIdFirst: '0',
      collectionIdLast: '10000000',
      verifierAddress: ALPHA_POLYGON_VERIFIER,
      migrationContractAddress: ethers.constants.AddressZero,
    },
    skillAttester: {
      collectionIdFirst: '10000001',
      collectionIdLast: '20000000',
      migrationContractAddress: ethers.constants.AddressZero,
    },
    identityMerkleAttester: {
      collectionIdFirst: '20000001',
      collectionIdLast: '30000000',
      migrationContractAddress: ethers.constants.AddressZero,
    },
    hydraS1SimpleAttester: {
      collectionIdFirst: '30000001',
      collectionIdLast: '40000000',
      initialRoot: '0x163c3224fa82070fbee7692146f505144b0307d668d8e8f803171b6ee7a4cd00',
    },
    hydraS1SoulboundAttester: {
      collectionIdFirst: '40000001',
      collectionIdLast: '50000000',
      soulboundCooldownDuration: THREE_DAYS, // 3 days
      initialRoot: '0',
    },
    front: {
      collectionIdFirst: '50000001',
      collectionIdLast: '60000000',
    },
    skillBadge: {
      uri: 'https://lsccfzddbsxbldlhvfco.supabase.co/storage/v1/object/public/badges/polygon/metadata/{id}.json',
    },
    attestationsRegistry: {
      owner: ALPHA_POLYGON_OWNER,
    },
    availableRootsRegistry: {
      owner: ALPHA_POLYGON_ROOTS_OWNER_RELAYER,
    },
    commitmentMapper: {
      owner: ALPHA_POLYGON_OWNER,
      EdDSAPubKeyX: COMMITMENT_MAPPER_EDDSA_PUB_KEY_PROD[0],
      EdDSAPubKeyY: COMMITMENT_MAPPER_EDDSA_PUB_KEY_PROD[1],
    },
  },
  // owners: 0xb8b85903f5c2f5506abb7ad2bcbd646b89e308a4 is the signer1
  // of the "dev-staging-rinkeby-mnemonic"
  rinkeby: {
    deployOptions: {
      manualConfirm: false,
      log: true,
      behindProxy: true,
      proxyAdmin: ALPHA_GOERLI_PROXY_ADMIN,
    },
    badges: {
      owner: ALPHA_GOERLI_OWNER,
      // Badges Metadata URI for the Badges contract
      uri: 'https://lsccfzddbsxbldlhvfco.supabase.co/storage/v1/object/public/badges/rinkeby/metadata/{id}.json',
    },
    signatureAttester: {
      collectionIdFirst: '0',
      collectionIdLast: '10000000',
      verifierAddress: ALPHA_GOERLI_VERIFIER,
      migrationContractAddress: ethers.constants.AddressZero,
    },
    skillAttester: {
      collectionIdFirst: '10000001',
      collectionIdLast: '20000000',
      migrationContractAddress: ethers.constants.AddressZero,
    },
    identityMerkleAttester: {
      collectionIdFirst: '20000001',
      collectionIdLast: '30000000',
      migrationContractAddress: ethers.constants.AddressZero,
    },
    hydraS1SimpleAttester: {
      collectionIdFirst: '30000001',
      collectionIdLast: '40000000',
      initialRoot: '0x0deb3822cd7d8c6ece7456c8e7ff81d61c8991390072f2cee0f711102741e259',
    },
    hydraS1SoulboundAttester: {
      collectionIdFirst: '40000001',
      collectionIdLast: '50000000',
      soulboundCooldownDuration: THREE_DAYS, // 3 days
      initialRoot: '0',
    },
    front: {
      collectionIdFirst: '50000001',
      collectionIdLast: '60000000',
    },
    skillBadge: {
      uri: 'https://lsccfzddbsxbldlhvfco.supabase.co/storage/v1/object/public/badges/rinkeby/metadata/{id}.json',
    },
    attestationsRegistry: {
      owner: ALPHA_GOERLI_OWNER,
    },
    availableRootsRegistry: {
      owner: ALPHA_GOERLI_ROOTS_OWNER_RELAYER,
    },
    commitmentMapper: {
      owner: ALPHA_GOERLI_OWNER,
      EdDSAPubKeyX: COMMITMENT_MAPPER_EDDSA_PUB_KEY_STAGING[0],
      EdDSAPubKeyY: COMMITMENT_MAPPER_EDDSA_PUB_KEY_STAGING[1],
    },
  },
  goerli: {
    deployOptions: {
      manualConfirm: false,
      log: true,
      behindProxy: true,
      proxyAdmin: ALPHA_GOERLI_PROXY_ADMIN,
    },
    badges: {
      owner: ALPHA_GOERLI_OWNER,
      // Badges Metadata URI for the Badges contract
      uri: 'https://lsccfzddbsxbldlhvfco.supabase.co/storage/v1/object/public/badges/goerli/metadata/{id}.json',
    },
    signatureAttester: {
      collectionIdFirst: '0',
      collectionIdLast: '10000000',
      verifierAddress: ALPHA_GOERLI_VERIFIER,
      migrationContractAddress: ethers.constants.AddressZero,
    },
    skillAttester: {
      collectionIdFirst: '10000001',
      collectionIdLast: '20000000',
      migrationContractAddress: ethers.constants.AddressZero,
    },
    identityMerkleAttester: {
      collectionIdFirst: '20000001',
      collectionIdLast: '30000000',
      migrationContractAddress: ethers.constants.AddressZero,
    },
    hydraS1SimpleAttester: {
      collectionIdFirst: '30000001',
      collectionIdLast: '40000000',
      initialRoot: '0x0deb3822cd7d8c6ece7456c8e7ff81d61c8991390072f2cee0f711102741e259',
    },
    hydraS1SoulboundAttester: {
      collectionIdFirst: '40000001',
      collectionIdLast: '50000000',
      soulboundCooldownDuration: THREE_DAYS, // 3 days
      initialRoot: '0',
    },
    front: {
      collectionIdFirst: '50000001',
      collectionIdLast: '60000000',
    },
    skillBadge: {
      uri: 'https://lsccfzddbsxbldlhvfco.supabase.co/storage/v1/object/public/badges/goerli/metadata/{id}.json',
    },
    attestationsRegistry: {
      owner: ALPHA_GOERLI_OWNER,
    },
    availableRootsRegistry: {
      owner: ALPHA_GOERLI_ROOTS_OWNER_RELAYER,
    },
    commitmentMapper: {
      owner: ALPHA_GOERLI_OWNER,
      EdDSAPubKeyX: COMMITMENT_MAPPER_EDDSA_PUB_KEY_STAGING[0],
      EdDSAPubKeyY: COMMITMENT_MAPPER_EDDSA_PUB_KEY_STAGING[1],
    },
  },
  local: {
    deployOptions: {
      manualConfirm: false,
      log: true,
      behindProxy: true,
      // account 3 of shared mnemonic
      proxyAdmin: '0xc11d0d9e1e6c16ea5e5395e0129ca34262ca2315',
    },
    badges: {
      // account 0 of shared mneomonic
      owner: '0xb01ee322C4f028B8A6BFcD2a5d48107dc5bC99EC',
      uri: 'https://lsccfzddbsxbldlhvfco.supabase.co/storage/v1/object/public/badges/local/metadata/{id}.json',
    },
    signatureAttester: {
      collectionIdFirst: '0',
      collectionIdLast: '10000000',
      verifierAddress: '0xb01ee322C4f028B8A6BFcD2a5d48107dc5bC99EC',
      migrationContractAddress: ethers.constants.AddressZero,
    },
    skillAttester: {
      collectionIdFirst: '10000001',
      collectionIdLast: '20000000',
      migrationContractAddress: ethers.constants.AddressZero,
    },
    identityMerkleAttester: {
      collectionIdFirst: '20000001',
      collectionIdLast: '30000000',
      migrationContractAddress: ethers.constants.AddressZero,
    },
    hydraS1SimpleAttester: {
      collectionIdFirst: '30000001',
      collectionIdLast: '40000000',
      initialRoot: '0x0deb3822cd7d8c6ece7456c8e7ff81d61c8991390072f2cee0f711102741e259',
    },
    hydraS1SoulboundAttester: {
      collectionIdFirst: '40000001',
      collectionIdLast: '50000000',
      initialRoot: '0x0deb3822cd7d8c6ece7456c8e7ff81d61c8991390072f2cee0f711102741e259',
      soulboundCooldownDuration: THREE_DAYS, // 3 days
    },
    front: {
      collectionIdFirst: '50000001',
      collectionIdLast: '60000000',
    },
    skillBadge: {
      uri: 'https://lsccfzddbsxbldlhvfco.supabase.co/storage/v1/object/public/badges/local/metadata/{id}.json',
    },
    attestationsRegistry: {
      owner: '0xb01ee322C4f028B8A6BFcD2a5d48107dc5bC99EC',
    },
    availableRootsRegistry: {
      owner: '0xb01ee322C4f028B8A6BFcD2a5d48107dc5bC99EC',
    },
    commitmentMapper: {
      owner: '0xb01ee322C4f028B8A6BFcD2a5d48107dc5bC99EC',
      EdDSAPubKeyX: '0x1e468ad0fcde4edec429cd41eb28a0e78d4f31fa2c25172ef677468b2b38a9dc',
      EdDSAPubKeyY: '0x2b6e9a8e3b8ed419cca51e2e2ee7ae07d2902454deca17d7da7b00ae4a798add',
    },
  },
  hardhat: {
    deployOptions: {
      manualConfirm: false,
      log: true,
      behindProxy: true,
      // account 13 of shared mnemonic
      proxyAdmin: '0x569eaB3c91828B7d9f951d335bC12A6aABEc1458',
    },
    badges: {
      // account 0 of shared mneomonic
      owner: '0xb01ee322C4f028B8A6BFcD2a5d48107dc5bC99EC',
      uri: 'https://lsccfzddbsxbldlhvfco.supabase.co/storage/v1/object/public/badges/local/metadata/{id}.json',
    },
    signatureAttester: {
      collectionIdFirst: '0',
      collectionIdLast: '10000000',
      verifierAddress: '0xb01ee322C4f028B8A6BFcD2a5d48107dc5bC99EC',
      migrationContractAddress: ethers.constants.AddressZero,
    },
    skillAttester: {
      collectionIdFirst: '10000001',
      collectionIdLast: '20000000',
      migrationContractAddress: ethers.constants.AddressZero,
    },
    identityMerkleAttester: {
      collectionIdFirst: '20000001',
      collectionIdLast: '30000000',
      migrationContractAddress: ethers.constants.AddressZero,
    },
    hydraS1SimpleAttester: {
      collectionIdFirst: '30000001',
      collectionIdLast: '40000000',
      initialRoot: '0x0deb3822cd7d8c6ece7456c8e7ff81d61c8991390072f2cee0f711102741e259',
    },
    hydraS1SoulboundAttester: {
      collectionIdFirst: '40000001',
      collectionIdLast: '50000000',
      initialRoot: '0x0deb3822cd7d8c6ece7456c8e7ff81d61c8991390072f2cee0f711102741e259',
      soulboundCooldownDuration: THREE_DAYS, // 3 days
    },
    front: {
      collectionIdFirst: '50000001',
      collectionIdLast: '60000000',
    },
    skillBadge: {
      uri: 'https://lsccfzddbsxbldlhvfco.supabase.co/storage/v1/object/public/badges/local/metadata/{id}.json',
    },
    attestationsRegistry: {
      owner: '0xb01ee322c4f028b8a6bfcd2a5d48107dc5bc99ec',
    },
    availableRootsRegistry: {
      owner: '0xb01ee322c4f028b8a6bfcd2a5d48107dc5bc99ec',
    },
    commitmentMapper: {
      owner: '0xb01ee322c4f028b8a6bfcd2a5d48107dc5bc99ec',
      EdDSAPubKeyX: COMMITMENT_MAPPER_TESTER[0],
      EdDSAPubKeyY: COMMITMENT_MAPPER_TESTER[1],
    },
  },
};
