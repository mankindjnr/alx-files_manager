const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;
const path = require('path');

const routes = require("./routes/index");

const dbClient = require("./utils/db");

app.use(async (req, res, next) => {
    if (!dbClient.isAlive()) {
	try {
	    await dbClient.connect();
	} catch (error) {
	    console.error('Error connecting to database:', error);
	    return res.status(500).send('Internal server Error');
	}
    }
    next();
});

app.use("/", routes);

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
