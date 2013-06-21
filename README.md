Storra
======

A prototypical REST storage service based on [node.js] (http://nodejs.org/). Currently, only [MongoDB](http://www.mongodb.org/) and two in-memory databases, [node-dirty](https://github.com/felixge/node-dirty) and [nStore](https://github.com/creationix/nstore), can be used as the storage backend. Other storage backends might be added in future versions.

Right now, this package basically wraps MongoDB in a RESTful http interface. Only basic CRUD operations on collections and single documents are supported, queries are not yet implemented.
