const listenPort = 6201;
const hostname = 'ingest-1.instantchatbot.net'
const privateKeyPath = `/home/sslkeys/instantchatbot.net.key`;
const fullchainPath = `/home/sslkeys/instantchatbot.net.pem`;

const express = require('express');
const https = require('https');
const cors = require('cors');
const fs = require('fs');

const formidable = require('formidable');

const app = express();
app.use(express.static('public'));
app.use(express.json({limit: '500mb'})); 
app.use(cors());

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

const ingestPdf = async (fileName) => {
    console.log('ingest', fileName);

    return;
}

const fileUpload = (req, res) => {
    return new Promise(async (resolve, reject) => {
        var form = new formidable.IncomingForm();
        form.parse(req, async function (err, fields, data) {
            console.log('form data', data);
            if (err) {
                console.error(err);
                res.status(500).json('form error');
                resolve('form error');
                return;
            }
            const fileName = data['File[]'].filepath;
            
            // let input = fs.readFileSync(fileName, "utf-8");
            // if (!input) {
            //     res.status(400).json('no input')
            //     resolve('error 401');
            //     return;
            // }
            /*
             * Process input here
             */
            
            await ingestPdf(fileName);
            // remove file
            fs.unlinkSync(fileName);

            res.status(200).json('ok');
            resolve('ok')
            return;
        });
    })
}

app.post('/fileUpload', (req, res) => fileUpload(req, res));

const httpsServer = https.createServer({
    key: fs.readFileSync(privateKeyPath),
    cert: fs.readFileSync(fullchainPath),
  }, app);
  

  httpsServer.listen(listenPort, '0.0.0.0', () => {
    console.log(`HTTPS Server running on port ${listenPort}`);
});
