$(document).ready(function () {
    var colors = $('option:selected', this).attr('class').split(' ');
    updateColors(colors);

    $('#itemname').on('change', function () {
        var colors = $('option:selected', this).attr('class').split(' ');

        updateColors(colors);
    });
});

function updateColors(colors){
    for(var i = 0; i<colors.length; i++){
        if(colors[i] === '0'){
            colors[i] = '000000';
        }
    }

    $('#color1').attr('value', '#' + colors[0]);
    $('#color2').attr('value', '#' + colors[1]);
    $('#color3').attr('value', '#' + colors[2]);
}