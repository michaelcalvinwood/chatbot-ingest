const winkNLP = require( 'wink-nlp' );
const its = require( 'wink-nlp/src/its.js' );
const model = require( 'wink-eng-lite-web-model' );
const nlp = winkNLP( model );

exports.getChunks  = (text, chunkSize = 700, overlapPercent = .33) => { 
    const doc = nlp.readDoc( text );
    const sentences = doc.sentences().out();
    let index = 0;
    let next = 0;

    let curLength = 0;
    let curChunk = [];
    const chunks = [];
    while (next < sentences.length) {
        curLength += sentences[next].length;
        if (curLength > chunkSize) {
            chunks.push(curChunk.join(' '));
            curChunk = [];
            let desiredIndex = next - Math.trunc((next - index + 1) * overlapPercent);
            index = desiredIndex > index ? desiredIndex : index + 1;
            next = index;
            curLength = 0;
            continue;
        }
        curChunk.push(sentences[next++]);
    }
    
    return chunks;
 }; 