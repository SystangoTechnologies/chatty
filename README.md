A Real Time Chat Application built using Node.js, Express, Redis and Socket.io

## Index
+ [Features](#features)
+ [Installation](#installation)
+ [Directory Structure](#directory-structure)
+ [Contributors](#Contributors)
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
        │─── .babelrc                           // Babel configuration
        │─── .gitignore                         // Contains files to ignore on git
        │─── docker-compose.yml                 // Docker compose file to provide environment variables and start the container
        │─── Dockerfile                         // Docker file contain commands to assemble an image
        │─── LICENSE
        │─── package.json                       // List of npm modules and various meta-data
        │─── README.md
        │─── server.js                          // Contains Express server and start socket
        │
        ├─── config
        │  │─── config.json                     // Define environment variables for development environment
        │  └─── index.js                        // Uses system env for Production environment and config.json for development environment
        │
        ├─── public
        │   │─── index.html                     // Demo html client
        │   │─── style.css                      // Css for the Demo client
        │   │
        │   └─── js
        │       └───socket.io-1.2.0.js          // JS for supporting socket.io client
        │
        └───src
            ├─── models
            │     │─── delivered.js             // Stores all delivered messages
            │     │─── index.js                 // Initializes Sequalize
            │     │─── messages.js              // Stores all messages
            │     │─── peer_conversations.js    // Stores all conversations between users
            │     └─── pending.js               // Stores all delivered messages
            │
            ├─── socket
            │     └─── index.js                 // Socket.io connections and socket managment code
            │
            └─── utility
                  └─── index.js                 // Utility for serving database related operations
## Installation <a name="installation"></a>
### Running Locally
Make sure you have [Docker](https://docs.docker.com/v17.09/engine/installation/#cloud) and [Docker-compose](https://docs.docker.com/compose/install/) installed.

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
    - DB_USER
    - DB_PASSWORD
    - DB_HOST
    - DB_PORT
    - DB_NAME
    - DB_DIALECT
    - SESSION_SECRET
    - ECHO_SENT_MESSAGE
    - NO_OF_RECORDS_PER_PAGE
	```
3. Start the application

	```
	$ sudo docker-compose up
	```
Your app should now be running on [localhost:3000](http://localhost:3000/).

## Contributors <a name="Contributors"></a>
[Arpit Khandelwal](https://github.com/arpit-systango)
[Anurag Vikram Singh](https://www.linkedin.com/in/anuragvikramsingh/)

## License <a name="license"></a>
Built under [MIT](http://www.opensource.org/licenses/mit-license.php) license.