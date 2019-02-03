// const socket = io.connect('https://rocketium-editor-abhishek.herokuapp.com/'); // For Heroku
const socket = io.connect('http://localhost:5000'); // For Localhost
var editRequestSent = false;
var users = [];
var deltasArr = []; // List of all the text changes. Stored as Quill editor special objects deltas
var curEditing = false; // Boolean storing whether this user is currently editing or not
var editAccessUser; // Stores the socket ID of the user with the edit access

const options = {
  placeholder: 'Write what you want. Write what you will',
  readOnly: true,
  theme: 'snow'
};
const quill = new Quill('#editor', options);


socket.on('init', initHandler); // Init message from server, contains initialization information
socket.on('newEditor', checkAccessHandler); // Message from server informing about the new user who got edit access
socket.on('userConnect', userAddHandler); // New user connection message from server
socket.on('userDisconnect', userLeftHandler); // User disconnection message from server
socket.on('newTextUpdate', textUpdateHandler); // Message from server containing text changes made by the editing client
quill.on('text-change', textChangeHandler); // Event fired by Quill editor when changes are made locally
quill.on('selection-change', selectionChangeHandler); // Event fired by Quill when the cursor focus is changed


/*
Handles the addition of user to the existing array
*/
function userAddHandler(data) {
  users.push(data.id);
  updatePeerDisplay();
}

/*
Handles the disconnection of an existing user
*/
function userLeftHandler(data) {
  if (users.indexOf(data.id) >= 0) {
    users.splice(users.indexOf(data.id), 1);
    updatePeerDisplay();
  }
}

/*
Asks the server for edit access of the document
*/
function getEditAccess() {
  if (editRequestSent) {
    return;
  }
  socket.emit('getEditAccess', socket.id);
  editRequestSent = true; // Boolean for avoiding repeated messages to the server asking for edit access
}

/*
Ugly function for displaying current active user and present user
*/
function updatePeerDisplay() {
  $('#active').html('');
  $('#present').html('');

  if (curEditing) {
    $('#active').html('<p>You</p>')
  } else if (editAccessUser) {
    $('#active').html(`<p>User: ${editAccessUser} </p>`)
  }
  users.forEach((user) => {
    if (user == editAccessUser) {
      return;
    }
    if (user == socket.id) {
      if (editRequestSent) {
        $('#present').append('<p>You (Edit Request Sent)</p>')
      } else {
        $('#present').append('<p>You</p>')
      }
    } else {
      $('#present').append(`<p>User ID: ${user}</p>`)
    }
  });
}

/*
Initializes the editor and data variables with information received from server. And requests for edit access
*/
function initHandler(data) {
  users = data.socketIds;
  deltasArr = data.deltas;
  editAccessUser = data.curEditSocket;

  getEditAccess();
  updatePeerDisplay();

  if (deltasArr.length == 0) {
    return;
  }
  deltasArr.forEach((delta) => {
    quill.updateContents(delta);
  });

  quill.update('api');
}

/*
Receives current editing user from server and matches it against the present user
*/
function checkAccessHandler(socketId) {
  editAccessUser = socketId;

  if (socket.id == socketId) {
    quill.enable(true);
    quill.focus();
    editRequestSent = false;
    curEditing = true;
    updatePeerDisplay();
    return;
  }

  updatePeerDisplay();
  quill.disable();
}

/*
Updates edtior with latest changes received from the server
*/
function textUpdateHandler(data) {
  const delta = data.delta;

  deltasArr.push(delta);
  quill.updateContents(delta);
  quill.update('api');
}

/*
Notifies the server about latest text changes made locally in the editor
*/
function textChangeHandler(delta, oldDelta, source) {
  if (source == 'api') { // Don't emit the text update event when the change made is through the API itself
    return;
  }

  deltasArr.push(delta);
  socket.emit('textUpdate', {delta});
}

/*
Sends request to server for gaining or leaving edit access based on change of focus of mouse cursor
*/
function selectionChangeHandler(range, oldRange, source) {
  if (curEditing && !range) { // User clicked outside the editor. Wants to give up edit access :)
    socket.emit('accessChange');
    editRequestSent = false;
    curEditing = false;
  } else if (range && !curEditing) { // User clicked within the editor. Wants edit access
    getEditAccess();
    updatePeerDisplay();
  }
}