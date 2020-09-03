/* jshint node: true */
/* jshint esnext: true */
'use strict';

var express = require('express');
var app = express();
var path = require('path');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var sql = require('mssql');
var async = require('async');
var fs = require('fs');
var edge = require('edge');
var bcrypt = require('bcrypt');
var itemNames;
var StringEncrypt = edge.func(require('path').join(__dirname, 'StringEncrypt.cs'));
const PORT = 8080;

var config = {
    user: 'sa',
    password: 'root',
    server: 'vindictus',
    database: 'heroes'
};

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded());
app.use(cookieParser());

app.get('/login', home);

app.get('*', function (req, res) {
    res.redirect('/login');
});

app.post('/login', processLogin, home);

app.post('/itempicker', function(req, res) {
    var charname = req.body.charname;

    getCharID(charname, function (charID) {
        buildItemList(charID, function (itemsUpdated) {
            res.render('itempicker', {
                items: itemsUpdated,
                charID: charID,
                error: ""
            });
        });
    });
});

app.post('/colorpicker', function(req, res) {
    var itemID = req.body.itemname;
    var charID = req.body.charID;

    var color1 = req.body.color1,
        color2 = req.body.color2,
        color3 = req.body.color3;

    var dec1 = parseInt(color1.substring(1), 16);
    var dec2 = parseInt(color2.substring(1), 16);
    var dec3 = parseInt(color3.substring(1), 16);

    runDBQuery(itemID, dec1, dec2, dec3, function () {
        buildItemList(charID, function (itemsUpdated) {
            res.render('itempicker', {
                items: itemsUpdated,
                charID: charID,
                error: "Item successfully dyed."
            });
        });
    });
});

fs.readFile('itemnames.json', 'utf8', function (err, data) {
    if (err) {throw err;}
    itemNames = JSON.parse(data);
    console.log(itemNames);
    console.log('Server is running..');
});

app.listen(PORT, function () {
});

function home(req, res){
    var context = req.dataProcessed;

    res.render('login', {
        post: "login",
        curpage: "Dye System",
        error: context
    });
}

function processLogin(req, res, next){
    var accname = req.body.accname;
    var password = req.body.password;

    checkPassword(accname, password, function (result) {
        if(result){
            getAccID(accname, function (accID) {
                getCharnames(accID, function (characters) {
                    res.render('charpicker', {
                        characters: characters,
                        post: "itempicker"
                    });
                });
            });
        } else if (result === null) {
            req.dataProcessed = 'Invalid account name, please try again.';
            return next();
        } else {
            req.dataProcessed = 'Invalid password, please try again.';
            return next();
        }
    });
}

function checkPassword(accname, password, callback){
    if(accname.length > 24){
        accname = accname.substring(0, 24);
    }

    StringEncrypt(password, function (error, result) {
        var hashedpass = result;

        var conn = new sql.ConnectionPool(config);
        conn.connect()
            .then(function () {
                var req = new sql.Request(conn);
                req.input('accountName', sql.VarChar, accname);
                req.query('select * from "User" where Name = @accountName')
                    .then(function (result) {
                        var storedhash = result.recordset[0][Object.keys(result.recordset[0])[6]];
                        conn.close();

                        if(storedhash === hashedpass){
                            callback(true);
                        } else {
                            callback(false);
                        }
                    })
                    .catch(function () {
                        conn.close();
                        callback(null);
                    });
            })
            .catch(function (callback, err) {
                console.log("Connection error: " + err);
                callback(null);
            });
        conn.on('error', err => {
            console.log("An error occurred: " + err);
            callback(null);
        });
    });
}

function getAccID(accname, callback){
    var conn = new sql.ConnectionPool(config);
    conn.connect()
        .then(function () {
            var req = new sql.Request(conn);
            req.input('accountName', sql.VarChar, accname);
            req.query('select * from "User" where Name = @accountName')
                .then(function (result) {
                    var accID = result.recordset[0][Object.keys(result.recordset[0])[0]];
                    conn.close();
                    callback(accID);
                })
                .catch(function (err) {
                    console.log("Query error: " + err);
                    conn.close();
                    callback(null);
                });
        })
        .catch(function (callback, err) {
            console.log("Connection error: " + err);
            callback(null);
        });
    conn.on('error', err => {
        console.log("An error occurred: " + err);
        callback(null);
    });
}

function getCharAcc(charname, callback){
    var conn = new sql.ConnectionPool(config);
    conn.connect()
        .then(function () {
            var req = new sql.Request(conn);
            req.input('charname', sql.VarChar, charname);
            req.query('SELECT * FROM CharacterInfo WHERE Name = @charname')
                .then(function (result) {
                    var accID = result.recordset[0][Object.keys(result.recordset[0])[1]];
                    conn.close();
                    callback(accID);
                })
                .catch(function (err) {
                    console.log("Query error getCharAcc: " + err);
                    conn.close();
                    callback(null);
                });
        })
        .catch(function (callback, err) {
            console.log("Connection error: " + err);
            callback(null);
        });
    conn.on('error', err => {
        console.log("An error occurred: " + err);
        callback(null);
    });
}

