const mysql = require('mysql2');
const mysqlPromise = require('mysql2/promise');

exports.connect = (host, user, password, database, limit = 3) => {
    return mysql.createPool({
      connectionLimit : limit, //important
      host, user, password, database,
      debug: false
    });
}

exports.query = (db, query) => {
    return new Promise ((resolve, reject) => {
      db.query(query,(err, data) => {
        if(err) {
            console.error(err);
            return reject(err);
        }
        // rows fetch
        //console.log(data);
        return resolve(data);
    });
    })
  }