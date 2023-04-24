import { AttesterDataMigration__factory } from "../types/factories/AttesterDataMigration__factory";
import { gql, GraphQLClient } from "graphql-request";
import hre, { ethers } from 'hardhat';

const args = process.argv.slice(2);
const network = hre.network.name || 'goerli'; // Default to 'goerli' if no network argument is provided
console.log(`Network: ${network}`);

const config = {
    goerli: {
        rpcUrl: process.env.GOERLI_RPC_URL,
        subgraphUrl: "https://api.thegraph.com/subgraphs/name/sahilvasava/pot_attester",
        migrationContractAddress: "0x42c4eD81eF8cB904224C0e2265d5e214628E7c38",
        signatureAttesterAddressOld: "0xeE9Cc5630F1d1d17d2EA232ca12ff52c4a099920",
        skillAttesterAddressOld: "0xD94fF43dF23540e9e06F56F36e7fe54565aEB483",
        signatureAttesterAddressNew: "0x1e78DFa7AF3a968e8cBeA836888544B2b4afF871",
        skillAttesterAddressNew: "0x65059e157a5948E7B5Aad38Da4eE63A8dB40fc34",
    },
    polygon: {
        rpcUrl: process.env.POLYGON_RPC_URL,
        subgraphUrl: "https://api.thegraph.com/subgraphs/name/sahilvasava/pot-attester",
        migrationContractAddress: "0xf125D0cb945EF0E7F171062351C71ba9D90A865F",
        signatureAttesterAddressOld: "0x8f4c102875AFb6152004f8e87cF1cBF90431Df54",
        skillAttesterAddressOld: "0xAD6176Fe096Af5A20A333E841c58fD593A8D3A9f",
        signatureAttesterAddressNew: "0x40b4b0464512203f3755ddD9865ddE7dBfA1f6C3",
        skillAttesterAddressNew: "0xE9E455aB82b441b492f5eA96d1F99DBD29229F9F",
    },
};

const provider = new ethers.providers.JsonRpcProvider(config[network].rpcUrl);
const client = new GraphQLClient(config[network].subgraphUrl);



async function fetchTotalItems(attesterAddress: string) {
    const query = gql`
    query FetchTotalItems($attester: String!) {
      attester(id: $attester) {
        id
        totalItems
      }
    }
  `;

    const variables = { attester: attesterAddress.toLocaleLowerCase() };

    const response: { attester: { id: string; totalItems: string } } = await client.request(query, variables);
    console.log(response);
    return parseInt(response.attester.totalItems);
}

async function fetchAttesterData(attesterAddress: string, lastID: string, batchSize: number) {
    const query = gql`
    query FetchAttesterData($attester: String!, $lastID: String!, $batchSize: Int!) {
    sourceToDestinations(where: { attester: $attester, id_gt: $lastID }, first: $batchSize) {
        id
        attestationId
        source
        destination
        attester {
            id
        }
      }
    }
  `;

    const variables = { attester: attesterAddress.toLowerCase(), lastID, batchSize };

    const response: { sourceToDestinations: { id: string; attestationId: string; source: string; destination: string; attester: { id: string; } }[] } = await client.request(query, variables);
    const data = response.sourceToDestinations;

    const ids: string[] = data.map((item: any) => item.id);
    const attestationIds: number[] = data.map((item: any) => parseInt(item.attestationId));
    const sources: string[] = data.map((item: any) => item.source);

    return { ids, attestationIds, sources };
}

async function migrateAttesterData(attesterAddressOld: string, attesterAddressNew: string) {
    const [signer] = await hre.ethers.getSigners();
    const migrationContract = AttesterDataMigration__factory.connect(config[network].migrationContractAddress, signer);
    const totalItems = await fetchTotalItems(attesterAddressOld);
    const gasPrice = await provider.getGasPrice();

    const maxGasPerBatch = ethers.utils.parseUnits("200", "gwei");
    let batchSize = Math.floor((maxGasPerBatch.toNumber() / gasPrice.toNumber()) * totalItems);
    console.log(`Batch size: ${batchSize}`);

    let lastID = "";
    let results;
    let itemsProcessed = 0;

    while (itemsProcessed < totalItems) {
        let itemsFetched = 0;
        const allAttestationIds: number[] = [];
        const allSources: string[] = [];

        while (itemsFetched < batchSize && itemsProcessed < totalItems) {
            const fetchSize = Math.min(batchSize - itemsFetched, 1000);

            results = await fetchAttesterData(attesterAddressOld, lastID, fetchSize);
            // console.log(results);

            if (results.attestationIds.length === 0) {
                break; // No new items fetched, break out of the inner loop
            }

            allAttestationIds.push(...results.attestationIds);
            allSources.push(...results.sources);

            const newItemsFetched = results.attestationIds.length;
            itemsFetched += newItemsFetched;
            itemsProcessed += newItemsFetched;
            
            lastID = results.ids[newItemsFetched - 1].toString();
        }
        console.log(`Migrating ${allAttestationIds.length} items`);
        console.log(`Owner: ${await migrationContract.owner()}`)
        console.log(`Signer: ${await signer.address}`)
        console.log(`Gas estimate: ${await migrationContract.estimateGas.migrateData(attesterAddressOld, attesterAddressNew, allAttestationIds, allSources)}`);
        // console.log(results.attestationIds.length, batchSize, allAttestationIds.length, allSources.length)


        if (allAttestationIds.length > 0) {
            await migrationContract.migrateData(attesterAddressOld, attesterAddressNew, allAttestationIds, allSources);
        }

    }
}


async function main() {
    console.log("Migrating data from SignatureAttester to SignatureAttesterV2");
    await migrateAttesterData(config[network].signatureAttesterAddressOld, config[network].signatureAttesterAddressNew);
    console.log("Migrating data from SkillAttester to SkillAttesterV2");
    await migrateAttesterData(config[network].skillAttesterAddressOld, config[network].skillAttesterAddressNew);
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });