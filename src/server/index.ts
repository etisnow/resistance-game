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
    this.io = socketIO(this.server);
    gameServer.initialize(this.io);
    this.io.on("connection", (socket: socketIO.Socket) => {
      gameServer.initSocket(socket);
      registerHandlers(gameServer, socket);
      //mockGameProcess(socket)
    });


  }

  public Start() {
    this.server.listen(this.port, '0.0.0.0');
    console.log(`Server listening on port ${this.port}.`);
  }
}

new App(port).Start();

export default App;
