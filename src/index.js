const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, getUser, removeUser, getUsersInRoom }= require('./utils/users')

const app = express()
const server = http.createServer(app) // already happens behind the scenes
const io = socketio(server)

const port = process.env.PORT || 3000
const publicDirectoryPath = path.join(__dirname, '../public')

app.use(express.static(publicDirectoryPath))


// server (emit) -> client (receive) --acknowlegement (optional)--> server

// client (emit) -> server (receive) --acknowlegement (optional)--> client

io.on('connection', (socket) => {
    console.log('New WebSocket connection')

    // "Welcome!" from server to client:
    //socket.emit('msg', generateMessage(message)) 
    // From server to all other clients:
    //socket.broadcast.emit('msg', generateMessage('A new user has joined!')) 
    
    // socket.emit, send event to specific client
    // io.emit, send event to all clients
    // socket.broadcast.emit, send event to all clients except initiater
    
    socket.on('join', (options, callback) => {
        const {error, user } = addUser({ id: socket.id, ...options })
    // socket.on('join', ({ username, room }, callback) => {
    //     const {error, user } = addUser({ id: socket.id, username, room })

        if (error) {
            return callback(error) 
            // return stops execution, could use else block instead
        }

        socket.join(user.room)
        
        socket.emit('msg', generateMessage('Admin', 'Welcome!')) 
        socket.broadcast.to(user.room).emit('msg', generateMessage('Admin',`${user.username} has joined!`))
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        }) 

        callback()
    })

    socket.on('sendMsg', (message, callback) => {
        const filter = new Filter()

        if (filter.isProfane(message)) {
            return callback('Profanity is not allowed!')
        }

        const user = getUser(socket.id)

        //io.emit('msg', generateMessage(message))
        io.to(user.room).emit('msg', generateMessage(user.username, message))
        callback()
    })

    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id)
        io.to(user.room).emit('locationMsg', generateLocationMessage(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`))
        callback()
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if (user) {
            io.to(user.room).emit('msg', generateMessage('Admin',`${user.username} has left!`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            }) 
        }
    })

})

server.listen(port, () => {  // server instead of app because of http.createServer
    console.log(`Server is up on port ${port}!`)
})