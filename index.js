//Config options
var config = require('./config.json');

//Native Packages
var fs = require('fs');
var https = require('https');
var crypto = require('crypto');
var child_process = require('child_process');
var cookie  =   require('cookie');
var connect =   require('connect');

//Packages
var express = require('express');
var ejs = require('ejs');
var socket_io = require('socket.io');
var mongodb = require('mongodb');
var _ = require('lodash');

//Init
var Server = mongodb.Server;
var Db = mongodb.Db;
var app = express();

/* ============================= EXPRESS HTTPS SERVER ============================== */

var options = {
  key: fs.readFileSync(config.private_key),
  cert: fs.readFileSync(config.certificate)
};

app.use('/static', express.static(__dirname + '/static'));
app.engine('html', ejs.renderFile);
app.use(express.cookieParser());
app.use(express.json());
app.use(express.urlencoded());

app.sessionStore = new express.session.MemoryStore({reapInterval: 60000 * 10 });
app.use(express.session({
  'secret': config.session_secret,
  'store':  app.sessionStore
}));

app.get('/', function(req, res) {
  if (req.session.logged)
    res.render(__dirname + '/public/index.html');
  else
    res.render(__dirname + '/public/not_logged.html', {
      teams_list: db_teams
    });
});


app.get('/scoreboard.html', function(req, res) {
  if (req.session.logged)
    res.render(__dirname + '/public/scoreboard.html');
  else
    res.render(__dirname + '/public/not_logged.html', {
      teams_list: db_teams
    });
});


app.get('/admin_poney', function(req, res) {
  if (req.session.logged) {
    if(req.session.logged.login==config.admin_name)
      res.render(__dirname + '/public/admin_poney.html');
    else
      res.render(__dirname + '/public/not_logged.html', {
        teams_list: db_teams
      });
  }
  else
    res.render(__dirname + '/public/not_logged.html', {
      teams_list: db_teams
    });
});


app.post('/', function (req, res) {
  if (!req.body.login || !req.body.password) {
    res.render(__dirname + '/public/not_logged.html', {
      teams_list: db_teams
    });
  }
  else{
    for(i = 0 ; i < db_teams.length ; i++) {
      var shasum = crypto.createHash('sha256');
      shasum.update(req.body.password);
      if(db_teams[i].login == req.body.login)
        if(db_teams[i].password == shasum.digest('hex')) {
          req.session.logged = db_teams[i];
          req.session.sid = req.sessionID;
          res.redirect('/');
        }
    }

  	res.render(__dirname + '/public/not_logged.html', {
      teams_list: db_teams
    });
  }
});


/* ============================= MONGODB CONNECTION ============================== */


var time_out=0; // 1 to stop the game

var db_teams;
var db_tasks;
var c_teams = child_process.fork(__dirname + '/sthack_teams_mongo.js');
c_teams.on('message', function(m) {
  db_teams = m;
});

var c_tasks = child_process.fork(__dirname + '/sthack_tasks_mongo.js');
c_tasks.on('message', function(m) {
  db_tasks=m;
});

c_tasks.send('update');
c_teams.send('update');


/* ============================= SOCKET.IO ============================== */

app2 = https.createServer(options, app).listen(config.port);

var socket = socket_io.listen(app2, { log: false });

socket.set('authorization', function (handshakeData, callback) {
  if(typeof handshakeData.headers.cookie == 'undefined') {
    callback(null, false);
  }
  else {
    handshakeData.cookie = cookie.parse(handshakeData.headers.cookie);
    handshakeData.sessionID = connect.utils.parseSignedCookie(handshakeData.cookie['connect.sid'], config.session_secret);
    if (typeof app.sessionStore.sessions[handshakeData.sessionID] != 'undefined'){
      var mySession = JSON.parse(app.sessionStore.sessions[handshakeData.sessionID]);
      if(typeof mySession.logged != 'undefined'){
        handshakeData.team_name = mySession.logged.login;
        callback(null,true);
      }
      else
        callback(null,false);
    }
  }
});


