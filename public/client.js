// const socket = io.connect('https://rocketium-editor-abhishek.herokuapp.com/' || 'http://localhost:5000');
const socket = io.connect('http://localhost:5000');
var editRequestSent = false;
var users = [];
var deltasArr = [];
var curEditing = false;
var curEditingUser;

const options = {
  placeholder: 'Write what you want. Write what you will',
  readOnly: true,
  theme: 'snow'
};
const quill = new Quill('#editor', options);


// First init message containing all the text entered till now from the server
socket.on('init', initHandler);
socket.on('newEditor', checkAccessHandler);
socket.on('userConnect', userAddHandler);
socket.on('userDisconnect', userLeftHandler);
socket.on('newTextUpdate', textUpdateHandler);
quill.on('text-change', textChangeHandler);
quill.on('selection-change', selectionChangeHandler);

function userAddHandler(data) {
  users.push(data.id);
  updatePeerDisplay();
}

function userLeftHandler(data) {
  if (users.indexOf(data.id) >= 0) {
    users.splice(users.indexOf(data.id), 1);
    updatePeerDisplay();
  }
}

function getEditAccess() {
  if (editRequestSent) {
    return;
  }
  console.log('Sending get edit access');
  socket.emit('getEditAccess', socket.id);
  editRequestSent = true;
}

function updatePeerDisplay() {
  $('#active').html('');
  $('#present').html('');

  console.log('Inside peer display');
  console.log('users', users);
  console.log('Cur user', curEditingUser);
  console.log('Cur editing', curEditing);

  if (curEditing) {
    $('#active').html('<p>You</p>')
  } else if (curEditingUser) {
    $('#active').html(`<p>User: ${curEditingUser} </p>`)
  }
  users.forEach((user) => {
    if (user == curEditingUser) {
      return;
    }
    if (user == socket.id) {
      $('#present').append('<p> You </p>')
    } else {
      $('#present').append(`<p> User: ${user} </p>`)
    }
  });
}

function initHandler(data) {
  console.log('Inside init handler');
  users = data.socketIds;
  deltasArr = data.deltas;
  curEditingUser = data.curEditSocket;
  console.log('data', data);
  updatePeerDisplay();
  getEditAccess();

  if (deltasArr.length == 0) {
    return;
  }
  deltasArr.forEach((delta) => {
    quill.updateContents(delta);
  });
  quill.update('api');
  console.log('Updated all');
}

function checkAccessHandler(socketId) {
  console.log('Check access handler ');
  curEditingUser = socketId;
  if (socket.id == socketId) {
    console.log('Currente client now editing');
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

function textUpdateHandler(data) {
  console.log('Text update handler from server');
  const delta = data.delta;
  deltasArr.push(delta);
  quill.updateContents(delta);
  quill.update('api');
}

function textChangeHandler(delta, oldDelta, source) {
  console.log('Text change handler to server');
  if (source == 'api') {
    return;
  }
  deltasArr.push(delta);
  socket.emit('textUpdate', {delta});
}

function selectionChangeHandler(range, oldRange, source) {
  if (curEditing && !range) { // Cursor is not in the editor. Give the chance to other users to edit :)
    console.log('Sent access change to server. Other users now can edit');
    socket.emit('accessChange');
    editRequestSent = false;
    curEditing = false;
  } else if (range && !curEditing) {
    console.log('Ask for edit access from server');
    getEditAccess();
  }
}