import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { generateSigner, percentAmount, publicKey, transactionBuilder, createSignerFromKeypair, PublicKey, GenericFileTag, createGenericFile, signerIdentity, createNoopSigner, signTransaction } from '@metaplex-foundation/umi'
import { mplTokenMetadata, mintV1, TokenStandard, createV1 } from '@metaplex-foundation/mpl-token-metadata'
import { base64 } from '@metaplex-foundation/umi/serializers'
import { createAssociatedToken } from '@metaplex-foundation/mpl-toolbox'
import { readFileSync } from 'fs';
import path from 'path';
import { string } from '@metaplex-foundation/umi/serializers';
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys'

//import image and convert to generic file for uri
console.log("Reading image from:", path.join(process.cwd(), 'assets', 'certImage.png'));
const imageData = readFileSync(path.join(process.cwd(), 'assets', 'certImage.png'));
const genericFileImage = createGenericFile(imageData, "certImage.png", { contentType: "image/png" });

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


//create mint address if needed and mint certificates
export async function mintToken(
    skillName: string, 
    skillDescription: string, 
    skillLevel: string,
    userPublicKey: string,
    userName: string,
    inputMintAccount?: string,
){
    const noopSigner = createNoopSigner(publicKey(userPublicKey))
    //const builder = transactionBuilder()
    let mintAccountPubKey: PublicKey;

    //if no mint account provided, make one
    if(!inputMintAccount){
        const tokenName = `${skillLevel} in ${skillName}`;
        const tokenDescription = `Credence is proud to certify ${userName} in ${skillName}; ${skillDescription}`
        const mintAccountSigner = generateSigner(umi);
        mintAccountPubKey = mintAccountSigner.publicKey;
        const uri = await uploadJsonData(tokenName, skillDescription);
        if(uri === "uri failed")
            console.log("TODO: throw an error or something here");
        
        
        await createV1(umi, {
            mint: mintAccountSigner,
            authority: backendAuthority,
            name: tokenName,
            uri,
            tokenStandard: TokenStandard.FungibleAsset,
            decimals: 0,
            sellerFeeBasisPoints: percentAmount(0),
            payer: backendAuthority//noopSigner
            //freezeAuthority: backendAuthority,
        }).sendAndConfirm(umi)
    }
    else{
       mintAccountPubKey = publicKey(inputMintAccount);
    }
    
    await createAssociatedToken(umi, {
        mint: mintAccountPubKey, 
        owner: publicKey(userPublicKey), 
        payer: backendAuthority, //noopsigner,
    }).sendAndConfirm(umi)

    await mintV1(umi, {
        mint: mintAccountPubKey,
        authority: backendAuthority,
        amount: 1,
        tokenOwner: publicKey(userPublicKey),
        tokenStandard: TokenStandard.FungibleAsset,
        payer: backendAuthority//noopSigner,
    }).sendAndConfirm(umi)
}

/*DONE BUT HERE FOR REFERENCE: mint function for token "cert"
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
