const dbClient = require('../utils/db');
const { MongoClient } = require('mongodb');
const sha1 = require('sha1');

class UsersController {
    static async postNew(req, res) {
	try {
	    const { email, password } = req.body;

	    if (!email) {
		return res. status(400).json({ error: 'Missing email' });
	    }
	    if (!password) {
		return res.status(400).json({ error: 'Missing password'});
	    }
	    
	    const usersCollection = dbClient.client.db().collection('users');
	    const existingUser = await usersCollection.findOne({ email });

	    if (existingUser) {
		return res.status(400).json({ error: 'Already exists' });
	    }

	    const hashedPassword = sha1(password);
	    
	    const newUser = {
		email,
		password: hashedPassword,
	    };

	    await usersCollection.insertOne(newUser);

	    return res.status(201).json({
		email: newUser.email,
		id: newUser._id,
	    });
	} catch (error) {
	    console.error('Error creating user', error);
	    return res.status(500).json({ error: 'internal server error' });
	}
    }
}

module.exports = UsersController;

