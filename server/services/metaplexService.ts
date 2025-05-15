import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { generateSigner, PublicKey } from '@metaplex-foundation/umi'
import { mplTokenMetadata, mintV1, TokenStandard, createV1 } from '@metaplex-foundation/mpl-token-metadata'
import { nftStorageUploader } from '@metaplex-foundation/umi-uploader-nft-storage'
import * as certificateImage from './assets/certificateImage.png'

//RPC endpoint         //TODO: replace with mainnet before launch
const umi = createUmi('https://api.devnet.solana.com') //Testing on devnet
.use(mplTokenMetadata())
.use(nftStorageUploader()) //uploader for Token metadata


//Backend Authority Account
//const backendAuthority = ... NOTE: we may not want to push this code if this is here

//upload metadata
async function uploadJsonData(skillName: string, skillDescription: string){
    const [imageUri] = await umi.uploader.upload([certificateImage])
    const uri = await umi.uploader.uploadJson({
        name: skillName,
        description: skillDescription,
        image: imageUri
    })
    return uri;
}

export async function mintToken(skillName: string, skillDescription: string){
    
}
/*TODO: mint function for token "cert"
    | ask app backend for skillName and token mintAccount address
    | call JSON data function with parameters (skillName, description?)
    | if(!mintAccount){
    |   | const mintAccount = generateSigner(umi)
    |   | await createV1(umi, {
    |   |   | mint: mintAcount,
    |   |   | authority: backendAuthority,
    |   |   | name: skillName,
    |   |   | uri,
    |   |   | tokenStandard: TokenStandard.FungibleAsset,
    |   |   | decimals: 0,
    |   |   | freezeAuthority: backendAuthority,
    |   | }).sendAndConfirm(umi)
    |   | send mintAccount to app backend use mintAccount.publicKey.toBase58()
    | }
    | else
    |   | mintAccount = publicKey(mintAccount)
    | await mintV1(umi, {
    |   | mint: mintAccount,
    |   | authority: backendAuthority,
    |   | amount: 1,
    |   | tokenOwner: TODO: insert users address
    |   | tokenStandard: TokenStandard.FungibleAsset,
    |   }).sendAndConfirm(umi)
*/