function solvedtask(task, team_name) {
  var solved_closed = {};
  solved_closed.solved = 0;
  solved_closed.closed = 0;

  if(typeof task.solved != 'undefined') {
    solved_closed.solved = 1;
    var best_time = 99999999999999;
    var last_time = 0
    var my_time = 0;

    for(j = 0 ; j < task.solved.length ; j++) {
      if(best_time > task.solved[j].timestamp)
        best_time = task.solved[j].timestamp;

      if(last_time < task.solved[j].timestamp)
        last_time = task.solved[j].timestamp;

      if(task.solved[j].team == team_name) {
        solved_closed.solved = 2;
        my_time = task.solved[j].timestamp;
      }
    }
    if(my_time == best_time)
      solved_closed.solved = 3;

    if(last_time + 1000 * 60 * 10 > (new Date()).getTime())
      solved_closed.closed = 1;
    else
      solved_closed.closed = 0;
  }

  return solved_closed;
}


function getScore(team) {
  var score = 0;

  for(i=0 ; i < db_tasks.length ; i++) {
    if(typeof db_tasks[i].solved != 'undefined') {
      for(j = 0 ; j < db_tasks[i].solved.length ; j++) {
        if(db_tasks[i].solved[j].team == team) {
          score += calculateScoretask(db_tasks[i]);
          break;
        }
      }
    }
  }
  return score;
}


function returnScoreBoard() {
  var score = 0;
  var result = new Array();
  var name = '';
  var breakthrough = 0;

  for(var i = 0 ; i < db_teams.length ; i++) {
    name = db_teams[i].login;
    breakthrough = getBreakThrough(name);
    result.push({'name': name, 'score': getScore(name)+50*breakthrough, bt: breakthrough});
  }

  result.sort(function(a, b) {
    if(a.score < b.score)
      return 1;
    else if(a.score == b.score)
      return 0;
    else
      return -1;
  });
  return result;
}

function getBreakThrough(team) {
  var bt = 0;
  for(i = 0 ; i < db_tasks.length ; i++) {
    if(typeof db_tasks[i].solved != 'undefined') {
      var best_time = 99999999999999;
      var my_time = 0;
      for(j = 0 ; j < db_tasks[i].solved.length ; j++) {
        if(best_time > db_tasks[i].solved[j].timestamp)
          best_time = db_tasks[i].solved[j].timestamp;

        if(db_tasks[i].solved[j].team == team)
          my_time = db_tasks[i].solved[j].timestamp;

        if(my_time == best_time) {
          bt += 1;
          break;
        }
      }
    }
  }
  return bt;
}

function calculateScoretask(task) {
  var score = db_teams.length*50;
  if(typeof task.solved != 'undefined') {
    score -= task.solved.length*50;
  }
  return score;
}

/*
solved = 0 : nobody solved
solved = 1 : someone solved
solved = 2 : team solved
solved = 3 : team solved first
solved = 4 : task closed
*/

function hereIstasks(team_name){
  var tasks = new Array();
  for(i = 0 ; i < db_tasks.length ; i++) {
  var is_solved = solvedtask(db_tasks[i], team_name);
  var score = calculateScoretask(db_tasks[i]);
  tasks.push({
    'name': db_tasks[i].name,
    'type': db_tasks[i].type,
    'solved': is_solved.solved,
    'score': score,
    'closed': is_solved.closed
    });
  }
  return tasks;
}


function reopenAll(c,task) {
  setTimeout(function() {
    c_tasks.send('update');
    setTimeout(function() {
      c.emit('task_reopen', task);
      c.broadcast.emit('task_reopen', task);
    }, 1000);
  }, (1000 * 60 * 10));
}


