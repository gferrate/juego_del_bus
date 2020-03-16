 $(document).ready(function() {
     var username;
     var current_question = 0;
     var room_number;
     var players;
     var status = 'not_answered'
     //clubs (♣), diamonds (♦), hearts (♥) and spades (♠),
     var cards = [
         '10C', '10D', '10H', '10S', '2C', '2D', '2H', '2S', '3C', '3D', '3H',
         '3S', '4C', '4D', '4H', '4S', '5C', '5D', '5H', '5S', '6C', '6D', '6H',
         '6S', '7C', '7D', '7H', '7S', '8C', '8D', '8H', '8S', '9C', '9D', '9H',
         '9S', 'AC', 'AD', 'AH', 'AS', 'JC', 'JD', 'JH', 'JS', 'KC', 'KD', 'KH',
         'KS', 'QC', 'QD', 'QH', 'QS'
     ];
     var socket = new WebSocket('ws://192.168.1.130:7777');
     socket.onopen = function() {
         console.log('Connected!');
     };
     socket.onmessage = function(event) {
         let dataReceived = JSON.parse(event.data);
         console.log(dataReceived);
         action = dataReceived.action;
         if (action == 'notify_players') {
             players = dataReceived.players;
             notifyPlayers(dataReceived.players);
         } else if (action == 'show_turn') {
             $('#menu').attr('hidden', true);
             $('#questions').attr('hidden', false);
             $('#answer-0').html(dataReceived.btn_0_text);
             $('#answer-1').html(dataReceived.btn_1_text);
             showCard('back');
             msg = dataReceived.msg;
             turn = dataReceived.turn;
             enableButtons();
             $('#question').html('Turno de ' + turn);
             $('#question-2').html(msg);
             showNButtons(2);
             if (turn != username) {
                 disableButtons();
             }
         } else if (action == 'answer_action') {
             msg = dataReceived.msg;
             msg_2 = dataReceived.msg_2;
             turn = dataReceived.turn;
             card = dataReceived.card;
             hideButtons();
             if (turn == username) {
                 $('#question').html('Continuar');
             }
             $('#question').html(msg);
             $('#question-2').html(msg_2 || '');
             document.querySelector("#card").classList.toggle("flip-scale-down-diag-2")
             showCard(card);
             addPlayersToButtons(dataReceived.players);
             status = 'answered'
         } else if (action == 'notify_players') {
             players = dataReceived.players;
         } else if (action == 'answered') {
             //pass
         } else if (action == 'notify_sip') {
             showNButtons(1);
             disableButtons();
             msg = dataReceived.msg;
             victim = dataReceived.victim;
             if (victim == username) {
                 $('#answer-0').html('Continuar');
                 enableButtons();
             }
             $('#question').html(msg);
             $('#question-2').html('');
             status = 'sip_send';
         }
     };
     socket.onclose = function() {
         console.log('Lost connection!');
     };
     socket.onerror = function() {
         console.log('error');
     };

     function send(msg) {
         msg['room'] = room_number
         msg['username'] = username
         socket.send(JSON.stringify(msg));
     }

     function disableButtons() {
         $("#answer-0").addClass('disabled');
         $("#answer-1").addClass('disabled');
         $("#answer-2").addClass('disabled');
         $("#answer-3").addClass('disabled');
         $("#answer-4").addClass('disabled');
         $("#answer-5").addClass('disabled');
     }

     function enableButtons() {
         $("#answer-0").removeClass('disabled');
         $("#answer-1").removeClass('disabled');
         $("#answer-2").removeClass('disabled');
         $("#answer-3").removeClass('disabled');
         $("#answer-4").removeClass('disabled');
         $("#answer-5").removeClass('disabled');
     }

     function hideButtons() {
         $("#answer-0").attr('hidden', true);
         $("#answer-1").attr('hidden', true);
         $("#answer-2").attr('hidden', true);
         $("#answer-3").attr('hidden', true);
         $("#answer-4").attr('hidden', true);
         $("#answer-5").attr('hidden', true);
     }

     function showButtons() {
         $("#answer-0").attr('hidden', false);
         $("#answer-1").attr('hidden', false);
         $("#answer-2").attr('hidden', false);
         $("#answer-3").attr('hidden', false);
         $("#answer-4").attr('hidden', false);
         $("#answer-5").attr('hidden', false);
     }

     function showNButtons(n) {
         hideButtons();
         for (let idx = 0; idx < n; idx++) {
             var id = `#answer-${idx}`;
             $(id).attr('hidden', false);
         }
     }

     function enableButton(id) {
         $(id).attr('hidden', false);
     }

     function addPlayersToButtons(players) {
         players_filtered = players.filter(e => e !== username);
         hideButtons();
         for (idx in players_filtered) {
             let id = `#answer-${idx}`;
             $(id).html(players[idx]);
             $(id).attr('hidden', false);
         }
     }

     function showCard(card) {
         src = `static/img/deck/${card}.png`;
         $("#card").attr("src", src);
     }

     function getRandomCard() {
         return cards[Math.floor(Math.random() * 52)]
     }

     function notifyPlayers(players) {
         $('#players-in-room').html('Jugadores: ' + players.join(', '));
     }

     function generateRandomCode() {
         var code = '';
         for (j = 0; j < 6; j++) {
             code += Math.floor(Math.random() * 9).toString();
         }
         return code;
     }

     $('#menu-create').on('click', function() {
         username = $('#menu-username').val();
         room_number = generateRandomCode();
         $('#menu-content-init').attr('hidden', true);
         $('#code').html(room_number);
         $('#menu-content-create').attr('hidden', false);
         $('#menu').removeClass('menu-w-1');
         $('#nav-username').html(username);
         socket.send(JSON.stringify({
             'action': 'create_room',
             'room': room_number,
             'username': username
         }));
     });

     $('#menu-join').click(function() {
         username = $('#menu-username').val();
         $('#menu-content-init').attr('hidden', true);
         $('#menu-content-create').attr('hidden', true);
         $('#menu-content-join').attr('hidden', false);
         $('#nav-username').html(username);
     });

     $('#menu-join-btn').click(function() {
         room_number = $('#menu-room-number').val();
         $('#menu').attr('hidden', true);
         socket.send(JSON.stringify({
             'action': 'join_room',
             'room': room_number,
             'username': username
         }));
     });

     $('#menu-start-game').click(function() {
         $('#menu').attr('hidden', true);
         send({
             'action': 'start_game'
         });
     });

     $('#test').click(function() {
         socket.send(JSON.stringify({
             'action': 'send_message',
             'room': room_number,
             'username': username
         }));
     });

     $('#answer-0').on('click', function() {
         if ($(this).hasClass('disabled')) {
             return
         }
         if (current_question == 0) {
             if (status == 'not_answered') {
                 send({
                     'action': 'answer',
                     'question_id': 0,
                     'answer_id': 0 // BLACK
                 })
             } else if (status == 'answered') {
                 send({
                     'action': 'send_sip',
                     'amount': 1,
                     'to': $(this).html()
                 })
                 status = 'sip_send';
             } else if (status == 'sip_send') {
                 send({
                     'action': 'next_question'
                 })
                 status = 'not_answered';
             }
         }
     });

     $('#answer-1').on('click', function() {
         if ($(this).hasClass('disabled')) {
             return
         }
         if (current_question == 0) {
             if (status == 'not_answered') {
                 send({
                     'action': 'answer',
                     'question_id': 0,
                     'answer_id': 1 // BLACK
                 })
             } else if (status == 'answered') {
                 send({
                     'action': 'send_sip',
                     'to': $(this).html(),
                     'amount': 1
                 })
                 status = 'sip_send';
             } else if (status == 'sip_send') {
                 //
             } else {
                 send({
                     'action': 'next_question'
                 })
                 status = 'not_answered';
             }
         }
     });
 });
