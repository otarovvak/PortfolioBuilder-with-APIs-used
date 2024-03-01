const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const path = require("path");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const { Chart } = require('chart.js');

const User = require("./models/User");
const multer = require("multer");
const Post = require("./models/Post.js");
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.use(express.static(__dirname));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

mongoose.connect("mongodb://localhost:27017/Portfolio");
const db = mongoose.connection;

db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", function () {
  console.log("Connected to MongoDB");
});
const store = new MongoDBStore({
  uri: "mongodb://localhost:27017/Portfolio",
  collection: "session",
});
store.on("error", function (error) {
  console.log(error);
});

app.use(session({
    secret: 'Nazar',
    resave: false,
    saveUninitialized: true,
    store: store
}));
app.get("/main", async (req, res) => {
  try {
    const retrievedData = await User.find();
    res.render('main', { data: retrievedData, user: req.session.user }); 
  } catch (error) {
    console.error('Error retrieving data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
});
app.get("/main", (req, res) => {
  res.render("main");
});
app.post('/language', (req, res) => {
  const newLang = req.body.lang; 
  req.session.lang = newLang;
  res.redirect('/admin'); 
});
app.post("/register", async (req, res) => {
  const { username, email, password, age, country, gender, yearsOfWorking } =
    req.body;

  try {
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: "Username is already taken" });
    }

    const newUser = new User({
      username,
      email,
      password,
      age,
      country,
      gender,
      yearsOfWorking,
    });

    await newUser.save();

    res.redirect("/login"); 
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email: email }).exec();

    if (user) {
      const isPasswordMatch = await bcrypt.compare(password, user.password);
      if (isPasswordMatch) {
        console.log("Login Successful");
        req.session.user = user;
        console.log("Session data:", req.session)
        return res.redirect(`/profile/${user._id}`);
      } else {
        console.log("Invalid Password");
        return res.status(401).send("Invalid login credentials");
      }
    } else {
      console.log("User not found");
      return res.status(401).send("Invalid login credentials");
    }
  } catch (err) {
    console.error(err);
    return res.status(500).send("Internal Server Error");
  }
});



  
  app.get("/admin", async (req, res) => {
    try {
      if (!req.session.user) {
        res.redirect("/login");
        return;
      }
      const user = req.session.user;
      const posts = await Post.find();
      const lang = req.session.lang || 'en'; 
      res.render('admin', { session: req.session, posts: posts, lang: lang, user: req.session.user });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Something went wrong" });
    }
  });
  app.post('/post/edit/:id', upload.array('images', 3), async (req, res) => {
    const id = req.params.id;
    const { title, description, names, descriptions } = req.body;
    
    
    let img = [];
    for (let i = 0; i < req.files.length; i++) {
        img.push(req.files[i].path);
    }

    try {
      const updatedPost = await Post.findByIdAndUpdate(id, {
        images: img,
        title: title,
        description: description,
        names: JSON.parse(names),
        descriptions: JSON.parse(descriptions)
      }, { new: true });
      
      if (!updatedPost) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      res.redirect('/admin');
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong' });
    }
});

  // DELETE /post/:id
  app.get('/post/delete/:id', async (req, res) => {
    const id = req.params.id;
  
    try {
      const deletedPost = await Post.findByIdAndDelete(id);
      if (!deletedPost) {
        return res.status(404).json({ error: 'Post not found' });
      }
      res.redirect('/admin');
      return;
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong' });
    }
  });
  app.post('/post/add', upload.array('images', 3), async (req, res) => {
    try {
      if (!req.session.user) {
        return res.status(401).send("Unauthorized");
      }
      
      const user = await User.findById(req.session.user._id).exec();
      if (!user || user.role !== "admin") {
        return res.status(403).send("Forbidden");
      }
  
      const { names, descriptions } = req.body;
      const images = req.files.map(file => file.path);
      const userId = new mongoose.Types.ObjectId(req.session.user._id);
      // Create a new portfolio item
      const post = new Post({
        userId,
        images,
        names: JSON.parse(names),
        descriptions: JSON.parse(descriptions)
      });
  
      await post.save();
      const posts = await Post.find();
      const lang = req.session.lang || 'en'; 
      res.redirect('/admin')

    } catch (error) {
      console.error("Error adding portfolio item:", error);
      res.status(500).send("Internal Server Error");
    }
  });
   
  app.get("/profile/:userId", async (req, res) => {
    const userId = req.params.userId;

    try {
        const user = await User.findById(userId).exec();
        if (!user) {
            return res.status(404).send("User not found");
        }

        const currentUser = req.user;

        return res.render('profile', { user: user, currentUser: currentUser });
    } catch (err) {
        console.error(err);
        return res.status(500).send("Internal Server Error");
    }

});
const axios = require('axios');
const { log } = require("console");

