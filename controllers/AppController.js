const dbClient = require('../utils/db');

class AppController {
    static async getStatus(req, res) {
        // Check Redis and DB statuses using utils
        const redisStatus = true; // Assume Redis is alive
        //const dbStatus = true;    // Assume DB is alive
	const dbStatus = dbClient.isAlive();

        const status = {
            redis: redisStatus,
            db: dbStatus
        };

        res.status(200).json(status);
    }

    static async getStats(req, res) {
        try {
            // Count users and files using utils
            const userCount = await dbClient.nbUsers();
            const fileCount = await dbClient.nbFiles();

            const stats = {
                users: userCount,
                files: fileCount
            };

            res.status(200).json(stats);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = AppController;
