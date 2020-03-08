 $(document).ready(function() {
     var username;
     var cards = [
         'ap', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '10p', 'jp', 'qp', 'kp',
         'ac', '2c', '3c', '4c', '5c', '6c', '7c', '8c', '9c', '10c', 'jc', 'qc', 'kc',
         'at', '2t', '3t', '4t', '5t', '6t', '7t', '8t', '9t', '10t', 'jt', 'qt', 'kt',
         'ar', '2r', '3r', '4r', '5r', '6r', '7r', '8r', '9r', '10r', 'jr', 'qr', 'kr',
     ];

     ///    MENU STUFF    ///
     $('#menu-create').on('click', function() {
         username = $('#menu-username').val();
         $('#menu-content-init').attr('hidden', true);
         $('#menu-content-create').attr('hidden', false);
         $('#menu').removeClass('menu-w-1');
         $('#nav-username').html(username);
     });

     $('#menu-join').click(function() {
         $('#menu-content-init').attr('hidden', true);
         $('#menu-content-create').attr('hidden', true);
         $('#menu-content-join').attr('hidden', false);
     });

     $('#menu-start-game').click(function() {
         $('#menu').attr('hidden', true);
     });
     ///    MENU STUFF    ///
     //
     function getRandomCard(){
         return cards[Math.floor(Math.random()*52)]
     }

 });