socket.on('connection', function(client) {
  if(time_out == 1)
    client.emit('admin_end');
  else
    client.emit('here_is_tasks', {'tasks': hereIstasks(client.handshake.team_name)});

  client.emit('your_score', {
    'score': getScore(client.handshake.team_name),
    'breakthrough': getBreakThrough(client.handshake.team_name),
    'name': client.handshake.team_name
  });

  client.on('give_me_scoreboard',function(data) {
    client.emit('scoreboard',returnScoreBoard());
  });

  client.on('give_me_task', function(data) {
    data.name=_.unescape(data.name);
    for(i = 0 ; i < db_tasks.length ; i++) {
      if(db_tasks[i].name == data.name) {
        var is_solved = solvedtask(db_tasks[i], client.handshake.team_name);
        var score = calculateScoretask(db_tasks[i]);

        if(data.change == 1)
          client.emit('change_this_task', {
            'name': db_tasks[i].name,
            'solved': is_solved.solved,
            'closed': is_solved.closed,
            'score': score
          });
        else if(is_solved.closed==0)
          client.emit('here_is_task', {
            'name': db_tasks[i].name,
            'description': db_tasks[i].description,
            'type': db_tasks[i].type,
            'solved': is_solved.solved,
            'score': score
          });
      break;
      }
    }
  });

  client.on('what_is_my_score', function() {
    client.emit('your_score', {
      'score': getScore(client.handshake.team_name),
      'breakthrough': getBreakThrough(client.handshake.team_name),
      'name': client.handshake.team_name
    });
  });

  client.on('admin_off',function() {
    time_out = 1;
    client.broadcast.emit('admin_end');
  });

  client.on('admin_on',function() {
    time_out = 0;
  });

  client.on('admin_refresh',function() {
    c_tasks.send('update');
    setTimeout(function() {
      client.broadcast.emit('refresh');
    }, 1000);
  });

  client.on('here_is_my_flag', function(data) {
    data.task = _.unescape(data.task);
    if(time_out == 0) {
      for(i = 0 ; i < db_tasks.length ; i++) {
        if(db_tasks[i].name == data.task) {
          var shasum = crypto.createHash('sha256');
          var already=0;
          var closed=0;
          shasum.update(data.flag);
          var shaflag = shasum.digest('hex');

          if(shaflag == db_tasks[i].flag) {
            if(typeof db_tasks[i].solved != 'undefined') {
              for(j = 0 ; j < db_tasks[i].solved.length ; j++) {
                if(db_tasks[i].solved[j].team == client.handshake.team_name) {
                  already = 1;
                  break;
                }
                if(db_tasks[i].solved[j].timestamp + 1000 * 60 * 10 > (new Date()).getTime()) {
                  closed = 1;
                  break;
                }
              }
            }
            if(already == 0 && closed == 0) {
              var db = new Db(config.mongo.db, new Server(config.mongo.ip, config.mongo.port, {auto_reconnect: true}), {safe: true});
              db.open(function(err, db) {
                if(!err) {
                  db.authenticate(config.mongo.login, config.mongo.password, function(err, result) {
                    if(!err) {
                      db.collection('tasks', function(err, coll) {
                        if(!err){
                          coll.update({'name': data.task}, {
                            $push: {
                              'solved': {
                                'team': client.handshake.team_name,
                                'timestamp' :(new Date()).getTime()
                              }
                            }
                          },{safe: true},function(err,count) {
                            c_tasks.send('update');
                            setTimeout(function() {
                              client.emit('scoreboard', returnScoreBoard());
                              client.broadcast.emit('scoreboard', returnScoreBoard());
                              client.emit('task_pwned', {
                                'task': data.task,
                                'team': client.handshake.team_name
                              });
                              client.broadcast.emit('task_pwned', {
                                'task': data.task,
                                'team': client.handshake.team_name
                              });
                              client.emit('your_score',{
                                'score': getScore(client.handshake.team_name),
                                'breakthrough': getBreakThrough(client.handshake.team_name),
                                'name': client.handshake.team_name
                              });
                              client.broadcast.emit('ask_me_score');
                              }, 1000);
                            reopenAll(client, data.task);
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
            }
          }
          else
            client.emit('bad_flag');
          break;
        }
      }
    }
  });

  client.on('logged', function(data) {
    console.log(data)
  });

  client.on('admin_message', function(data) {
    if(client.handshake.team_name == config.admin_name) {
      client.emit('admin_message', data);
      client.broadcast.emit('admin_message', data);
    }
  });

});
