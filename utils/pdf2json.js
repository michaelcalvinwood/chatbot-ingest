const fs = require("fs");
const fsPromise = require('fs').promises;
const pdfExtraction = require("pdf2json");

const deleteFile = fileName => {
    return fs.unlink(fileName, (err) => {
        if (err) {
            throw err;
        }
        console.log("Delete File successfully.");
    });
}

console.log(pdfExtraction);