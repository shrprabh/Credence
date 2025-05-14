import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata'

//RPC endpoint         TODO: replace with mainnet when done testing 
const umi = createUmi('http://127.0.0.1:8899').use(mplTokenMetadata()) //Testing on localnet