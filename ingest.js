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
const luxon = require('luxon');
const axios = require('axios');

const formidable = require('formidable');
const jwt = require('./utils/jwt');
const s3 = require('./utils/s3');
const pdf = require('./utils/pdfjs-dist');
const mysql = require('./utils/mysql');
const nlp = require('./utils/nlp');
const qdrant = require('./utils/qdrant');
const openai = require('./utils/openai');

const app = express();
app.use(express.static('public'));
app.use(express.json({limit: '500mb'})); 
app.use(cors());

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

const {S3_ENDPOINT, S3_ENDPOINT_DOMAIN, S3_REGION, S3_KEY, S3_SECRET, S3_BUCKET} = process.env;
const s3Client = s3.client(S3_ENDPOINT, S3_ENDPOINT_DOMAIN, S3_REGION, S3_KEY, S3_SECRET, S3_BUCKET);

// const test = async () => {
//     const size = await s3.fileSize(s3Client, decodeURIComponent(`5e3af7f2-15e3-40c6-9e0d-a6eb04a3b31a/443ba5ba-6c47-4574-8183-0b4b9c4aaade--Personal%20Summary%20Questionnaire%20-%20Ranger%20Technical%20Resources%20-%20PDF.pdf`));
//     console.log('size', size);
// }

// test();

const chunksHost = `chunks-${SERVER_SERIES}.instantchatbot.net`;
const qdrantHost = `qdrant-${SERVER_SERIES}.instantchatbot.net`;
const appHost = `app-${SERVER_SERIES}.instantchatbot.net`;

const { CHUNKS_MYSQL_PASSWORD} = process.env;
const chunksDb = mysql.connect(chunksHost, 'chunks', CHUNKS_MYSQL_PASSWORD, 'chunks');

const addContent = async (contentId, botId, contentName, contentType, s3URL, size, description = '', meta = '', date = '9999-12-31 23:59:59', ts = 99999999999) => {
    const q = `INSERT INTO content (content_id, bot_id, name, type, url, size, context, meta, date, ts) VALUES 
    ('${contentId}', '${botId}', '${contentName}', '${contentType}', '${s3URL}', ${size}, ${mysql.escape(description)},'${meta}', '${date}', ${ts})`;

    return mysql.query(chunksDb, q);
}

async function testDatabaseConnections() {
    let result;
    try {
        result = await mysql.query(chunksDb, "SHOW DATABASES");
    } catch (err) {
    
    }

    try {
        //result = await qdrant.createCollection(qdrantHost, 6333, 'test', 24);
        //result = await qdrant.collectionInfo(qdrantHost, 6333, 'test');
        //console.log(result);
    } catch(err) {
        console.error('qdrant', err.response.data);
    }
}

testDatabaseConnections();

const insertChunkIntoDb = async (chunkId, contentId, text, embedding, meta = '') => {
    const q = `INSERT INTO chunk (chunk_id, content_id, text, vector, meta) VALUES
    ('${chunkId}', '${contentId}', ${mysql.escape(text)}, ${mysql.escape(JSON.stringify(embedding))}, ${mysql.escape(meta)})`;

    return mysql.query(chunksDb, q);
} 

const storeDocumentInVectorDatabase = async (documentId, data, botId, aiKey, meta = '') => {
    try {
        const chunks = nlp.getChunks(data);
        console.log('chunks', chunks);
       
        for (let i = 0; i < chunks.length; ++i) {
            const embedding = await openai.getEmbedding(aiKey, chunks[i]);
            const chunkId = uuidv4();
            await insertChunkIntoDb(chunkId, documentId, chunks[i], embedding, meta);
            try {
                await qdrant.addOpenAIPoint(qdrantHost, 6333, aiKey, botId, chunkId, chunks[i]);
            } catch (err) {
                if (err.response && err.response.data) console.error(err.response.data);
                else console.error(err);
                break;
            }
        }
        const result = await qdrant.collectionInfo(qdrantHost, 6333, botId);
        console.log('qdrant info', result);
    } catch (err) {
        console.error(err);
        return false;
    }
}




