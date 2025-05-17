import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { generateSigner, percentAmount, publicKey, transactionBuilder, createSignerFromKeypair, PublicKey, GenericFileTag, createGenericFile, signerIdentity, createNoopSigner, signTransaction } from '@metaplex-foundation/umi'
import { mplTokenMetadata, mintV1, TokenStandard, createV1 } from '@metaplex-foundation/mpl-token-metadata'
import { base64 } from '@metaplex-foundation/umi/serializers'
import { createAssociatedToken } from '@metaplex-foundation/mpl-toolbox'
import { readFileSync } from 'fs';
import path from 'path';
import { string } from '@metaplex-foundation/umi/serializers';
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys'



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
console.log("Buffer Length:", imageData.length);

//DEBUG: mintToken("database champion", "I dont feel like writing a description lol", "ultra mega super legend", "address", "Shreyas");
//DEBUG: mintToken("TEST SKILLNAME", "Resume writing is the skill of crafting a compelling document showcasing your skills and experience to prospective employers.  It's crucial for securing interviews and landing jobs, as a strong resume acts as your initial marketing tool.  Effective resume writing goes beyond template copying; it involves tailoring content—including education, experience, and skills—to highlight your unique qualifications for specific roles.  Key components include impactful phrasing, strategic section ordering, and a focus on the employer's needs (the customer).  Even without extensive experience, strong resume writing can effectively present your value.'", "TEST TITLE", "3iHAa36HwSsZDTEK4MkwD7ckVAAj7ooTqbRfbKf9f4VS", "TESTNAME");

//upload metadata
async function uploadJsonData(
    tokenName: string,
    skillDescription: string
){
    try{
        //console.log("Uploader exists:", umi.uploader);
        const [imageUri] = await umi.uploader.upload([genericFileImage])
        console.log("Image URI:", imageUri);
        const uri = await umi.uploader.uploadJson({
            name: tokenName,
            description: skillDescription,
            image: imageUri
        })
        console.log("Metadata uploaded to:", uri);
        return uri;
    }
    catch(error){
        console.error("Metadata failed to upload:", error);
        return "uri failed";
    }
}
