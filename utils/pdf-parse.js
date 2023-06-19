const fs = require("fs");
const fsPromise = require('fs').promises;
const pdf = require('pdf-parse');
const LanguageDetect = require('languagedetect');


const deleteFile = fileName => {
    return fs.unlink(fileName, (err) => {
        if (err) {
            throw err;
        }
        console.log("Delete File successfully.");
    });
}

exports.extractPdf = async (fileName, del = false) => {
  try {
    let dataBuffer = await fsPromise.readFile(fileName);
    let result = await pdf(dataBuffer);
    let text = result.text.replaceAll("\n-", "");
    text = text.split("\n");
    text = text.map(line => {
        if (line) return line.replaceAll("\n", "")
        else return ("\n");
    })
    text = text.join("");
    
    const lngDetector = new LanguageDetect();
    const languages = lngDetector.detect(text.substring(0, 10000));

    const language = languages[0][0];
    const confidence = languages[0][1] * 100;

    if (language === 'english' && confidence >= 30) return text;
    
  } catch (err) {
    console.error('pdf-parse extractPdf error', err);
  }

  return false;
    
}

test();