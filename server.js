const express = require('express');
const socket = require('socket.io');
const app = express();
const server = require('http').createServer(app);
const io = socket(server);

server.listen(process.env.PORT || 5000);
app.use(express.static('public'));

const deltas = []; // List of all the text changes made so far. Stored in form of Deltas (Quill editor objects)
const socketIds = []; // List of all IDs of client sockets connected so far
const waitingUsers = []; // Stores the list of clients who have requested for edit access
var curEditSocket; //ID of the current editing socket client

io.sockets.on('connection', connection);

function connection(socket) {
	socketIds.push(socket.id);

	io.emit('userConnect', {id: socket.id});
	io.to(socket.id).emit('init', {socketIds, deltas, curEditSocket}); // Sent the whole initial content to the connected user

	socket.on('disconnect', disconnectHandler); // When a client disconnects
	socket.on('getEditAccess', getAccessHandler); // When a client requests for edit access
	socket.on('textUpdate', textUpdateHandler); // When a client notified of local text change
	socket.on('accessChange', changeAccessHandler) // When a client gives up edit access

	/*
	Handles the disconnection of a client
	*/
	function disconnectHandler() {
		const socketIndex = socketIds.indexOf(socket.id);

		if (socketIndex >= 0) {
			socketIds.splice(socketIndex, 1);
		}

		io.emit('userDisconnect', {id: socket.id}); //Broadcast disconnect event to all clients

		if (curEditSocket !== socket.id) { // Disconnecting client wasn't the one with edit access
			const sockIndex = waitingUsers.indexOf(socket.id); // Remove if present in waiting queue
			if (sockIndex > -1) {
				waitingUsers.splice(sockIndex, 1);
			}
		} else { // Disconnecting client was the one with the edit access
			if (!waitingUsers.length) {
				curEditSocket = null;
				io.emit('newEditor', curEditSocket); // No one currently has access. Broadcasting null
				return;
			}
			curEditSocket = waitingUsers.shift();
			io.emit('newEditor', curEditSocket); // Broadcasting the socket id of the client with edit access now
		}
	}

	/*
	Handler when a client requests for edit accesss
	*/
	function getAccessHandler(socketId) {
		if (curEditSocket && waitingUsers.indexOf(socketId) == -1) { // Lock not free. If not in waiting queue already, push it
			waitingUsers.push(socketId);
			return;
		}

		if (!curEditSocket && waitingUsers.length == 0) { // No one currently editing and no one in queue. Grant access
			curEditSocket = socketId;
			io.emit('newEditor', socketId);
		}
	}

	/*
	Receives text changes from editing client and broadcasts it
	*/
	function textUpdateHandler(data) {
		const newDelta = data.delta;
		deltas.push(newDelta);
		socket.broadcast.emit('newTextUpdate', {delta: newDelta});
	}

	/*
	Gives the editing access to the other clients after the current one decides to give it up
	*/
	function changeAccessHandler() {
		if (!waitingUsers.length) {
			curEditSocket = null;
			io.emit('newEditor', curEditSocket);
			return;
		}

		curEditSocket = waitingUsers.shift(); // Give access in FIFO or queue order
		io.emit('newEditor', curEditSocket);
	}
}
