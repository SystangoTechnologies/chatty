A Real Time Chat Application built using Node.js, Express, Redis and Socket.io

## Index
+ [Features](#features)
+ [Installation](#installation)
+ [Directory Structure](#directory-structure)
+ [License](#license)


## Features<a name="features"></a>
+ Uses Express as the application Framework.
+ Real-time communication between a client and a server using [Socket.io](https://github.com/socketio/socket.io).
+ Uses [MySQL](https://www.mysql.com/), [Sequelize](https://github.com/sequelize/sequelize) and [mySQL workbench](https://www.mysql.com/products/workbench/) for storing and querying data.
+ Uses [Redis](https://redis.io/) for broadcasting active users. Also as in-memory data store.
+ Dockerized and uses docker-compose file.
+ Running multiple clusters(each cluster is independent from each other)

## Directory Structure <a name="directory-structure"></a>
        .
        ├── app 
        │   ├── config
        │   │   ├── config.json
        │   │   └── index.js
        │   └── socket
        │       └── index.js
        ├── app.json
        ├── docker-compose.yml
        ├── Dockerfile
        ├── LICENSE
        ├── package.json
        ├── package-lock.json
        ├── Procfile
        ├── README.md
        └── server.js

## Installation <a name="installation"></a>
### Running Locally
Make sure you have [Docker](https://docs.docker.com/v17.09/engine/installation/#cloud) and Docker-compose [npm](https://docs.docker.com/compose/install/) installed.

1. Clone or Download the repository
	```
	$ git clone https://github.com/SystangoTechnologies/chatty
	$ cd chatty
	```
2. Set Environment Variables

	```
	- PORT=3000
    - REDIS_PORT=6380
    - REDIS_HOST=redis
    - REDIS_PASSWORD=''
	```
3. Start the application

	```
	$ sudo docker-compose up
	```
Your app should now be running on [localhost:3000](http://localhost:3000/).

## License <a name="license"></a>
Built under [MIT](http://www.opensource.org/licenses/mit-license.php) license.A Real Time Chat Application built using Node.js, Express, Redis and Socket.io

## Index
+ [Features](#features)
+ [Installation](#installation)
+ [Directory Structure](#directory-structure)
+ [License](#license)


## Features<a name="features"></a>
+ Uses Express as the application Framework.
+ Real-time communication between a client and a server using [Socket.io](https://github.com/socketio/socket.io).
+ Uses [MySQL](https://www.mysql.com/), [Sequelize](https://github.com/sequelize/sequelize) and [mySQL workbench](https://www.mysql.com/products/workbench/) for storing and querying data.
+ Uses [Redis](https://redis.io/) for broadcasting active users. Also as in-memory data store.
+ Dockerized and uses docker-compose file.
+ Running multiple clusters(each cluster is independent from each other)

## Directory Structure <a name="directory-structure"></a>
        .
        ├── app 
        │   ├── config
        │   │   ├── config.json
        │   │   └── index.js
        │   └── socket
        │       └── index.js
        ├── app.json
        ├── docker-compose.yml
        ├── Dockerfile
        ├── LICENSE
        ├── package.json
        ├── package-lock.json
        ├── Procfile
        ├── README.md
        └── server.js

## Installation <a name="installation"></a>
### Running Locally
Make sure you have [Docker](https://docs.docker.com/v17.09/engine/installation/#cloud) and Docker-compose [npm](https://docs.docker.com/compose/install/) installed.

1. Clone or Download the repository
	```
	$ git clone https://github.com/SystangoTechnologies/chatty
	$ cd chatty
	```
2. Set Environment Variables

	```
	- PORT=3000
    - REDIS_PORT=6380
    - REDIS_HOST=redis
    - REDIS_PASSWORD=''
	```
3. Start the application

	```
	$ sudo docker-compose up
	```
Your app should now be running on [localhost:3000](http://localhost:3000/).

## License <a name="license"></a>
Built under [MIT](http://www.opensource.org/licenses/mit-license.php) license.