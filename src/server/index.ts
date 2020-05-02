import express from "express";
import http from "http";
import socketIO from "socket.io";
import { registerHandlers } from "server/handlers/handlers";
import { gameServer } from "server/server/GameServer";
import {mockGameProcess} from '_integration/mockGameProcess';

const port: number = 30;

class App {
  private server: http.Server;
  private port: number;

  private io: socketIO.Server;

  constructor(port: number) {
    this.port = port;

    const app = express();

    this.server = new http.Server(app);
    app.get('/', function(req, res) {
      res.send('hello world');
    });
    this.io = socketIO(this.server);
    gameServer.initialize(this.io);
    this.io.on("connection", (socket: socketIO.Socket) => {
      const player = gameServer.initPlayer(socket);
      //gameServer.isMock = true;
      registerHandlers(player);
      //mockGameProcess(player);
    });

  }

  public Start() {
    this.server.listen(this.port, '192.168.0.101');
    console.log(`Server listening on port ${this.port}.`);
  }
}

new App(port).Start();

export default App;