function renderChart(top10Titles, top10Prices) {
  const canvasRender = `<canvas id="myChart" width="200" height="200"></canvas>`;
  const scriptRender = `
    <script>
      var ctx = document.getElementById('myChart').getContext('2d');
      var myChart = new Chart(ctx, {
        type: 'bar', // Use 'bar' instead of 'horizontalBar'
        data: {
          labels: ${JSON.stringify(top10Titles)},
          datasets: [{
            label: 'Price ($)',
            data: ${JSON.stringify(top10Prices)},
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
          }]
        },
        options: {
          scales: {
            yAxes: [{
              ticks: {
                beginAtZero: true
              }
            }]
          }
        }
      });
    </script>
  `;
  return canvasRender + scriptRender;
}

app.get('/api1', (req, res) => {
  axios.get('https://api.itbook.store/1.0/new')
    .then(response => {
      const data = response.data.books;

      const bookTitles = data.map(book => book.title);
      const bookPrices = data.map(book => parseFloat(book.price.replace('$', '').replace(',', '')));

      const books = bookTitles.map((title, index) => ({
        title,
        price: bookPrices[index]
      }));

      const top10ExpensiveBooks = books.sort((a, b) => b.price - a.price).slice(0, 10);

      const top10Titles = top10ExpensiveBooks.map(book => book.title);
      const top10Prices = top10ExpensiveBooks.map(book => book.price);

      res.render('API1', {
        title: 'Top 10 Most Expensive Books',
        top10Titles: top10Titles,
        top10Prices: top10Prices,
        renderChart: renderChart,
        user: req.session.user
      });
    })
    .catch(error => {
      console.error('Error fetching data:', error);
      res.status(500).send('Error fetching data');
    });
});
function generateChartScript(movieData) {
  const titles = movieData.map(movie => movie.movie);
  const ratings = movieData.map(movie => movie.rating);

  const script = `
  <script>
    var ctx = document.getElementById('myChart').getContext('2d');
    var myChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(titles)},
        datasets: [{
          label: 'Rating',
          data: ${JSON.stringify(ratings)},
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: {
        scales: {
          yAxes: [{
            ticks: {
              beginAtZero: true
            }
          }]
        }
      }
    });
    </script>
  `;

  return script;
}

app.get('/api2', (req, res) => {
  axios.get('https://dummyapi.online/api/movies')
    .then(response => {
      const movieData = response.data;
      console.log(movieData);
      const chartScript = generateChartScript(movieData);

      res.render('API2', {
        movieData: movieData,
        generateChartScript: generateChartScript,
        user: req.session.user
      });
    })
    .catch(error => {
      console.error('Error fetching data:', error);
      res.status(500).send('Error fetching data');
    });
});

function renderMoviesChart(movieTitles, moviePopularity) {
  const canvasRender = `<canvas id="myChart" width="800" height="400"></canvas>`;
  const scriptRender = `
    <script>
      var ctx = document.getElementById('myChart').getContext('2d');
      var myChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ${JSON.stringify(movieTitles)},
          datasets: [{
            label: 'Popularity',
            data: ${JSON.stringify(moviePopularity)},
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
          }]
        },
        options: {
          scales: {
            yAxes: [{
              ticks: {
                beginAtZero: true
              }
            }]
          }
        }
      });
    </script>
  `;
  return canvasRender + scriptRender;
}

app.get('/api3', (req, res) => {
  axios.get('https://api.themoviedb.org/3/trending/movie/week?language=en-US', {
    headers: {
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2Yjg1ZDM4ZmJjY2ZjZmExYTJkNDVkODdkYzUxZGQ0OSIsInN1YiI6IjY1NTVkY2MxNTM4NjZlMDBlMjkzMWQ4YiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.Ob5d2duWLBvtJQDwv_zRZfKOO3CtBartErco3uu1Kf0'
    }
  })
  .then(response => {
    const movies = response.data.results;

    const movieTitles = movies.map(movie => movie.title);
    const moviePopularity = movies.map(movie => movie.popularity);

    res.render('API3', {
      title: 'Trending Movies',
      movieTitles: movieTitles,
      moviePopularity: moviePopularity,
      renderMoviesChart: renderMoviesChart,
      user: req.session.user 
    });
  })
  .catch(error => {
    console.error('Error fetching data:', error);
    res.status(500).send('Error fetching data');
  });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
