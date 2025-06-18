import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { generateSigner, keypairIdentity } from '@metaplex-foundation/umi';
import { writeFileSync } from 'fs';

// Create a UMI instance (update endpoint if needed)
const umi = createUmi('https://api.devnet.solana.com');

// Generate keypair
const authority = generateSigner(umi);

// Save the secret key for reuse
writeFileSync('backend-authority.json', JSON.stringify([...authority.secretKey]));