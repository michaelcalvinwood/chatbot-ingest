const fs = require("fs");
const fsPromise = require('fs').promises;
const pdfExtraction = require("pdf-extraction");

const deleteFile = fileName => {
    return fs.unlink(fileName, (err) => {
        if (err) {
            throw err;
        }
        console.log("Delete File successfully.");
    });
}

exports.extractPdf = (fileName, del = false) => {
    return new Promise(async (resolve, reject) => {
        let data;

        try {
            const dataBuffer = await fsPromise.readFile(fileName);
            data = await pdfExtraction(dataBuffer);
        } catch (err) {
            console.error(err);
            if (del) deleteFile(fileName)
            reject(err);
        }
        
        console.log(data);
        if (del) deleteFile(fileName);
        return resolve(data.text);
    })
}
