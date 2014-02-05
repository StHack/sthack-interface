sthack-interface
================

Introduction
--------------------
The NodeJS interface for St'Hack CTF game.
More information on the  event : https://www.sthack.fr/

Installation
--------------------
```
$ git clone https://github.com/agix/sthack-interface
$ cd sthack-interface
$ npm install
$ openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout server.key -out server.crt
```
Then edit "config.json" and "url_to_connect" variable in "static/js/admin.js" and "static/js/sthack.js".
Configure your database.

Mongodb
--------------------
The interface only works with authenticated mongodb database.
To create the database with authentication, ensure "mongod" is running without "--auth" options then :

```
$ mongo sthack
MongoDB shell version: 2.4.6
connecting to: sthack
> db.addUser({user: "login", pwd: "password", roles: ["readWrite"]})
```

Now set the "--auth" option and "--setParameter enableLocalhostAuthBypass=0" in your "mongod" config and restart it.

You can connect, authenticate and insert a new user (password is sha256sum):

```
$ mongo sthack
MongoDB shell version: 2.4.6
connecting to: sthack
> db.auth('login','password')
1
> db.teams.insert({'login':'admin','password':'2bb80d537b1da3e38bd30361aa855686bde0eacd7162fef6a25fe97bf527a25b'})
```

To add some task you need "{'name','description','flag','type'}". Again, flag is sha256sum.

```
> db.tasks.insert({'name': 'First task', 'description': 'Description with <b>html</b> support.', 'flag': '4d54517a024d0cefa786029a81203fab4f94a86054417fd1b10e77f0be3cf2ca', 'type': 'Stegano'})
```

Run
--------------------
```
$ node index.js
```
Enjoy https://<hostname>:4443 !