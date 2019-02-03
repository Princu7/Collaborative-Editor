const socket = io.connect('http://localhost:8080');
var editRequestSent = false;
var users = [];
var deltasArr = [];
var curEditing = false;

const options = {
  placeholder: 'Write your darkest fantasies ... Just kidding :)',
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
}

function userLeftHandler(data) {
  users.splice(users.indexOf(data.id), 1);
}

function getEditAccess() {
  if (editRequestSent) {
    return;
  }
  console.log('Sending get edit access');
  socket.emit('getEditAccess', socket.id);
  editRequestSent = true;
}

function initHandler(data) {
  console.log('Inside init handler');
  users = data.socketIds;
  deltasArr = data.deltas;
  console.log('Deltas arr', deltasArr);
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
  if (socket.id == socketId) {
    console.log('Currente client now editing');
    quill.enable(true);
    quill.focus();
    editRequestSent = false;
    curEditing = true;
    return;
  }
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