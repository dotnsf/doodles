//.  app.js
var express = require( 'express' ),
    bodyParser = require( 'body-parser' ),
    cloudantlib = require( '@cloudant/cloudant' ),
    fs = require( 'fs' ),
    i18n = require( 'i18n' ),
    jwt = require( 'jsonwebtoken' ),
    multer = require( 'multer' ),
    OAuth = require( 'oauth' ),
    request = require( 'request' ),
    session = require( 'express-session' ),
    settings = require( './settings' ),
    uuidv1 = require( 'uuid/v1' ),
    app = express();
var RedisStore = require( 'connect-redis' )( session );

//. db
var db = null;
var cloudant = null;
if( settings.db_username && settings.db_password ){
  cloudant = cloudantlib( { account: settings.db_username, password: settings.db_password } );
  if( cloudant ){
    cloudant.db.get( settings.db_name, function( err, body ){
      if( err ){
        if( err.statusCode == 404 ){
          cloudant.db.create( settings.db_name, function( err, body ){
            if( err ){
              db = null;
            }else{
              db = cloudant.db.use( settings.db_name );

              //. query index
              var query_index_username = {
                _id: "_design/username-index",
                language: "query",
                indexes: {
                  "username-index": {
                    index: {
                      fields: [ { name: "username", type: "string" } ]
                    },
                    type: "text"
                  }
                }
              };
              db.insert( query_index_username, function( err, body ){} );
            }
          });
        }else{
          db = cloudant.db.use( settings.db_name );

          //. query index
          var query_index_username = {
            _id: "_design/username-index",
            language: "query",
            indexes: {
              "username-index": {
                index: {
                  fields: [ { name: "username", type: "string" } ]
                },
                type: "text"
              }
            }
          };
          db.insert( query_index_username, function( err, body ){} );
        }
      }else{
        db = cloudant.db.use( settings.db_name );

        //. query index
        var query_index_username = {
          _id: "_design/username-index",
          language: "query",
          indexes: {
            "username-index": {
              index: {
                fields: [ { name: "username", type: "string" } ]
              },
              type: "text"
            }
          }
        };
        db.insert( query_index_username, function( err, body ){} );
      }
    });
  }
}


app.use( express.static( __dirname + '/public' ) );

var store = new RedisStore({
  port: settings.redis_port,
  host: settings.redis_hostname,
  prefix: 'ssid:'
});
app.use( session({
  secret: settings.superSecret,
  resave: false,
  saveUnintialized: false,
  //store: store,
  cookie: {
    path: '/',
    //httpOnly: true,
    secure: false,
    maxage: 1000 * 60 * 60 * 24 * 30  //. 30 days
  }
}));

app.use( multer( { dest: './tmp/' } ).single( 'image' ) );
app.use( bodyParser.urlencoded( { extended: true } ) );
app.use( bodyParser.json() );
app.use( express.Router() );
app.use( express.static( __dirname + '/public' ) );
app.set( 'views', __dirname + '/views' );
app.set( 'view engine', 'ejs' );

//. i18n
i18n.configure({
  locales: ['ja', 'en'],
  directory: __dirname + '/locales'
});
app.use( i18n.init );


//. Twitter API
var oa = new OAuth.OAuth(
  'https://api.twitter.com/oauth/request_token',
  'https://api.twitter.com/oauth/access_token',
  settings.twitter_consumer_key,
  settings.twitter_consumer_secret,
  '1.0A',
  null,
  'HMAC-SHA1'
);

app.get( '/twitter', function( req, res ){
  oa.getOAuthRequestToken( function( err, oauth_token, oauth_token_secret, results ){
    if( err ){
      console.log( err );
      res.redirect( '/' );
    }else{
      req.session.oauth = {};
      req.session.oauth.token = oauth_token;
      req.session.oauth.token_secret = oauth_token_secret;
      res.redirect( 'https://twitter.com/oauth/authenticate?oauth_token=' + oauth_token );
    }
  });
});

app.get( '/twitter/callback', function( req, res ){
  if( req.session.oauth ){
    req.session.oauth.verifier = req.query.oauth_verifier;
    var oauth = req.session.oauth;
    oa.getOAuthAccessToken( oauth.token, oauth.token_secret, oauth.verifier, function( err, oauth_access_token, oauth_access_token_secret, results ){
      if( err ){
        console.log( err );
        res.redirect( '/' );
      }else{
        req.session.oauth.provider = 'twitter';
        req.session.oauth.user_id = results.user_id;
        req.session.oauth.screen_name = results.screen_name;

        var token = jwt.sign( req.session.oauth, settings.superSecret, { expiresIn: '25h' } );
        req.session.token = token;
        res.redirect( '/' );
      }
    });
  }else{
    res.redirect( '/' );
  }
});

app.post( '/logout', function( req, res ){
  req.session.token = null;
  //res.redirect( '/' );
  res.write( JSON.stringify( { status: true }, 2, null ) );
  res.end();
});



