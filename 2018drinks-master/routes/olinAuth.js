var express = require("express");
var request = require("request");
var olin = require("../olin");

var year = require('./../utils/year').getCurrentYear();

var router = express.Router();
router.get("/login", function(req, res) {
  res.render('login.pug', {
    title: 'Drinkalytics',
    user: req.session.user ? req.session.user.name : null
  });
})

router.get("/logout", function(req, res) {
  req.session.user = null;
  res.redirect("/");
})

router.post("/login", function(req, res) {
  var redirectUrl = req.query.redirect;
  if (!redirectUrl || redirectUrl === "undefined") {
    redirectUrl = "/"
  }

  var username = req.body.username;
  var pass = req.body.password;
  olin.networkLogin(username, pass, function(err, user) {
    if (err || user == undefined) {
      return res.render('login.pug', {
        title: 'Drinkalytics',
        message: err,
        user: null
      });
    }

    var name = user.mailbox.name;
    var email = user.mailbox.email_address.toLowerCase();

    // Check if the user is a student by checking 'job_title'
    var isStudent = false;
    if (user.contact.job_title.indexOf('Class of ') > -1) {
      isStudent = true;
    }

    // Check if user is member of current class by checking mailing list
    olin.isMemberOfClass(username, pass, email, year, function(err, isMember) {
      if (err) {
        console.log(err);
      }

      req.session.user = {
        name: name,
        email: email,
        isStudent: isStudent,
        isActiveStudent: isMember
      };

      res.redirect(redirectUrl);
    });
  });

});

router.isAuth = function(req, res, next) {
  if (req.session.user) {
    return next();
  }
  res.redirect("/login?req="+req.originalUrl);
}

module.exports = router;
