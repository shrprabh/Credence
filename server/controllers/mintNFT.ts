import path from 'path';
import { readFileSync } from 'fs';
import { 
    createGenericFile,
 } from '@metaplex-foundation/umi';
import { initializeUmi } from '../services/metaplexService';

//import image and convert to generic file for uri
console.log("Reading image from:", path.join(process.cwd(), 'assets', 'certImage.png'));
const imageData = readFileSync(path.join(process.cwd(), 'assets', 'certImage.png'));

console.log("Buffer Length:", imageData.length);
const genericFileImage = createGenericFile(imageData, "certImage.png", { contentType: "image/png" });

const umi = initializeUmi(genericFileImage);

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