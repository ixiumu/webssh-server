const WebSocket = require('ws')
const os = require('os')
const pty = require('node-pty')
const http = require('http')

process.on('uncaughtException', (err) => {
    if (err.message === 'read EPIPE') {
        console.log('Unexpected disconnection')
    } else {
        console.warn('Uncaught Exception:', err)
    }
})

class WebsocketShellServer {
    constructor() {
        const shell = os.platform() === 'win32' ? 'powershell.exe' : 'login' // bash
        const server = http.createServer()
        const wss = new WebSocket.Server({ noServer: true });

        wss.on('connection', (connection) => {
            const ptyProcess = pty.spawn(shell, [], {
                cwd: process.env.HOME,
                env: process.env
            })

            ptyProcess.on('data', (data) => {
                connection.send(data)
            })

            ptyProcess.on('error', (err) => {
                console.error('Error in ptyProcess:', err)
            })

            ptyProcess.once('close', () => {
                connection.removeAllListeners()
                connection.close()
            })

            connection.on('message', (data) => {
                if (Buffer.from('ping').compare(data) === 0) {
                    connection.send('pong')
                } else {
                    ptyProcess.write(data)
                }
            })

            connection.once('close', () => {
                ptyProcess.removeAllListeners()
                ptyProcess.destroy()
            })
        })

        server.on('request', (req, res) => {
            if (req.url === '/') {
                res.writeHead(401, {'Content-Type': 'text/plain'})
                res.end('401 Unauthorized')
            } else {
                res.writeHead(404, {'Content-Type': 'text/plain'})
                res.end('404 Not Found')
            }
        });

        server.on('upgrade', (request, socket, head) => {
            if (request.url === '/ssh') {
                wss.handleUpgrade(request, socket, head, (ws) => {
                    wss.emit('connection', ws, request)
                });
            } else {
                socket.destroy()
            }
        })

        this.server = server
    }

    listen() {
        this.server.listen(process.env.PORT || 8000, '0.0.0.0', () => {
            console.log(`Server started on port ${this.server.address().port}`)
        })
    }
}

const shellServer = new WebsocketShellServer()
shellServer.listen()