app.get( '/', function( req, res ){
  var doodle = null;
  var id = req.query.id ? req.query.id : null;
  if( req.session && req.session.token ){
    var token = req.session.token;
    jwt.verify( token, settings.superSecret, function( err, user ){
      if( err ){
        res.render( 'index', { status: true, user: null, doodle: doodle, id: id } );
      }else{
        if( id ){
          db.get( id, null, function( err, body, header ){
            if( err ){
              res.render( 'index', { status: true, user: user, doodle: doodle, id: id } );
            }else{
              res.render( 'index', { status: true, user: user, doodle: body, id: id } );
            }
          });
        }else{
          res.render( 'index', { status: true, user: user, doodle: doodle, id: id } );
        }
      }
    });
  }else{
    res.render( 'index', { status: true, user: null, doodle: doodle, id: id } );
  }
});

app.get( '/profileimage', function( req, res ){
  var screen_name = req.query.screen_name;
  if( screen_name ){
    var option = {
      url: 'https://twitter.com/' + screen_name + '/profile_image?size=original',
      method: 'GET'
    };
    request( option, ( err0, res0, body0 ) => {
      if( err0 ){
        return res.status( 403 ).send( { status: false, error: err0 } );
      }else{
        res.redirect( 'https://pbs.twimg.com' + res0.request.path );
      }
    });
  }else{
    return res.status( 403 ).send( { status: false, error: 'No screen_name provided.' } );
  }
});

app.get( '/doodles', function( req, res ){
  var doodles = [];
  if( req.session && req.session.token ){
    var token = req.session.token;
    jwt.verify( token, settings.superSecret, function( err, user ){
      var limit = req.query.limit ? parseInt( req.query.limit ) : 0;
      var offset = req.query.offset ? parseInt( req.query.offset ) : 0;

      //. 自分のデータだけを検索
      db.list( { include_docs: true }, function( err, body ){
        if( err ){
          res.render( 'list', { status: true, user: user, doodles: doodles } );
        }else{
          var total = body.total_rows;
          body.rows.forEach( function( doc ){
            var _doc = JSON.parse(JSON.stringify(doc.doc));
            if( _doc && _doc.username == user.screen_name ){
              _doc.timestamp = timestamp2datetime( _doc.timestamp );
              doodles.push( _doc );
            }
          });

          if( offset || limit ){
            if( offset + limit > total ){
              doodles = doodles.slice( offset );
            }else{
              doodles = doodles.slice( offset, offset + limit );
            }
          }

          res.render( 'list', { status: true, user: user, doodles: doodles} );
        }
      });
    });
  }else{
    res.render( 'list', { status: true, user: null, doodles: doodles } );
  }
});

app.get( '/doodle/:id', function( req, res ){
  var id = req.params.id;
  if( id ){
    if( db ){
      db.get( id, null, function( err, body, header ){
        if( err ){
          res.render( 'doodle', { status: false, user: null, doodle: null, error: err } );
        }else{
          //res.render( 'doodle', { status: true, user: null, doodle: body } );
          if( req.session && req.session.token ){
            var token = req.session.token;
            jwt.verify( token, settings.superSecret, function( err, user ){
              if( err ){
                res.render( 'doodle', { status: true, user: null, doodle: body } );
              }else{
                res.render( 'doodle', { status: true, user: user, doodle: body } );
              }
            });
          }else{
            res.render( 'doodle', { status: true, user: null, doodle: body } );
          }
        }
      });
    }else{
      res.render( 'doodle', { status: false, doodle: null, error: 'db is not initialized.' } );
    }
  }else{
    res.render( 'doodle', { status: false, doodle: null, error: 'parameter id needed.' } );
  }
});

app.get( '/image/:id', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var id = req.params.id;
  if( id ){
    if( db ){
      db.attachment.get( id, 'image', function( err, body ){
        if( err ){
          var p = JSON.stringify( { status: false, error: err }, null, 2 );
          res.status( 400 );
          res.write( p );
          res.end();
        }else{
          res.contentType( 'image/png' );
          res.end( body, 'binary' );
        }
      });
    }else{
      var p = JSON.stringify( { status: false, error: 'db is not initialized.' }, null, 2 );
      res.status( 400 );
      res.write( p );
      res.end();
    }
  }else{
    var p = JSON.stringify( { status: false, error: 'parameter id needed.' }, null, 2 );
    res.status( 400 );
    res.write( p );
    res.end();
  }
});

app.post( '/doodle', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  if( db ){
    if( req.session && req.session.token ){
      var token = req.session.token;
      jwt.verify( token, settings.superSecret, function( err, user ){
        if( err ){
          var p = JSON.stringify( { status: false, error: err }, null, 2 );
          res.status( 400 );
          res.write( p );
          res.end();
        }else{
          var imgpath = req.file.path;
          var imgtype = req.file.mimetype;
          //var imgsize = req.file.size;
          var ext = imgtype.split( "/" )[1];
          var imgfilename = req.file.filename;
          var filename = req.file.originalname;

          var doodle_id = uuidv1();
          var img = fs.readFileSync( imgpath );
          var img64 = new Buffer( img ).toString( 'base64' );

          var text = req.body.text ? req.body.text : '';

          var params = {
            _id: doodle_id,
            //filename: filename,
            username: user.screen_name,
            text: text,
            type: 'image',
            timestamp: ( new Date() ).getTime(),
            //name: req.body.name,
            _attachments: {
              image: {
                content_type: imgtype,
                data: img64
              }
            }
          };
          db.insert( params, doodle_id, function( err, body, header ){
            if( err ){
              console.log( err );
              var p = JSON.stringify( { status: false, error: err }, null, 2 );
              res.status( 400 );
              res.write( p );
              res.end();
            }else{
              var p = JSON.stringify( { status: true, id: doodle_id, body: body }, null, 2 );
              res.write( p );
              res.end();
            }
            fs.unlink( imgpath, function( err ){} );
          });
        }
      });
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false, error: 'not logged in.' } ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'db is not initialized.' } ) );
    res.end();
  }
});

