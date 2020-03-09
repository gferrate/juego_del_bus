import tornado.httpserver
import tornado.websocket
import tornado.ioloop
import tornado.web
from tornado.ioloop import IOLoop
from tornado import gen
from tornado.websocket import websocket_connect
import ssl

import json
import logging

log = logging.getLogger('')


class WSHandler(tornado.websocket.WebSocketHandler):
    rooms = {}

    def check_origin(self, origin):
        return True

    def open(self):
        log.info('Connection to client opened')

    def notify_players_in_room(self, room):
        players = [p['username'] for p in self.rooms[room]]
        msg = json.dumps({'action': 'notify_players', 'players': players})
        for r in self.rooms[room]:
            r['ws'].write_message(msg)

    def on_message(self, message):
        try:
            data = json.loads(message);
            action = data['action']
            room = data['room']
            username = data['username']
            if action == 'create_room':
                if room in self.rooms.keys():
                    raise Exception('Room already exists')
                self.rooms[room] = [{'ws': self, 'username': username}]
            elif action == 'join_room':
                self.rooms[room].append({'ws': self, 'username': username})
                self.notify_players_in_room(room)
            elif action == 'send_message':
                for r in self.rooms[room]:
                    msg = json.dumps({'test': f'Hi, {r["username"]}', 'test3': 333})
                    r['ws'].write_message(msg)
        except Exception as e:
            log.exception(e)

    def on_close(self):
        log.info('Connection with raspberry closed')


if __name__ == "__main__":
    try:
        format = "%(asctime)s: %(message)s"
        logging.basicConfig(
            filename='/var/log/bus/bus.log',
            format=format,
            level=logging.INFO,
            datefmt="%H:%M:%S"
        )
        #ssl_ctx = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
        #ssl_ctx.load_cert_chain(
        #    "/etc/ssl/certs/_wildcard_.bmat.com_2019-2021_good.crt",
        #    "/etc/ssl/private/_wildcard_.bmat.com_2017-2019.key"
        #)
        application = tornado.web.Application([(r'/', WSHandler),])
        http_server = tornado.httpserver.HTTPServer(
            application#, ssl_options=ssl_ctx
        )
        http_server.listen(7777)
        tornado.ioloop.IOLoop.instance().start()
    except Exception as e:
        log.exception(e)
        raise e

