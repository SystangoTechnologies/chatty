A Real Time Chat Application built using Node.js, Express, Mongoose and Socket.io

## Index
+ [Demo](#demo)
+ [Features](#features)
+ [Installation](#installation)
+ [How It Works](#how-it-works)
+ [Support](#support)
+ [Contribute](#contribute)
+ [License](#license)


## Features<a name="features"></a>
+ Uses Express as the application Framework.
+ Manages Sessions using [express-session](https://github.com/expressjs/session) package.
+ Real-time communication between a client and a server using [Socket.io](https://github.com/socketio/socket.io).
+ Uses [MongoDB](https://github.com/mongodb/mongo), [Mongoose](https://github.com/Automattic/mongoose) and [MongoLab(mLab)](https://mlab.com/) for storing and querying data.
+ Stores session in a [MongoDB](https://github.com/mongodb/mongo) using [connect-mongo](https://github.com/kcbanner/connect-mongo); a MongoDB-based session store.

## Installation<a name="installation"></a>
### Running Locally
Make sure you have [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed.

1. Clone or Download the repository

	```
	$ git clone 
	$ cd chat.io
	```
2. Install Dependencies

	```
	$ npm install
	```
2. Edit configuration file in _app/config/config.json_ with your credentials(see [Setup Configurations](#configurations)).

5. Start the application

	```
	$ npm start
	```
Your app should now be running on [localhost:3000](http://localhost:3000/).

## How It Works<a name="how-it-works"></a>
### Setup Configurations<a name="configurations"></a>
The configurations on production will be assigned from Environment Variables on Heroku, while the development configurations reside inside _app/config/config.json_ file.

#### MongoDB & MongoLab
You need to create a database on MongoLab, then create a database user, get the `MongoDB URI`, and assign it to `dbURI`.

#### Session
The session needs a random string to make sure the session id in the browser is random. That random string is used to encrypt the session id in the browser, _Why?_ To prevent session id guessing.

### Database<a name="database"></a>
Mongoose is used to interact with a MongoDB that's hosted by MongoLab. 

#### Schemas
There are two schemas; users and rooms. 

Each user has a username, passowrd, social Id, and picture. If the user is logged via username and password, then social Id has to be null, and the if logged in via a social account, then the password will be null.

Each room has a title, and array of connections. Each item in the connections array represents a user connected through a unique socket; object composed of _{userId + socketId}_. Both of them together are unique.

### Models<a name="models"></a>
Each model wraps Mongoose Model object, overrides and provides some methods. There are two models; User and Room.

### Session<a name="session"></a>
Session in Express applications are best managed using [express-session](https://github.com/expressjs/session) package. Session data are stored locally on your computer, while it's stored in the database on the production environment. Session data will be deleted upon logging out.


## License <a name="license"></a>
Built under [MIT](http://www.opensource.org/licenses/mit-license.php) license.
