import path from 'path';
import { readFileSync } from 'fs';
import { 
    createGenericFile,
    generateSigner,
    GenericFile,
    percentAmount,
    publicKey,
    PublicKey,
    Umi,
 } from '@metaplex-foundation/umi';
import { initializeUmi } from '../services/metaplexService';
import { createV1, mintV1, TokenStandard } from '@metaplex-foundation/mpl-token-metadata';
import { createAssociatedToken } from '@metaplex-foundation/mpl-toolbox'


//upload metadata
async function uploadJsonData(
    umi: Umi,
    genericFileImage: GenericFile,
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
    //import image and convert to generic file for uri
    console.log("Reading image from:", path.join(process.cwd(), 'assets', 'certImage.png'));
    const imageData = readFileSync(path.join(process.cwd(), 'assets', 'certImage.png'));

    console.log("Buffer Length:", imageData.length);
    const genericFileImage = createGenericFile(imageData, "certImage.png", { contentType: "image/png" });

    const {umi, backendAuthority} = initializeUmi(genericFileImage);
    //const noopSigner = createNoopSigner(publicKey(userPublicKey))
    //const builder = transactionBuilder()
    let mintAccountPubKey: PublicKey;

    //if no mint account provided, make one
    if(!inputMintAccount){
        const tokenName = `${skillLevel} in ${skillName}`;
        const tokenDescription = `Credence is proud to certify ${userName} in ${skillName}; ${skillDescription}`
        const mintAccountSigner = generateSigner(umi);
        mintAccountPubKey = mintAccountSigner.publicKey;
        const uri = await uploadJsonData(umi, genericFileImage, tokenName, tokenDescription);
        if(uri === "uri failed")
            console.log("TODO: throw an error or something here");
        
        try{
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
        catch(err){
            console.log("create failed", err);
        }
    }
    else{
       mintAccountPubKey = publicKey(inputMintAccount);
    }
    
    try{
        await createAssociatedToken(umi, {
            mint: mintAccountPubKey, 
            owner: publicKey(userPublicKey), 
            payer: backendAuthority, //noopsigner,
        }).sendAndConfirm(umi)
    }
    catch(err){
        console.log("ata failed", err);
    }
    try{
        await mintV1(umi, {
            mint: mintAccountPubKey,
            authority: backendAuthority,
            amount: 1,
            tokenOwner: publicKey(userPublicKey),
            tokenStandard: TokenStandard.FungibleAsset,
            payer: backendAuthority//noopSigner,
        }).sendAndConfirm(umi)
    }
    catch(err){
        console.log("mint failed", err);
    }
}