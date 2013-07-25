Storra
======

A prototypical REST storage service based on [Node.js] (http://nodejs.org/). Currently, only [MongoDB](http://www.mongodb.org/) and two in-memory databases, [node-dirty](https://github.com/felixge/node-dirty) and [nStore](https://github.com/creationix/nstore), can be used as the storage backend. Other storage backends might be added in future versions.

Right now, this package basically wraps MongoDB (or one of the in-memory databases) (or one of the in-memory databases) (or one of the in-memory databases) (or one of the in-memory databases) (or one of the in-memory databases) (or one of the in-memory databases) (or one of the in-memory databases) (or one of the in-memory databases) in a RESTful http interface. Only basic CRUD operations on collections and single documents are supported, queries are not yet implemented.

Setup
-----

* Storra runs on Node.js, so obviously you need to have Node.js installed.
Anything from version 0.8.21 upwards should do. Go to http://nodejs.org/ to
fetch it or follow https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager
* `git clone https://github.com/basti1302/storra.git`
If you just want to *use* Storra:
    * `npm install`
If you want to *develop* Storra:
    * `npm install -g jasmine-node 1.2.x`
    * `npm install -g cucumber.js ~0.3.0`
    * `npm install -g grunt-cli 0.4.1`
    * Optional, but recommended: `npm install -g supervisor`
    * `npm install`
* You can edit `storra.yml` to configure Storra, see below.
* `node lib\index.js` to start Storra.

### Note for Windows Users

If you get the following or something similar error during `npm install`:

```
npm WARN `git config --get remote.origin.url` returned wrong result (git://github.com/magicmoose/grunt-jasmine-node.git)

npm ERR! git clone git://github.com/magicmoose/grunt-jasmine-node.git
npm ERR! Error: spawn ENOENT
npm ERR!     at errnoException (child_process.js:980:11)
npm ERR!     at Process.ChildProcess._handle.onexit (child_process.js:771:34)
npm ERR! If you need help, you may report this log at:
npm ERR!     <http://github.com/isaacs/npm/issues>
npm ERR! or email it to:
npm ERR!     <npm-@googlegroups.com>

npm ERR! System Windows_NT 6.1.7600
npm ERR! command "C:\\Program Files\\_meine_programme\\entwickeln\\node\\\\node.exe" "C:\\Program Files\\_meine_programm
e\\entwickeln\\node\\node_modules\\npm\\bin\\npm-cli.js" "install"
npm ERR! cwd C:\git-repos\storra
npm ERR! node -v v0.10.13
npm ERR! npm -v 1.3.2
npm ERR! syscall spawn
npm ERR! code ENOENT
npm ERR! errno ENOENT
```

It might be due to this problem: https://github.com/isaacs/npm/issues/2333 -
or you might have chosen to not add git to your PATH during the installation of
git. The solution is to update to the latest version of Git for Windows or to do
`npm install` from within the GitBash instead of using the command prompt.

Configuration
-------------

Since the configuration file format YAML and YAML is hierarchic, configuration
is split in sections. Currently there are the following sections:

* core
* mongodb

No section needs to be present. None of the possible options needs to be
present. Unknown sections are ignored as well as unknown values.

### Section core

* port - the port on which Storra listens for connections. Default is 1302.
* bindAddress - The IP address on which Storra listens for connections. Default is 0.0.0.0.
* backend - the persistence backend to use.
    * `'./backends/node_dirty_backend'` - node-dirty (Default)
    * `'./backends/nstore_backend'` - nStore
    * `'./backends/mongodb_backend'` - MongoDB

### Section mongodb
If you use the MongoDB backend, you can configure some more options specific to
MongoDB. If you use a different backend, these options are ignored.
* connectionMaxRetries - How often Storra tries to connect to MongoDB if the
  connection can not be established on the first try. Default is 20.
* connectionTimeBetweenRetries - How many milliseconds to wait before trying
  again. Default is 50.
* database - The MongoDB database Storra will use.

Usage
-----

* GET /collection to list a collection of documents
* POST to /collection to create a new document
* GET /collection/key to retrieve a document
* PUT /collection/key to update a document
* DELETE /collection/key to delete a document

Currently, non-existing collections are created on the fly when you access them
(either by GET or by POST) instead of returning HTTP 404 Not Found. This is why there is no method to explicitly create a collection. This is simply a consequence of the fact that all existing backends handle access to non-existing collections this way. This behaviour will probably change in a future version or it might be configurable.
