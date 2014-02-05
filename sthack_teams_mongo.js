var config = require('./config.json');

var mongodb = require('mongodb');

var Db = mongodb.Db;
var Server = mongodb.Server;


process.on('message',function(data) {
  var db = new Db(config.mongo.db, new Server(config.mongo.ip, config.mongo.port, {auto_reconnect: true}),{safe: true});
  db.open(function(err, db) {
    if(!err) {
      db.authenticate(config.mongo.login, config.mongo.password, function(err, result) {
        if(!err) {
          db.collection('teams', function(err, coll) {
            if(!err) {
              coll.find().toArray(function(err, cursor) {
                process.send(cursor);
                db.logout(function(err, result) {
                  db.close();
                });
              });
            }
            else
              console.dir(err);
          });
        }
        else
          console.dir(err);
      });
    }
    else
      console.dir(err);
  });
});