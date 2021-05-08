
var moment = require('moment-timezone');

function olinTimeToUTC(dateString) {
  return moment.tz(dateString, 'DD-MM-YYYY HH:mm:ss', 'America/New_York').valueOf();
}

var START_TIME = olinTimeToUTC('12-05-2018 05:27:00');
var END_TIME =   olinTimeToUTC('20-05-2018 12:00:00');

/**
 * Module dependencies.
 */

var express = require('express')
  , http = require('http')
  , path = require('path')
  , mongojs = require('mongojs')
  , session = require('express-session')
  , MongoStore = require('connect-mongo')(session)
  , humanize = require('humanize')
  , cookieParser = require('cookie-parser')
  , bodyParser = require('body-parser')
  , methodOverride = require('method-override')
  , morgan = require('morgan')
  , favicon = require('serve-favicon')

/*
 * Custom utilities
 */
var year = require('./utils/year').getCurrentYear();

var olinAuth = require('./routes/olinAuth');

var app = express(), db;

/* Redirect to https */
app.get('*',function(req, res, next){
  if (process.env.HTTPS_ENABLED && req.headers['x-forwarded-proto']!='https') {
    res.redirect('https://'+req.headers.host+req.url);
  } else {
    next();
  }
});

var router = express.Router();

db = mongojs(process.env.MONGOLAB_URI || 'drinkalytics', ['drinks']);
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'pug');
app.set('secret', process.env.SESSION_SECRET || 'terrible, terrible secret')
app.use(favicon('public/images/favicon.ico'));
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride());
app.use(cookieParser(app.get('secret')));
app.use(session({
  secret: app.get('secret'),
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({
    url: process.env.MONGOLAB_URI || 'mongodb://localhost/drinkalytics'
  })
}));
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Authentication
 */

function isActiveStudent(req, res, next) {
  var user = req.session.user;
  if (!user.isActiveStudent) {
    res.redirect('/');
  } else {
    next();
  }
}

function isStudent(req, res, next) {
  var user = req.session.user;
  if (!user.isStudent) {
    req.session.user = null;
    res.render('login.pug', {
      title: 'Drinkalytics',
      message: "You must be a student to view.",
      user: null
    });
  } else {
    next();
  }
}

/**
 * Routes
 */

function getRankings (req, next) {
  db.drinks.find().sort({'date': 1}, function (err, drinks) {
    var list = {};
    var listtime = {};
    (drinks || []).forEach(function (drink) {
      list[drink.student] || (list[drink.student] = 0);
      list[drink.student] += (drink.servings || 1);
      listtime[drink.student] || (listtime[drink.student] = 0);
      listtime[drink.student] = Math.max(listtime[drink.student], drink.date);
    });
    var rank = Object.keys(list).sort(function (a, b) {
      if (list[b] == list[a]) {
        return listtime[a] - listtime[b];
      }
      return list[b] - list[a];
    }).map(function (a, i) {
      return {
        id: a,
        drinks: list[a],
        dranks: drinks.filter(function (b) {
          return b.student == a
        }),
        rank: i + 1
      };
    })
    next(err, rank);
  });
}

function nameify (str) {
  return str.replace(/\./g, ' ').replace(/\b[a-z]/g, function (letter) {
    return letter.toUpperCase();
  });
}

router.all("*", olinAuth.isAuth, isStudent);

router.get('/', function (req, res) {
  getRankings(req, function (err, stats) {
    var totals = stats.reduce(function (last, next) {
      last.drinks += next.drinks;
      return last;
    }, {drinks: 0});

    res.render('index', {
      student: req.session.user.name,
      isActiveStudent: req.session.user.isActiveStudent,
      year: year,
      nameify: nameify,
      title: 'Drinkalytics',
      stats: stats,
      totals: totals,
      averageneeded: (year - totals.drinks)/(Math.round(Math.abs((END_TIME - new Date().getTime()) / (24*60*60*1000)))*stats.length),
      humanize: humanize,
      START_TIME: START_TIME,
      END_TIME: END_TIME
    });
  });
});

router.get('/drinks/', function (req, res) {
  db.drinks.find('student' in req.query ? {
    student: req.query.student
  } : {}, function (err, drinks) {
    res.render('drinks', {
      student: req.session.user.name,
      nameify: nameify,
      humanize: humanize,
      title: 'Drinkalytics',
      drinks: drinks
    });
  });
});

router.get('/api', function (req, res) {
  res.render('api', {
    student: req.session.user.name,
    nameify: nameify,
    humanize: humanize,
    title: 'API Reference'
  });
});

router.get('/stats', function (req, res) {
  res.render('stats', {
    student: req.session.user.name,
    nameify: nameify,
    humanize: humanize,
    title: 'Stats'
  });
});

router.get('/api/drinks', function (req, res) {
  db.drinks.find('student' in req.query ? {
    student: req.query.student
  } : {}, function (err, drinks) {
    res.json(drinks.map(function (d) {
      delete d._id;
      return d;
    }));
  });
});

router.post('/api/drinks', isActiveStudent, function (req, res) {
  db.drinks.save({
    student: req.session.user.name,
    drink: req.body.drink || 'Vodka',
    details: req.body.details || '',
    servings: req.body.servings && Number(req.body.servings) || 1,
    date: Date.now()
  }, function (err, u) {
    console.log('>>>', err, u);
    if ('redirect' in req.query) {
      res.redirect(req.query.redirect);
    } else {
      res.json({
        error: err,
        drink: u
      })
    }
  });
})

router.get('/api/rankings', function (req, res) {
  getRankings(req, function (err, rank) {
    res.json(rank);
  });
});

router.get('/api/users', function (req, res) {
  getRankings(req, function (err, rank) {
    var list = {};
    rank.forEach(function (a) {
      list[a.id] = a;
    })
    res.json(list);
  });
});

app.use('/', olinAuth);
app.use(router);
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Launch
 */

http.createServer(app).listen(process.env.PORT || 3000, function(){
  console.log("Express server listening on http://" + 3000);
});