const ingestPdf = async (fileName, origName, token, size, url, description, meta = false, ts = false) => {
   const { botId, openAIKeys } = token;
    const documentId = uuidv4();
    await addContent(documentId, botId, origName, 'PDF', url, size, description);

    console.log('ingest', fileName, origName, token.openAIKeys);
   
    let result = await qdrant.collectionInfo(qdrantHost, 6333, token.botId);

    console.log(result);

    let data;

    try {
        data = await pdf.extractPdf(fileName, true);
        data = data.replaceAll("-\n", "").replaceAll("\n", "");
        
        await storeDocumentInVectorDatabase(documentId, data, token.botId, token.openAIKeys[0]);
       
    } catch(err) {
        console.error(err);
        return false;
    }

    return true;
}

const handleSuppliedToken = (bt, res) => {
    console.log('bt', bt);
    const tokenInfo = jwt.extractToken(bt, true);
    if (!tokenInfo.status) {
        res.status(401).json('unauthorized');
        //resolve('error 401 unauthorized');
        return false;
    }

    const token = tokenInfo.msg;

    console.log('token', token);

    if (token.serverSeries !== serverSeries) {
        res.status(400).json('bad request');
        //resolve('error 400 bad request');
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

const presignedUrl = async (req, res) => {
        const { bt } = req.query;
        const token = handleSuppliedToken(bt, res);
        if (!token) return res.status(400).json('bad request');
            
        console.log('presignedUrl token', token);
        const { fileName } = req.body;
        if (!fileName) return res.status(400).json('bad request');
           
        let url;
        url = await s3.presignedUploadUrl(s3Client, token.botId + '/' + fileName);
        
        return res.status(200).json(url);
}

const ingestS3Pdf = async (req, res) => {
        const { bt } = req.query;
        const token = handleSuppliedToken(bt, res);
        if (!token) return res.status(400).json('bad token request');
  
        const { url, description } = req.body;
        if (!url || typeof description === 'undefined') return res.status(400).json('bad input request');
            
        const urlInfo = new URL(url);
        console.log('urlInfo', urlInfo);

        if (urlInfo.host !== 'instantchatbot.nyc3.digitaloceanspaces.com') return res.status(401).json('unauthorized');
        
        const fullFileName = path.basename(urlInfo.pathname);
        const loc = fullFileName.indexOf('--');
        const origFileName = fullFileName.substring(loc+2);
        /*
         * TODO: validate that url folder matches token.botId
         */

        const size = await s3.fileSize(s3Client, decodeURIComponent(urlInfo.pathname));

        let request = {
            url: `https://app-${SERVER_SERIES}.instantchatbot.net:6250/addStorage`,
            method: 'post',
            data: {
                size,
                botToken: bt
            }
        }

        let result;

        try {
            result = await axios(request);
        } catch (err) {
            console.error(err);
            if (err.response && err.response.status && err.response.status === 402) return res.status(402).json(err.response.data);
            return res.status(err.response && err.response.status ? err.response.status : 501).json('Unable to add file size at this time. Please try again later.')
        }

        const fileName = `/home/tmp/${uuidv4()}.pdf`;
        
        try {
            result = await s3.download(url, fileName);
        } catch (err) {
            console.error(err);
            res.status(500).json('could not access uploaded file');
            return resolve('error 500: could not access uploaded file');
        }

        ingestPdf(fileName, origFileName, token, size, url, description);

        return res.status(200).json('ok');
        
}

const ingestText = async (req, res) => {
    const { botToken, description, text } = req.body;

    if (!botToken || typeof description === 'undefined' || !text || !text.length) return res.status(400).json('bad command 1');

    const token = jwt.getToken(botToken);

    const {userId, userName, serverSeries, botId, domains, openAIKeys } = token;

    let size = 0;
    for (let i = 0; i < text.length; ++i) size += text[i].text.length;

    console.log('TOTAL STORAGE', size);
    return res.status(200).send('ok');


    for (let i = 0; i < text.length; ++i) {
        const documentId = uuidv4();
        try {
            console.log('storing', documentId, text[i].name);
            await addContent(documentId, botId, text[i].name, text[i].type, text[i].url ? text[i].url : "", text[i].text.length, text[i].description ? text[i].description : '');
            let result = await qdrant.collectionInfo(qdrantHost, 6333, botId);
            console.log('qdrant result', result);
            await storeDocumentInVectorDatabase(documentId, text[i].text, botId, openAIKeys[0]);
        } catch (err) {
            console.error('Could not store', documentId, text[i].name);
            console.error(err);
            return res.status(500).json('internal server error');
        }
    }

    res.status(200).send('ok');
}

app.post('/ingestText', (req, res) => ingestText(req, res));
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
