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
import random
from ratelimit import limits
from math import ceil
import operator


class NoCardsLeftException(Exception):
    pass

log = logging.getLogger('')


class Game():

    def __init__(self):
        self.players = []
        self.n_players = 0
        self.sips = {}
        self.turn_number = 0
        self.question_id = None
        self.total_turns = None
        self.turn = None
        self.cards = [
            '10C', '10D', '10H', '10S', '2C', '2D', '2H', '2S', '3C', '3D',
            '3H', '3S', '4C', '4D', '4H', '4S', '5C', '5D', '5H', '5S', '6C',
            '6D', '6H', '6S', '7C', '7D', '7H', '7S', '8C', '8D', '8H', '8S',
            '9C', '9D', '9H', '9S', 'AC', 'AD', 'AH', 'AS', 'JC', 'JD', 'JH',
            'JS', 'KC', 'KD', 'KH', 'KS', 'QC', 'QD', 'QH', 'QS'
        ]
        self._mix_cards()
        self.player_cards = {}
        self.pre_bus_cards = []
        self.pre_bus_sips_sent = {}
        self.pre_bus_players_drunk = []
        self.bus_loser = None
        self.bus_cards = []

    def _set_player_turn(self):
        self.turn = self.players[(self.turn_number - 1) % self.n_players]

    def next_question(self, username, last_one_lost=False):
        if last_one_lost:
            self.sips[username]['received'] += 1 # TODO: fix this
        print('-'*50)
        print(self.turn_number)
        action = None
        if self.turn_number < self.n_players:
            self.question_id = 0
            msg =  '¿Rojo o Negro?',
            btn_0_text = 'ROJO'
            btn_1_text = 'NEGRO'
            btn_2_text = None
            btn_3_text = None
        elif self.turn_number < (2 * self.n_players):
            self.question_id = 1
            msg = '¿Arriba o abajo?'
            btn_0_text = 'ARRIBA'
            btn_1_text = 'ABAJO'
            btn_2_text = None
            btn_3_text = None
        elif self.turn_number < (3 * self.n_players):
            self.question_id = 2
            msg = '¿Entre medio o fuera?',
            btn_0_text = 'ENTRE MEDIO'
            btn_1_text = 'FUERA'
            btn_2_text = None
            btn_3_text = None
        elif self.turn_number < (4 * self.n_players):
            self.question_id = 3
            msg = '¿Palo?'
            btn_0_text = '♣'
            btn_1_text = '♦'
            btn_2_text = '♥'
            btn_3_text = '♠'
        else:
            action = 'start_pre_bus'
            self.question_id = 4
            msg = 'Clasificatoria para el bus'
            btn_0_text = None
            btn_1_text = None
            btn_2_text = None
            btn_3_text = None

        self._set_player_turn()
        to_return = {
            'action': action or 'show_turn',
            'btn_0_text': btn_0_text,
            'btn_1_text': btn_1_text,
            'btn_2_text': btn_2_text,
            'btn_3_text': btn_3_text,
            'turn': self.turn,
            'all_cards_seen': self.player_cards,
            'msg': msg,
            'question_id': self.question_id
        }
        self.turn_number += 1
        return to_return


    def _get_letter_from_card(self, card):
        return card[-1]

    def _pick_random_card(self):
        if not self.remaining_cards:
            raise NoCardsLeftException()
        card = random.choice(self.remaining_cards)
        self.remaining_cards.remove(card)
        return card

    def _get_number_from_card(self, card):
        num = card[:-1]
        cards = {'J': 11, 'Q': 12, 'K': 13, 'A': 14}
        try:
            return cards[num]
        except KeyError:
            return int(num)

    def _is_red(self, card):
        letter = self._get_letter_from_card(card)
        if letter in ('H', 'D'):
            return True
        return False

    def _is_greater(self, username, card):
        num_bef = self._get_number_from_card(self.player_cards[username][-2])
        num_act = self._get_number_from_card(card)
        if num_act == num_bef:
            return 'equal'
        return num_act > num_bef

    def _is_in_between(self, username, card):
        num_2_bef = self._get_number_from_card(self.player_cards[username][-3])
        num_bef = self._get_number_from_card(self.player_cards[username][-2])
        num_act = self._get_number_from_card(card)
        if (num_act == num_bef) or (num_act == num_2_bef):
            return 'equal'
        return (num_2_bef < num_act and num_bef > num_act)

    def _get_num_from_suit(self, card):
        suit = self._get_letter_from_card(card)
        suits = {'C': 0, 'D': 1, 'H': 2, 'S': 3}
        return suits[suit]

    def _answer_is_correct(self, username, answer_id, card):
        if self.question_id == 3:
            num = self._get_num_from_suit(card)
            if answer_id == num:
                return True
            return False
        elif self.question_id == 0:
            condition = self._is_red(card)
        elif self.question_id == 1:
            condition = self._is_greater(username, card)
            if condition == 'equal':
                return False
        elif self.question_id == 2:
            condition = self._is_in_between(username, card)
            if condition == 'equal':
                return False
        if ((condition and answer_id == 0) or
                (not condition and answer_id == 1)):
            return True
        return False

    def answer(self, username, answer_id):
        card = self._pick_random_card()
        self.player_cards[username].append(card)
        is_correct = self._answer_is_correct(username, answer_id, card)
        if is_correct:
            msg = 'Correcto, puedes enviar un sorbo'
            msg_2 = 'A quien le quieres enviar?'
            msg_others = f'Correcto, {self.turn} puede enviar un sorbo'
            msg_others_2 = 'A quien se lo enviará...'
        else:
            msg = 'Incorrecto, bebes un sorbo'
            msg_2 = None
            msg_others = f'Incorrecto, {self.turn} bebe un sorbo'
            msg_others_2 = 'Esperando a que se lo beba...'
        to_return = {
            'action': 'answer_action',
            'card': card,
            'turn': self.turn,
            'all_cards_seen': self.player_cards,
            'is_correct': is_correct,
            'msg': msg,
            'msg_2': msg_2,
            'msg_others': msg_others,
            'msg_others_2': msg_others_2,
            'players': self.players
        }
        return to_return

    def send_sip(self, username, to, amount):
        self.sips[username]['sent'] += amount
        self.sips[to]['received'] += amount
        msg = f'Bebes {amount} sorbo'
        ans = 'Sorbo bebido. Continuar.'
        if amount > 1:
            msg += 's'
            ans = 'Sorbos bebidos. Continuar.'
        to_return = {
            'action': 'notify_sip',
            'victim': to,
            'msg': msg,
            'ans': ans
        }
        return to_return

    def _calculate_pre_bus_sips(self):
        to_send = {}
        for player in self.players:
            prebus_player_cards = self.player_cards[player]
            _round = 0
            to_send[player] = {}
            a = []
            for card in self.pre_bus_cards:
                to_send[player][_round] = 0
                for c in prebus_player_cards:
                    if (self._get_number_from_card(c) ==
                            self._get_number_from_card(card) and (not c in a)):
                        to_send[player][_round] += ceil((_round+1)/2)
                        a.append(c)
                _round += 1

        return to_send

    def _calculate_pre_bus_loser(self):
        # TODO: Classifaction for this
        player_cards_unrevealed = {p: 0 for p in self.players}
        for player in self.players:
            prebus_player_cards = self.player_cards[player]
            prebus_player_numbers = [
                self._get_number_from_card(c) for c in
                self.player_cards[player]
            ]
            for card in self.pre_bus_cards:
                num = self._get_number_from_card(card)
                times = prebus_player_numbers.count(num)
                player_cards_unrevealed[player] += times
                prebus_player_numbers = list(
                    filter(lambda a: a != num, prebus_player_numbers)
                )

        min_ = min(player_cards_unrevealed.values())
        for player, amount in player_cards_unrevealed.items():
            if amount == min_:
                self.bus_loser = player
                return

    def calculate_pre_bus_cards(self):

        for i in range(8):
            card = self._pick_random_card()
            self.pre_bus_cards.append(card)
            self.turn_number += 1

        self._calculate_pre_bus_loser()
        to_return = {
            'action': 'pre_bus_cards',
            'all_cards_seen': self.player_cards,
            'pre_bus_cards': self.pre_bus_cards,
            'sips_to_send': self._calculate_pre_bus_sips()
        }
        return to_return

    def _all_pre_bus_sips_sent(self):
        sent = self.pre_bus_sips_sent.keys()
        for p in self.players:
            if p not in sent:
                return False
        return True

    def _get_missing_pre_bus_sips_players(self):
        sent = self.pre_bus_sips_sent.keys()
        return [p for p in self.players if p not in sent]

    def _fill_pre_bus_sips(self, sips):
        for p in self.players:
            if p not in sips.keys():
                sips[p] = 0
        return sips

    def _get_unified_pre_bus_sips(self):
        unified_sips = {k: 0 for k in self.players}
        for to, sips_dict in self.pre_bus_sips_sent.items():
            for to, n in sips_dict.items():
                unified_sips[to] += n
        return unified_sips

    def _all_players_have_drunk(self):
        for p in self.players:
            if p not in self.pre_bus_players_drunk:
                return False
        return True

    def _get_missing_pre_bus_players_to_drink(self):
        return [p for p in self.players if p not in self.pre_bus_players_drunk]

    def send_pre_bus_sips(self, username, sips):
        sips = self._fill_pre_bus_sips(sips)
        self.pre_bus_sips_sent[username] = sips
        for to, amount in sips.items():
            self.sips[username]['sent'] += amount
            self.sips[to]['received'] += amount
        if self._all_pre_bus_sips_sent():
            unified_sips = self._get_unified_pre_bus_sips()
            return {
                'action': 'drink_pre_bus_sips',
                'unified_sips': self._get_unified_pre_bus_sips()
            }
        else:
            return {
                'action': 'wait_all_pre_bus_sips',
                'missing': self._get_missing_pre_bus_sips_players()
            }

    def pre_bus_sips_drunk(self, username):
        self.pre_bus_players_drunk.append(username)
        if self._all_players_have_drunk():
            return {
                'action': 'pre_bus_all_players_drunk',
                'loser': self.bus_loser
            }
        else:
            return {
                'action': 'pre_bus_waiting_all_players_drink',
                'missing': self._get_missing_pre_bus_players_to_drink()
            }

    def notify_bus_selection(self, username, card_id):
        card = self.bus_cards[-1]
        num = card[:-1]
        if num in ('J', 'Q', 'K', 'A'):
            is_number = False
        else:
            is_number = True
        self.bus_cards.append(self._pick_random_card())
        return {
            'action': 'notify_bus_selection',
            'card': card,
            'is_number': is_number,
            'card_id': card_id
        }

    def _mix_cards(self):
        self.remaining_cards = self.cards

    def next_bus_card(self):
        try:
            card = self._pick_random_card()
        except NoCardsLeftException:
            return self.win(no_cards_left=True)

        self.bus_cards.append(card)
        return {
            'action': 'next_bus_card',
            'loser': self.bus_loser
        }

    def start_bus(self):
        self._mix_cards()
        return self.next_bus_card()

    def notify_incorrect_bus_answer(self, username, sips_to_drink):
        self.sips[self.bus_loser]['received'] += sips_to_drink
        return {
            'action': 'notify_incorrect_bus_answer',
            'sips_to_drink': sips_to_drink,
        }

    #def _get_mvp(self):
    #    return max(stats.items(), key=operator.itemgetter(1))[0]

    def win(self, no_cards_left=False):
        return {
            'action': 'notify_win',
            'stats': self.sips,
            'no_cards_left': no_cards_left
        }

    def add_player(self, username):
        if username in self.players:
            raise Exception('Player already in room')
        self.players.append(username)

    def start(self):
        self.n_players = len(self.players)
        self.sips = {k: {'sent': 0, 'received': 0}  for k in self.players}
        self.player_cards = {k: [] for k in self.players}
        self._set_player_turn()
        self.total_turns = 4 * self.n_players + 6 + 1