app.put( '/doodle/:id', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  if( db ){
    if( req.session && req.session.token ){
      var token = req.session.token;
      jwt.verify( token, settings.superSecret, function( err, user ){
        if( err ){
          var p = JSON.stringify( { status: false, error: err }, null, 2 );
          res.status( 400 );
          res.write( p );
          res.end();
        }else{
          var id = req.params.id;
          if( id ){
            db.get( id, null, function( err, body, header ){
              if( err ){
                var p = JSON.stringify( { status: false, error: err }, null, 2 );
                res.status( 400 );
                res.write( p );
                res.end();
              }else{
                if( body.username == user.screen_name ){
                  if( req.body.text ){
                    body.text = req.body.text;
                  }
                  if( req.file ){
                    var imgpath = req.file.path;
                    var imgtype = req.file.mimetype;
                    var img = fs.readFileSync( imgpath );
                    var img64 = new Buffer( img ).toString( 'base64' );

                    body._attachments = {
                      image: {
                        content_type: imgtype,
                        data: img64
                      }
                    };
                    body.timestamp = ( new Date() ).getTime();

                    db.insert( body, function( err, body ){
                      if( err ){
                        console.log( err );
                        var p = JSON.stringify( { status: false, error: err }, null, 2 );
                        res.status( 400 );
                        res.write( p );
                        res.end();
                      }else{
                        var p = JSON.stringify( { status: true, id: id, body: body }, null, 2 );
                        res.write( p );
                        res.end();
                      }
                      fs.unlink( imgpath, function( err ){} );
                    });
                  }
                }else{
                  var p = JSON.stringify( { status: false, error: 'not owner.' }, null, 2 );
                  res.status( 400 );
                  res.write( p );
                  res.end();
                }
              }
            });
          }else{
            var p = JSON.stringify( { status: false, error: 'parameter id needed.' }, null, 2 );
            res.status( 400 );
            res.write( p );
            res.end();
          }
        }
      });
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false, error: 'not logged in.' } ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'db is not initialized.' } ) );
    res.end();
  }
});

app.delete( '/doodle/:id', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  if( db ){
    if( req.session && req.session.token ){
      var token = req.session.token;
      jwt.verify( token, settings.superSecret, function( err, user ){
        if( err ){
          var p = JSON.stringify( { status: false, error: err }, null, 2 );
          res.status( 400 );
          res.write( p );
          res.end();
        }else{
          var id = req.params.id;
          if( id ){
            db.get( id, null, function( err, body, header ){
              if( err ){
                var p = JSON.stringify( { status: false, error: err }, null, 2 );
                res.status( 400 );
                res.write( p );
                res.end();
              }else{
                if( body.username == user.screen_name ){
                  db.destroy( id, body._rev, function( err, body ){
                    if( err ){
                      res.status( 400 );
                      res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
                      res.end();
                    }else{
                      res.write( JSON.stringify( { status: true }, 2, null ) );
                      res.end();
                    }
                  });
                }else{
                  var p = JSON.stringify( { status: false, error: 'not owner.' }, null, 2 );
                  res.status( 400 );
                  res.write( p );
                  res.end();
                }
              }
            });
          }else{
            var p = JSON.stringify( { status: false, error: 'parameter id needed.' }, null, 2 );
            res.status( 400 );
            res.write( p );
            res.end();
          }
        }
      });
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false, error: 'not logged in.' } ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'db is not initialized.' } ) );
    res.end();
  }
});


function timestamp2datetime( ts ){
  if( ts ){
    var dt = new Date( ts );
    var yyyy = dt.getFullYear();
    var mm = dt.getMonth() + 1;
    var dd = dt.getDate();
    var hh = dt.getHours();
    var nn = dt.getMinutes();
    var ss = dt.getSeconds();
    var datetime = yyyy + '-' + ( mm < 10 ? '0' : '' ) + mm + '-' + ( dd < 10 ? '0' : '' ) + dd
      + ' ' + ( hh < 10 ? '0' : '' ) + hh + ':' + ( nn < 10 ? '0' : '' ) + nn + ':' + ( ss < 10 ? '0' : '' ) + ss;
    return datetime;
  }else{
    return "";
  }
}


var port = process.env.PORT || 3000;
app.listen( port );
console.log( "server starting on " + port + " ..." );
