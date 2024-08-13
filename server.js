const WebSocket = require('ws')
const os = require('os')
const pty = require('node-pty')
const http = require('http')
const { exec } = require('child_process')
const os = require('os')

process.on('uncaughtException', (err) => {
    if (err.message === 'read EPIPE') {
        console.log('Unexpected disconnection')
    } else {
        console.warn('Uncaught Exception:', err)
    }
})

class WebsocketShellServer {
    constructor() {
        const shell = os.platform() === 'win32' ? 'powershell.exe' : 'login'
        const server = http.createServer()
        const wss = new WebSocket.Server({ noServer: true });

        wss.on('connection', (connection) => {
            const term = pty.spawn(shell, [], {
                cwd: process.env.HOME,
                env: process.env
            })

            term.on('data', (data) => {
                connection.send(data)
            })

            term.on('error', (err) => {
                console.error('Error in term:', err)
            })

            term.once('close', () => {
                connection.removeAllListeners()
                connection.close()
            })

            connection.on('message', (data) => {
                if (Buffer.from('ping').compare(data) === 0) {
                    connection.send('pong')
                } else if (data.length > 9 && Buffer.from('resize:').compare(data.slice(0, 7)) === 0) {
                    const size = data.toString().split(':')
                    const cols = parseInt(size[1], 10)
                    const rows = parseInt(size[2], 10)
                    term.resize(cols, rows)
                } else {
                    term.write(data)
                }
            })

            connection.once('close', () => {
                term.removeAllListeners()
                term.destroy()
            })
        })

        server.on('request', (req, res) => {
            if (req.url === '/') {
                res.writeHead(401, { 'Content-Type': 'text/plain' })
                res.end('401 Unauthorized')
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' })
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
        this.password()
        this.server.listen(process.env.PORT || 8000, '0.0.0.0', () => {
            console.log(`Server started on port ${this.server.address().port}`)
        })
    }

    password() {
        const currentUser = os.userInfo().username
        const password = process.env.PASSWORD
        if (password) {
            console.log(`Found the environment variable PASSWORD, preparing to change the password for user ${currentUser}...`)
            exec(`echo "${currentUser}:${password}" | chpasswd`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error: ${error}`)
                } else {
                    console.log(`Password for ${currentUser} changed successfully!`)
                }
            })
        }
    }
}

const shellServer = new WebsocketShellServer()
shellServer.listen()
