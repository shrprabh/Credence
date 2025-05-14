import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata'

//RPC endpoint         TODO: replace with mainnet when done testing 
const umi = createUmi('https://api.devnet.solana.com').use(mplTokenMetadata()) //Testing on devnet