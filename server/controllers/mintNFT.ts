import path from 'path';
import { readFileSync } from 'fs';
import { 
    createGenericFile,
 } from '@metaplex-foundation/umi';


//import image and convert to generic file for uri
console.log("Reading image from:", path.join(process.cwd(), 'assets', 'certImage.png'));
const imageData = readFileSync(path.join(process.cwd(), 'assets', 'certImage.png'));
const genericFileImage = createGenericFile(imageData, "certImage.png", { contentType: "image/png" });