require ('dotenv').config();
const axios = require('axios');
const { Configuration, OpenAIApi } = require("openai");
const { v4: uuidv4 } = require('uuid');

exports.createCollection = async (host, port, collectionName, size, onDiskPayload = false, distance = 'Cosine') => {
    const request = {
        url: `http://${host}:${port}/collections/${collectionName}`,
        method: 'put',
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            "Access-Control-Allow-Origin": "*",
        },
        data: {
            vectors: {
                size,
                distance
            }
        }
    }

    //console.log('onDiskPayload', onDiskPayload);

    if (onDiskPayload) request.data.on_disk_payload = true;
        
    return promisfiedAxios(request);   
}

exports.createOpenAICollection = async (botId, vectorHost, vectorPort, diskBased = false) => {
    return this.createCollection(vectorHost, vectorPort, botId, 1536, diskBased);
}