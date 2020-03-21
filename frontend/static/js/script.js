 $(document).ready(function() {
     var username;
     var current_question = 0;
     var room_number;
     var players;
     var last_one_correct;
     var action = null;
     //clubs (♣), diamonds (♦), hearts (♥) and spades (♠),
     var cards = [
         '10C', '10D', '10H', '10S', '2C', '2D', '2H', '2S', '3C', '3D', '3H',
         '3S', '4C', '4D', '4H', '4S', '5C', '5D', '5H', '5S', '6C', '6D', '6H',
         '6S', '7C', '7D', '7H', '7S', '8C', '8D', '8H', '8S', '9C', '9D', '9H',
         '9S', 'AC', 'AD', 'AH', 'AS', 'JC', 'JD', 'JH', 'JS', 'KC', 'KD', 'KH',
         'KS', 'QC', 'QD', 'QH', 'QS'
     ];
     var socket = new WebSocket('ws://192.168.1.129:7777');
     socket.onopen = function() {
         console.log('Connected!');
     };
     socket.onmessage = function(event) {
         let dataReceived = JSON.parse(event.data);
         action = dataReceived.action;
         if (action == 'notify_players') {
             players = dataReceived.players;
             notifyPlayers(dataReceived.players);
         } else if (action == 'show_turn') {
             console.log('show_turn');
             current_question = dataReceived.question_id;
             $('#menu').attr('hidden', true);
             $('#questions').attr('hidden', false);
             $('#answer-0').html(dataReceived.btn_0_text);
             $('#answer-1').html(dataReceived.btn_1_text);
             if (current_question == 0) {
                 showCards(['back']);
             } else if (current_question == 1 || current_question == 2 || current_question == 3) {
                 var cards_to_show = dataReceived.all_cards_seen[dataReceived.turn];
                 cards_to_show.push('back');
                 showCards(cards_to_show);
             }
             msg = dataReceived.msg;
             turn = dataReceived.turn;
             enableButtons();
             $('#question').html('Turno de ' + turn);
             $('#question-2').html(msg);
             if (current_question == 3) {
                 showNButtons(4);
                 $('#answer-2').html(dataReceived.btn_2_text);
                 $('#answer-3').html(dataReceived.btn_3_text);
             } else {
                 showNButtons(2);
             }
             if (turn != username) {
                 disableButtons();
             }
         } else if (action == 'answer_action') {
             console.log('answer_action');
             msg = dataReceived.msg;
             msg_2 = dataReceived.msg_2;
             turn = dataReceived.turn;
             card = dataReceived.card;
             last_one_correct = dataReceived.is_correct;
             hideButtons();
             if (turn == username) {
                 $('#question').html(msg);
                 $('#question-2').html(msg_2 || '');
             } else {
                 $('#question').html(dataReceived.msg_others);
                 $('#question-2').html(dataReceived.msg_others_2);
             }
             var all_cards_seen = dataReceived.all_cards_seen;
             var cards_to_show = all_cards_seen[dataReceived.turn];
             console.log(cards_to_show);
             var id = "#card-" + (cards_to_show.length - 1).toString()
             $(id).removeClass("flip-scale-down-diag-2").addClass("flip-scale-down-diag-2");
             showCards(cards_to_show);
             showNavCards(all_cards_seen[username]);
             if (dataReceived.is_correct) {
                 addPlayersToButtons(dataReceived.players);
             } else {
                 if (turn == username) {
                     showNButtons(1);
                     enableButtons();
                     $('#answer-0').html('Sorbo(s) bebido(s). Continuar');
                 } else {
                     //
                 }
             }
         } else if (action == 'notify_players') {
             players = dataReceived.players;
         } else if (action == 'answered') {
             //pass
         } else if (action == 'notify_sip') {
             console.log('notify_sip');
             msg = dataReceived.msg;
             msg_others = dataReceived.msg_others;
             msg_others_2 = dataReceived.msg_others_2;
             victim = dataReceived.victim;
             hideButtons();
             if (victim == username) {
                 showNButtons(1);
                 $('#answer-0').html(dataReceived.ans);
                 $('#question').html(msg);
                 $('#question-2').html('');
                 enableButtons();
             } else {
                 $('#question').html(msg_others);
                 $('#question-2').html(msg_others_2);
             }
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

     function showNcards(n) {
         if (n == 1) {
             $('#card-0').parent().removeClass('col-6').addClass('col-12');
             $('#card-1').parent().attr('hidden', true);
             $('#card-2').parent().attr('hidden', true);
         } else if (n == 2) {
             $('#card-0').parent().removeClass('col-12').addClass('col-6');
             $('#card-1').parent().removeClass('col-12').addClass('col-6');
             $('#card-1').parent().attr('hidden', false);
         } else if (n == 3) {
             $('#card-0').parent().removeClass('col-12').removeClass('col-6').addClass('col-4');
             $('#card-1').parent().removeClass('col-12').removeClass('col-6').addClass('col-4');
             $('#card-2').parent().removeClass('col-12').removeClass('col-6').addClass('col-4');
             $('#card-0').parent().attr('hidden', false);
             $('#card-1').parent().attr('hidden', false);
             $('#card-2').parent().attr('hidden', false);
         } else if (n == 4) {
             $('#card-0').parent().removeClass('col-12').removeClass('col-6').removeClass('col-4').addClass('col-3');
             $('#card-1').parent().removeClass('col-12').removeClass('col-6').removeClass('col-4').addClass('col-3');
             $('#card-2').parent().removeClass('col-12').removeClass('col-6').removeClass('col-4').addClass('col-3');
             $('#card-3').parent().removeClass('col-12').removeClass('col-6').removeClass('col-4').addClass('col-3');
             $('#card-0').parent().attr('hidden', false);
             $('#card-1').parent().attr('hidden', false);
             $('#card-2').parent().attr('hidden', false);
             $('#card-3').parent().attr('hidden', false);
         }
     }

     function addPlayersToButtons(players) {
         players_filtered = players.filter(e => e !== username);
         hideButtons();
         for (idx in players_filtered) {
             let id = `#answer-${idx}`;
             $(id).html(players_filtered[idx]);
             $(id).attr('hidden', false);
         }
     }

     function showNavCards(cards) {
         for (idx in cards) {
             card = cards[idx];
             let src = `static/img/deck/${card}.png`;
             let id = "#nav-card-" + idx;
             $(id).attr("src", src);
             $(id).attr("hidden", false);
         }
     }

     function showCards(cards) {
         showNcards(cards.length);
         for (idx in cards) {
             card = cards[idx];
             let src = `static/img/deck/${card}.png`;
             let id = "#card-" + idx;
             $(id).attr("src", src);
         }
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

     function toggleAlert(msg){
         $('#alert').html(msg);
         $('#alert').attr('hidden', false);
         $("#alert").fadeTo(2000, 500).slideUp(500, function() {
             $("#alert").slideUp(500);
         });
     }

     function verifyUsername() {
         username = $('#menu-username').val();
         if (username == '') {
             toggleAlert('Nombre de usuario requerido');
             return false
         } else {
             $('#alert').attr('hidden', true);
             return true
         }
     }

     $('#shareWhatsapp').click(function() {
         let text = `Hacemos una partida del juegodelbus.es? El código de sala es: *${room_number}*`;
         let href = "whatsapp://send?text=" + text;
         window.location.href = href;
     });

     $('#menu-create').on('click', function() {
         if (!verifyUsername()) {
             return
         }
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
         if (!verifyUsername()) {
             return
         }
         $('#menu-content-init').attr('hidden', true);
         $('#menu-content-create').attr('hidden', true);
         $('#menu-content-join').attr('hidden', false);
         $('#nav-username').html(username);
     });

     $('#menu-join-btn').click(function() {
         room_number = $('#menu-room-number').val();
         if (room_number == ''){
             toggleAlert('Número de sala requerido')
             return
         }
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
         send({
             'action': 'send_message',
             'msg': 'hahaa'
         })
     });

     $('#answer-0, #answer-1, #answer-2, #answer-3').on('click', function() {
         var button_num = parseInt($(this).attr('id').split('-')[1]);
         if ($(this).hasClass('disabled')) {
             return
         }
         if (current_question == 0 ||
             current_question == 1 ||
             current_question == 2 ||
             current_question == 3) {
             if (action == 'show_turn') {
                 send({
                     'action': 'answer',
                     'question_id': 0,
                     'answer_id': button_num
                 })
             } else if (action == 'answer_action') {
                 if (last_one_correct) {
                     send({
                         'action': 'send_sip',
                         'amount': 1,
                         'to': $(this).html()
                     })
                 } else {
                     send({
                         'action': 'next_question',
                         'last_one_lost': true
                     })
                 }
             } else if (action == 'notify_sip') {
                 send({
                     'action': 'next_question',
                     'last_one_lost': false
                 })
             }
         }
     });
 });
