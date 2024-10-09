$(() => {
  function handler (s) {
    return function () {
      $('div.grid, span').removeClass('active');
      $('div.grid.'+s).addClass('active');
      $(this).addClass('active');
    };
  }
  
  $('body').prepend(
    $('<div/>').addClass('buttons').append(
      $('<span/>').text('grammar').click(handler('grammar')).addClass('active'),
      $('<span/>').text('tokens').click(handler('tokens')),
      $('<span/>').text('actions').click(handler('actions')),
      $('<span/>').addClass('title').text(document.title)
    ),
    $('<div/>').addClass('invis').append(
      $('<span/>').text('grammar'),
      $('<span/>').addClass('title').text(document.title)
    )
  );
  
  $('div.grammar').addClass('active');
})