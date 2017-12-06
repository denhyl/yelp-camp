var express = require("express");
var router  = express.Router();
var Campground = require("../models/campground");
var Comment = require("../models/comment");
var middleware = require("../middleware");
var geocoder = require("geocoder");
var multer = require('multer');
var storage = multer.diskStorage({
  filename: function(req, file, callback) {
    callback(null, Date.now() + file.originalname);
  }
});
var imageFilter = function (req, file, cb) {
    // accept image files only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};
var upload = multer({ storage: storage, fileFilter: imageFilter})

var cloudinary = require('cloudinary');
cloudinary.config({ 
  cloud_name: 'difkemgie', // from your cloudinary dashboard
  api_key: process.env.CLOUDINARY_API_KEY, // environmental variables
  api_secret: process.env.CLOUDINARY_API_SECRET
});


//INDEX - show all campgrounds
router.get("/", function(req, res){
    var noMatch;
  if(req.query.search) {
      const regex = new RegExp(escapeRegex(req.query.search), 'gi'); // g and i are options, g is maybe global, i is maybe case
      // Get all campgrounds from DB
      Campground.find({name: regex}, function(err, allCampgrounds){ // since using name, can just search by title of campground
         if(err){
            console.log(err);
         } else {

             if (allCampgrounds.length < 1) {
                 noMatch = "No campgrounds match that query, please try again.";
             }
            res.render("campgrounds/index",{campgrounds: allCampgrounds, noMatch: noMatch, page: 'campgrounds'});
         }
      });
  } else {
        // Get all campgrounds from DB
        Campground.find({}, function(err, allCampgrounds){
            if(err){
                console.log(err);
            } else {
            res.render("campgrounds/index",{campgrounds: allCampgrounds, noMatch: noMatch, page: 'campgrounds'});
      
         }
    });
  }
});

//CREATE - add new campground to DB
router.post("/", middleware.isLoggedIn, upload.single('image'), function(req, res) {
  cloudinary.uploader.upload(req.file.path, function(result) {
  // get data from form and add to campgrounds array
  var image = result.secure_url;
  var name = req.body.name;
  //var image = req.body.image;
  var description = req.body.description;
  var author = {
      id: req.user._id,
      username: req.user.username
  }
  var cost = req.body.cost;
  geocoder.geocode(req.body.location, function (err, data) {
    var lat = data.results[0].geometry.location.lat;
    var lng = data.results[0].geometry.location.lng;
    var location = data.results[0].formatted_address;
    var newCampground = {name: name, image: image, description: description, cost: cost, author:author, location: location, lat: lat, lng: lng};
    // Create a new campground and save to DB
    Campground.create(newCampground, function(err, newlyCreated){
        if(err){
            //console.log(err);
            req.flash('error', err.message);
            return res.redirect('back');
        } 
        //redirect back to campgrounds page
        //console.log(newlyCreated);
        res.redirect("/campgrounds" + newlyCreated.id);
    });
  });
  });
});


//NEW - show form to create new campground
router.get("/new", middleware.isLoggedIn, function(req, res){
   res.render("campgrounds/new"); 
});

// SHOW - shows more info about one campground
router.get("/:id", function(req, res){
    //find the campground with provided ID
    Campground.findById(req.params.id).populate("comments").exec(function(err, foundCampground){
        if(err || !foundCampground){
            req.flash("error", "Campground not found");
            console.log(err);
            res.redirect("back");
        } else {
            console.log(foundCampground)
            //render show template with that campground
            res.render("campgrounds/show", {campground: foundCampground});
        }
    });
});

// EDIT - shows edit form for a campground
router.get("/:id/edit", middleware.checkUserCampground, function(req, res){
    console.log("IN EDIT!");
    //find the campground with provided ID
    Campground.findById(req.params.id, function(err, foundCampground){
        if(err){
            console.log(err);
        } else {
            //render show template with that campground
            res.render("campgrounds/edit", {campground: foundCampground});
        }
    });
});

// PUT - updates campground in the database
router.put("/:id", function(req, res){
  geocoder.geocode(req.body.location, function (err, data) {
    var lat = data.results[0].geometry.location.lat;
    var lng = data.results[0].geometry.location.lng;
    var location = data.results[0].formatted_address;
    var newData = {name: req.body.name, image: req.body.image, description: req.body.description, cost: req.body.cost, location: location, lat: lat, lng: lng};
    Campground.findByIdAndUpdate(req.params.id, {$set: newData}, function(err, campground){
        if(err){
            req.flash("error", err.message);
            res.redirect("back");
        } else {
            req.flash("success","Successfully Updated!");
            res.redirect("/campgrounds/" + campground._id);
        }
    });
  });
});

// DELETE - removes campground and its comments from the database
router.delete("/:id",middleware.checkUserCampground, function(req, res){
   Campground.findByIdAndRemove(req.params.id, function(err){
      if(err){
          res.redirect("/campgrounds");
      } else {
          req.flash("error", Campground.name + " deleted");
          res.redirect("/campgrounds");
      }
   });
});

// Define escapeRegex function for search feature
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};


//middleware
// function isLoggedIn(req, res, next){
//     if(req.isAuthenticated()){
//         return next();
//     }
//     req.flash("error", "You must be signed in to do that!");
//     res.redirect("/login");
// }

module.exports = router;

