const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

const router = express.Router();
const storagePath = process.env.FOLDER_PATH || '/tmp/files_manager';

if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
}
// Multer storage configuration
const storage = multer.diskStorage({
  destination: storagePath,
  filename: (req, file, cb) => {
    const uniqueFilename = uuidv4();
    cb(null, uniqueFilename);
  },
});

const upload = multer({ storage });

// POST /files endpoint
// POST /files endpoint with token validation logic included
class FilesController{
    static async postUpload(req, res) {
	try {
	    // Extract the token from the request header
	    const token = req.header('X-Token');

	    // Your token validation logic here
	    if (!token) {
		return res.status(401).json({ error: 'Unauthorized' });
	    }

	    // Verify the token (you need to implement this part)
	    // If the token is valid, extract the user ID from it
	    const userId = await redisClient.get(`auth_${token}`);

	    if (!userId) {
		return res.status(401).json({ error: 'Unauthorized' });
	    }

	    console.log(userId);
	    // Check for other request parameters (name, type, parentId, isPublic)
	    const { name, type, parentId, data, isPublic } = req.body;

	    // Check for missing name and type
	    if (!name) {
		return res.status(400).json({ error: 'Missing name' });
	    }
	    
	    if (!type || !['folder', 'file', 'image'].includes(type)) {
		return res.status(400).json({ error: 'Missing type or invalid type' });
	    }

	    if (type !== 'folder' && !req.body.data) {
		return res.status(400).json({ error: 'Missing data' });
	    }

	    // Prepare the new file document
	    const newFile = {
		userId,
		name,
		type,
		isPublic: !!isPublic,
		parentId: parentId || '0', // Default to 0 if parentId is not provided
	    };

	    if (type === 'file' || type === 'image') {
		newFile.data = req.body.data;
	    }

	    if (type === "folder") {
		const result = await dbClient.client.db().collection('files').insertOne(newFile);
		return res.status(201).json(result.ops[0]);
	    }

	    // If it's a file or image, store it locally and set localPath
	    if (type === 'file' || type === 'image') {
		const { data } = req.body;
		if (!data) {
		    return res.status(400).json({ error: "Missing data" });
		}
		const fileData = Buffer.from(data, 'base64');

		const uniqueFilename = uuidv4();
		
		const localPath = `${storagePath}/${uniqueFilename}`;

		fs.writeFileSync(localPath, fileData);
		
		newFile.localPath = localPath;
	    }

	    // Insert the new file document into the collection
	    const result = await dbClient.client.db().collection('files').insertOne(newFile);
	    
	    // Return the new file document with a status code 201
	    return res.status(201).json(result.ops[0]);
	} catch (error) {
	    console.error('Error creating file:', error);
	    return res.status(500).json({ error: 'Internal server error' });
	}
    }

    static async getShow(req, res) {
	try {
	    const token = req.header('X-Token');

	    if (!token) {
		return res.status(401).json({ error: 'Unauthorized - token missing' });
	    }

	    const userId = await redisClient.get(`auth_${token}`);

	    if (!userId) {
		return res.status(401).json({ error: 'Unauthorized token' });
	    }

	    const { id } = req.params;

	    const file = await dbClient.client.db().collection('files').findOne({
		_id: ObjectId(id),
		userId: userId,
	    });

	    if (!file) {
		return res.status(404).json({ error: 'Not Fount' });
	    }

	    return res.status(200).json(file);
	} catch (error) {
	    console.error('Error retrieving file by id:', error);
	    return res.status(500).json({ error: 'Internal server error' });
	}
    }


    static async getIndex(req, res) {
	try {
	    const token = req.header('X-Token');

	    if (!token) {
		return res.status(401).json({ error: 'Unauthorized - token missing' });
	    }

	    const userId = await redisClient.get(`auth_${token}`);

	    const { parentId = '0', page = 0 } = req.query;

	    const pageNumber = parseInt(page, 10);

	    const itemsToSkip = pageNumber * 20;

	    const pipeline = [
		{
		    $match: {
			userId: userId,
			parentId: parentId,
		    },
		},
		{
		    $skip: itemsToSkip,
		},
		{
		    $limit: 20,
		},
	    ];

	    const files = dbClient.client
		  .db()
		  .collection('files')
		  .aggregate(pipeline)
		  .toArray();

	    return res.status(200).json(files);
	} catch (error) {
	    console.error('Error retrieving files by parentId:', error);
	    return res.status(500).json({ error: 'Internal server error' });
	}
    }

    static async putPublish(req, res) {
	try {
	    const token = req.header('X-Token');

	    if (!token) {
		return res.status(401).json({ error: 'Unauthroized - missing token' });
	    }

	    const userId = await redisClient.get(`auth_${token}`);

	    const { id } = req.params;

	    const filter = {
		_id: ObjectId(id),
		userId: userId,
	    };

	    const update = {
		$set: {
		    isPublic: true,
		},
	    };

	    const updatedFile = await dbClient.client
		  .db()
		  .collection('files')
		  .findOneAndUpdate(filter, update, { returnOriginal: false });

	    if (!updatedFile.value) {
		return res.status(404).json({ error: 'Not found' });
	    }

	    return res.status(200).json(updatedFile.value);
	} catch (error) {
	    console.error('Error publishing file id:', error);
	    return res.status(500).json({ error: 'Internal server error' });
	}
    }

    static async putUnpublish(req, res) {
	try {
	    const token = req.header('X-Token');

	    if (!token) {
		return res.status(401).json({ error: 'Unauthorized - missing token' });
	    }

	    const userId = await redisClient.get(`auth_${token}`);

	    const { id } = req.params;

	    const filter = {
		_id: ObjectId(id),
		userId: userId,
	    };

	    const update = {
		$set: {
		    isPublic: false,
		},
	    };

	    const updatedFile = await dbClient.client
		  .db()
		  .collection('files')
		  .findOneAndUpdate(filter, update, { returnOriginal: false });

	    if (!updatedFile.value) {
		return res.status(404).json({ error: 'Not found' });
	    }

	    return res.status(200).json(updatedFile.value);
	} catch (error) {
	    console.error('Error unpublishing file by Id:', error);
	    return res.status(500).json({ error: 'internal server error' });
	}
    }
}
module.exports = FilesController;