function getCharnames(accID, callback){
    var conn = new sql.ConnectionPool(config);
    conn.connect()
        .then(function () {
            var req = new sql.Request(conn);
            req.input('accountID', sql.VarChar, accID);
            req.query('SELECT * FROM CharacterInfo WHERE UID = @accountID')
                .then(function (result) {
                    let characters = [];
                    for(var i = 0; i < Object.keys(result.recordset).length; i++){
                        characters.push({name: result.recordset[i][Object.keys(result.recordset[i])[3]]});
                    }
                    conn.close();
                    callback(characters);
                })
                .catch(function (err) {
                    console.log("Query error: " + err);
                    conn.close();
                    callback(null);
                });
        })
        .catch(function (callback, err) {
            console.log("Connection error: " + err);
            callback(null);
        });
    conn.on('error', err => {
        console.log("An error occurred: " + err);
        callback(null);
    });
}

function getCharID(charname, callback){
    var conn = new sql.ConnectionPool(config);
    conn.connect()
        .then(function () {
            var req = new sql.Request(conn);
            req.input('charname', sql.NVarChar, charname);
            req.query("select * from CharacterInfo where Name = @charname")
                .then(function (result) {
                    var charID = result.recordset[0][Object.keys(result.recordset[0])[0]];
                    conn.close();
                    callback(charID);
                })
                .catch(function (err) {
                    console.log("Query error: " + err);
                    conn.close();
                    callback(null);
                });
        })
        .catch(function (callback, err) {
            console.log("Connection error: " + err);
            callback(null);
        });
    conn.on('error', err => {
        console.log("An error occurred: " + err);
        callback(null);
    });
}

function getItemIDs(charID, callback){
    var conn = new sql.ConnectionPool(config);
    conn.connect()
        .then(function () {
            var req = new sql.Request(conn);
            req.input('characterID', sql.VarChar, charID);
            req.query('SELECT * FROM Item WHERE EXISTS (SELECT * FROM Equippable WHERE Item.ID = Equippable.ID)  AND OwnerID = @characterID')
                .then(function (result) {
                    let items = [];
                    for(var i = 0; i < Object.keys(result.recordset).length; i++){
                        items.push({
                            id: result.recordset[i][Object.keys(result.recordset[i])[0]],
                            name: result.recordset[i][Object.keys(result.recordset[i])[1]]
                        });
                    }
                    conn.close();
                    callback(items);
                })
                .catch(function (err) {
                    console.log("Query error: " + err);
                    conn.close();
                    callback(null);
                });
        })
        .catch(function (callback, err) {
            console.log("Connection error: " + err);
            callback(null);
        });
    conn.on('error', err => {
        console.log("An error occurred: " + err);
        callback(null);
    });
}

function getItemColors(itemID, callback){
    var conn = new sql.ConnectionPool(config);
    conn.connect()
        .then(function () {
            var req = new sql.Request(conn);
            req.input('itemID', sql.VarChar, itemID);
            req.query('SELECT * FROM Equippable WHERE ID = @itemID')
                .then(function (result) {
                    let colors = [];
                    for(var i = 0; i < Object.keys(result.recordset).length; i++){
                        colors.push({
                            color1: result.recordset[i][Object.keys(result.recordset[i])[2]],
                            color2: result.recordset[i][Object.keys(result.recordset[i])[3]],
                            color3: result.recordset[i][Object.keys(result.recordset[i])[4]]
                        });
                    }
                    conn.close();
                    callback(colors);
                })
                .catch(function (err) {
                    console.log("Query error: " + err);
                    conn.close();
                    callback(null);
                });
        })
        .catch(function (callback, err) {
            console.log("Connection error: " + err);
            callback(null);
        });
    conn.on('error', err => {
        console.log("An error occurred: " + err);
        callback(null);
    });
}

function runDBQuery(itemID, dec1, dec2, dec3, callback){
    var queryString = "UPDATE Equippable SET";
    queryString = queryString + " Color1 = " + dec1 + ", Color2 = " + dec2 + ", Color3 = " + dec3;
    queryString = queryString + " WHERE ID = " + itemID;

    var conn = new sql.ConnectionPool(config);
    conn.connect()
        .then(function () {
            var req = new sql.Request(conn);
            req.query(queryString)
                .then(function () {
                    conn.close();
                    callback();
                })
                .catch(function (err) {
                    console.log("Query error: " + err);
                    conn.close();
                    callback(null);
                });
        })
        .catch(function (callback, err) {
            console.log("Connection error: " + err);
            callback(null);
        });
    conn.on('error', err => {
        console.log("An error occurred: " + err);
        callback(null);
    });
}

function buildItemList(charID, callback){
    getItemIDs(charID, function (items) {
        let itemsUpdated = [];

        async.each(items, function (item, callback) {
            getItemColors(item.id, function (colors) {
                colors = colors[0];
                var hex1 = colors.color1.toString(16);
                var hex2 = colors.color2.toString(16);
                var hex3 = colors.color3.toString(16);

                var name;

                if(itemNames[item.name.toUpperCase()] === undefined){
                    name = item.name;
                } else {
                    name = itemNames[item.name.toUpperCase()];
                }

                itemsUpdated.push({
                    id: item.id,
                    name: name,
                    colors: [hex1, hex2, hex3]
                });

                sortByKey(itemsUpdated, 'name');

                callback();
            });
        }, function () {
            callback(itemsUpdated);
        });
    });
}

function sortByKey(array, key) {
    return array.sort(function(a, b) {
        var x = a[key]; var y = b[key];
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
}
