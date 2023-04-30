require('dotenv').config();
const { SERVER_SERIES } = process.env;
const serverSeries = Number(SERVER_SERIES);

const listenPort = 6201;
const privateKeyPath = `/home/sslkeys/instantchatbot.net.key`;
const fullchainPath = `/home/sslkeys/instantchatbot.net.pem`;

const express = require('express');
const https = require('https');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const formidable = require('formidable');
const jwt = require('./utils/jwt');
const s3 = require('./utils/s3');
const pdf = require('./utils/pdf');

const app = express();
app.use(express.static('public'));
app.use(express.json({limit: '500mb'})); 
app.use(cors());

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

const ingestPdf = async (fileName, origName, token) => {
    console.log('ingest', fileName, origName);

    let data;

    try {
        data = await pdf.extractPdf(fileName, true);
    } catch(err) {
        console.error(err);
        return false;
    }

    data = datareplaceAll("-\n", "").replaceAll("\n", "");

    // generate a document id

    // add document to bot document list

    // split data into chunks

    // foreach chunk
        // add to chunks-1.instant...
        // add to qdrant-1.instant...

    

    return true;
}

const handleSuppliedToken = (bt, res) => {
    console.log('bt', bt);
    const tokenInfo = jwt.extractToken(bt, true);
    if (!tokenInfo.status) {
        res.status(401).json('unauthorized');
        resolve('error 401 unauthorized');
        return false;
    }

    const token = tokenInfo.msg;

    console.log('token', token);

    if (token.serverSeries !== serverSeries) {
        res.status(400).json('bad request');
        resolve('error 400 bad request');
        return false;
    }

    return token
}

const fileUpload = (req, res) => {
    return new Promise(async (resolve, reject) => {
        const { bt } = req.query;
        const token = handleSuppliedToken(bt, res);
        if (!token) return resolve('error bad token');
        
        var form = new formidable.IncomingForm();
        form.parse(req, async function (err, fields, data) {
            //console.log('form data', data);
            if (err) {
                console.error(err);
                res.status(500).json('form error');
                resolve('form error');
                return;
            }
            const fileName = data['File[]'].filepath;
            const origName = data['File[]'].originalFilename;
            // let input = fs.readFileSync(fileName, "utf-8");
            // if (!input) {
            //     res.status(400).json('no input')
            //     resolve('error 401');
            //     return;
            // }
            /*
             * Process input here
             */
            
            await ingestPdf(fileName, origName);
            // remove file
            fs.unlinkSync(fileName);

            res.status(200).json('ok');
            resolve('ok')
            return;
        });
    })
}

const presignedUrl = (req, res) => {
    return new Promise(async (resolve, reject) => {
        const { bt } = req.query;
        const token = handleSuppliedToken(bt, res);
        if (!token) {
            res.status(400).json('bad request');
            return resolve('error bad token');
        }
        const { fileName } = req.body;
        if (!fileName) {
            res.status(400).json('bad request');
            return resolve('error bad request');
        }

        let url;
        const {S3_ENDPOINT, S3_ENDPOINT_DOMAIN, S3_REGION, S3_KEY, S3_SECRET, S3_BUCKET} = process.env;
        console.log('s3', s3);

        const s3Client = s3.client(S3_ENDPOINT, S3_ENDPOINT_DOMAIN, S3_REGION, S3_KEY, S3_SECRET, S3_BUCKET);
        url = await s3.presignedUploadUrl(s3Client, token.botId + '/' + fileName);
        
        res.status(200).json(url);
        resolve('ok');
    })
}

const ingestS3Pdf = (req, res) => {
    return new Promise(async (resolve, reject) => {
        const { bt } = req.query;
        const token = handleSuppliedToken(bt, res);
        if (!token) {
            res.status(400).json('bad request');
            return resolve('error bad token');
        }
        
        const { url } = req.body;
        if (!url) {
            res.status(400).json('bad request');
            return resolve('error bad token');
        }

        const urlInfo = new URL(url);
        console.log('urlInfo', urlInfo);
        const fullFileName = path.basename(urlInfo.pathname);
        const loc = fullFileName.indexOf('--');
        const origFileName = fullFileName.substring(loc+2);
        /*
         * TODO: validate that url folder matches token.botId
         */

         /*
         * TODO Prefetch filesize and see if the account has sufficient tokens
         * if so, decrement tokens and process
         * else 
         *      send email alerting to the issue
         *      delete the resource from S3 bucket
         *      send error message
         */

        const fileName = `/home/tmp/${uuidv4()}.pdf`;
        let result;

        try {
            result = await s3.download(url, fileName);
        } catch (err) {
            console.error(err);
            res.status(500).json('could not access uploaded file');
            return resolve('error 500: could not access uploaded file');
        }

        result = await ingestPdf(fileName, origFileName, token);

        if (!result) {
            res.status(500).json('could not process pdf');
            return resolve('error 500: could not process pdf');
        }

        res.status(200).json('ok');
        resolve('ok');
    })
}

app.post('/fileUpload', (req, res) => fileUpload(req, res));
app.post('/presignedUrl', (req, res) => presignedUrl(req, res));
app.post('/ingestS3Pdf', (req, res) => ingestS3Pdf(req, res));

const httpsServer = https.createServer({
    key: fs.readFileSync(privateKeyPath),
    cert: fs.readFileSync(fullchainPath),
  }, app);
  

  httpsServer.listen(listenPort, '0.0.0.0', () => {
    console.log(`HTTPS Server running on port ${listenPort}`);
});
