$(function () {
  $('input[type="reset"]').on('click', function () {
    $(this).closest('.position').find('input[type="checkbox"]').prop('checked', false).removeAttr('checked');
    // return false;
  })
})