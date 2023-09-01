const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');
const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

class FilesController {
    async createFile(req, res) {
        try {
            // Check if there are any validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            // Retrieve the user based on the token
            const token = req.headers['x-token'];

	    const userId = await redisClient.get(`auth_${token}`);

	    if (!userId) {
		return res.status(401).json({ error: 'nauthorized' });
	    }
	    
            const user = await getUserByTokenId(userId);


            if (!user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const { name, type, parentId = 0, isPublic = false, data } = req.body;

            // Validate required fields
            if (!name) {
                return res.status(400).json({ error: 'Missing name' });
            }

            if (!type || !['folder', 'file', 'image'].includes(type)) {
                return res.status(400).json({ error: 'Missing type or invalid type' });
            }

            if (type !== 'folder' && !data) {
                return res.status(400).json({ error: 'Missing data' });
            }

            // Validate parentId and ensure it's a folder
            if (parentId !== 0) {
                const parentFile = await dbClient.nbFiles.findOne({ _id: parentId, type: 'folder' });
                if (!parentFile) {
                    return res.status(400).json({ error: 'Parent not found or not a folder' });
                }
            }

            // Save the file to disk
            const fileDirectory = path.join(FOLDER_PATH, uuidv4());
            const fileAbsolutePath = path.join(fileDirectory, name);

            if (type !== 'folder') {
                // Decode Base64 data and save to disk
                const fileDataBuffer = Buffer.from(data, 'base64');
                fs.mkdirSync(fileDirectory, { recursive: true });
                fs.writeFileSync(fileAbsolutePath, fileDataBuffer);
            }

            // Create a new file document in the database
            const newFile = new FileModel({
                userId: user._id,
                name,
                type,
                isPublic,
                parentId,
                localPath: type === 'folder' ? null : fileAbsolutePath,
            });

            await newFile.save();

            return res.status(201).json(newFile);
        } catch (error) {
            console.error('Error creating file:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}

module.exports = new FilesController();
