const fs = require("fs");
const fsPromise = require('fs').promises;
const pdfjsLib = require("pdfjs-dist");

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
      try {
        let doc = await pdfjsLib.getDocument(fileName).promise;
        let page1 = await doc.getPage(1);
        let content = await page1.getTextContent();
        let strings = content.items.map(function(item) {
            return item.str;
        });
        console.log('pdfjs-dist extractPdf strings', strings);
        return resolve(strings);
      } catch (err) {
        console.error('pdfjs-dist.js extractPdf error: ', err)
        return reject(err);
      }
    })
}