class WSHandler(tornado.websocket.WebSocketHandler):
    rooms = {}

    def check_origin(self, origin):
        return True

    def open(self):
        log.info('Connection to client opened')

    #@limits(calls=1000, period=1)
    def notify_players_in_room(self, room, msg='test'):
        print(msg)
        if msg == 'test':
            players = [p['username'] for p in self.rooms[room]['players']]
            msg = json.dumps({'action': 'notify_players', 'players': players})
            for r in self.rooms[room]['players']:
                r['ws'].write_message(msg)
        else:
            for r in self.rooms[room]['players']:
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
                self.rooms[room] = {
                    'game': Game(),
                    'players': [{'ws': self, 'username': username}]
                }
                self.rooms[room]['game'].add_player(username)
            elif action == 'join_room':
                self.rooms[room]['players'].append(
                    {'ws': self, 'username': username}
                )
                self.notify_players_in_room(room)
                self.rooms[room]['game'].add_player(username)
            elif action == 'send_message':
                for r in self.rooms[room]['players']:
                    msg = json.dumps(data['msg'])
                    r['ws'].write_message(room, msg)
            elif action == 'start_game':
                self.rooms[room]['game'].start()
                self.notify_players_in_room(
                    room,
                    self.rooms[room]['game'].next_question(username)
                )
            elif action == 'answer':
                self.notify_players_in_room(
                    room,
                    self.rooms[room]['game'].answer(
                        username, data['answer_id']
                    )
                )
            elif action == 'next_question':
                self.notify_players_in_room(
                    room,
                    self.rooms[room]['game'].next_question(
                        username, last_one_lost=data['last_one_lost']
                    )
                )
            elif action == 'send_sip':
                self.notify_players_in_room(
                    room,
                    self.rooms[room]['game'].send_sip(
                        username, data['to'], data['amount']
                    )
                )
            elif action == 'pre_bus_cards':
                if self.rooms[room]['game'].pre_bus_cards:
                    return
                self.notify_players_in_room(
                    room,
                    self.rooms[room]['game'].calculate_pre_bus_cards()
                )

            elif action == 'send_pre_bus_sips':
                self.notify_players_in_room(
                    room,
                    self.rooms[room]['game'].send_pre_bus_sips(
                        username, data['sips']
                    )
                )
            elif action == 'pre_bus_sips_drunk':
                self.notify_players_in_room(
                    room, self.rooms[room]['game'].pre_bus_sips_drunk(username)
                )
            elif action == 'start_bus':
                self.notify_players_in_room(
                    room, self.rooms[room]['game'].start_bus()
                )
            elif action == 'notify_bus_selection':
                self.notify_players_in_room(
                    room, self.rooms[room]['game'].notify_bus_selection(
                        username, data['card_id']
                    )
                )
            elif action == 'notify_incorrect_bus_answer':
                self.notify_players_in_room(
                    room, self.rooms[room]['game'].notify_incorrect_bus_answer(
                        username, data['sips_to_drink']
                    )
                )
            elif action == 'bus_sips_drunk':
                self.notify_players_in_room(
                    room, self.rooms[room]['game'].next_bus_card()
                )

            elif action == 'win':
                self.notify_players_in_room(
                    room, self.rooms[room]['game'].win()
                )

        except Exception as e:
            print('\n\nERROR')
            print(e)
            print('\n\n')
            log.exception(e)
            raise

    def on_close(self):
        log.info('Connection closed')


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
        #    "/etc/ssl/certs/cert.crt",
        #    "/etc/ssl/private/key.key"
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

