const express = require('express');
const socket = require('socket.io');
const app = express();
const server = require('http').createServer(app);
const io = socket(server);

server.listen(process.env.PORT || 5000);
app.use(express.static('public'));

const deltas = [];
const socketIds = [];
const waitingUsers = [];
var curEditSocket;

io.sockets.on('connection', connection);

function connection(socket) {
	console.log('a new user with id ' + socket.id + " has entered");
	socketIds.push(socket.id);
	io.emit('userConnect', {id: socket.id});

	// Sent the whole initial content to the connected user
	io.to(socket.id).emit('init', {socketIds, deltas, curEditSocket});

	socket.on('disconnect', disconnectHandler);
	socket.on('getEditAccess', getAccessHandler);
	socket.on('textUpdate', textUpdateHandler);
	socket.on('accessChange', changeAccessHandler)

	function disconnectHandler() {
		console.log(socket.id, ' disconnected');
		socketIds.splice(socketIds.indexOf(socket.id), 1);
		io.emit('userDisconnect', {id: socket.id});

		console.log('waiting users', waitingUsers);

		if (curEditSocket !== socket.id) {
			const index = waitingUsers.indexOf(socket.id);
			if (index > -1) {
				waitingUsers.splice(index, 1);
			}
		} else {
			if (!waitingUsers.length) {
				curEditSocket = null;
				return;
			}
			curEditSocket = waitingUsers.shift();
			io.emit('newEditor', curEditSocket);
		}
	}

	function getAccessHandler(socketId) {
		console.log('Inside get acess handler');
		console.log('Wiating users', waitingUsers);
		if (curEditSocket && waitingUsers.indexOf(socketId) == -1) {
			waitingUsers.push(socketId);
			return;
		}

		if (!curEditSocket && waitingUsers.length == 0) {
			curEditSocket = socketId;
			io.emit('newEditor', socketId);
		}
	}

	function textUpdateHandler(data) {
		const newDelta = data.delta;
		deltas.push(newDelta);
		socket.broadcast.emit('newTextUpdate', {delta: newDelta});
	}

	function changeAccessHandler() {
		console.log('Inside change access handler');
		console.log('Waiting uers', waitingUsers);
		if (!waitingUsers.length) {
			curEditSocket = null;
			return;
		}

		curEditSocket = waitingUsers.shift();
		io.emit('newEditor', curEditSocket);
	}
}
