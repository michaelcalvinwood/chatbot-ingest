const { Configuration, OpenAIApi } = require("openai");

exports.getEmbedding = async (openAiKey, input) => {
    const configuration = new Configuration({
        apiKey: openAiKey,
      });
      const openai = new OpenAIApi(configuration);
      let embeddingResponse;
      try {
        embeddingResponse = await openai.createEmbedding({
            model: 'text-embedding-ada-002',
            input,
          })    
      } catch (err) {
        console.error('Axios err', err.response && err.response.data ? err.response.data : err);
        return false;
      }
      
      return embeddingResponse.data.data[0].embedding;
}
