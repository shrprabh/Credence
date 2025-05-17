import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { generateSigner, percentAmount, publicKey, transactionBuilder, createSignerFromKeypair, PublicKey, GenericFileTag, createGenericFile, signerIdentity, createNoopSigner, signTransaction, GenericFile } from '@metaplex-foundation/umi'
import { mplTokenMetadata, mintV1, TokenStandard, createV1 } from '@metaplex-foundation/mpl-token-metadata'
import { base64 } from '@metaplex-foundation/umi/serializers'
import { createAssociatedToken } from '@metaplex-foundation/mpl-toolbox'
import { readFileSync } from 'fs';
import path from 'path';
import { string } from '@metaplex-foundation/umi/serializers';
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys'


export function initializeUmi(genericFileImage: GenericFile){
    //initializing umi
    const umi = createUmi('https://api.devnet.solana.com') //TODO: replace with mainnet before launch
    .use(mplTokenMetadata()); //uploader for Token metadata

    
    //Retrieving Backend Authority
    const backendAuthKeypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(JSON.parse(readFileSync(path.join(process.cwd(), 'backend-authority.json'), 'utf-8'))));
    const backendAuthority = createSignerFromKeypair(umi, backendAuthKeypair);

    //set backend authority as umi signer and hookup uploader
    umi.use(signerIdentity(backendAuthority));
    umi.use(irysUploader({ payer: backendAuthority })) // we foot this bill

    console.log("Uploader exists:", 'upload' in umi.uploader);
    console.log("File size:", genericFileImage.buffer.byteLength);

    return{umi, backendAuthority};
}