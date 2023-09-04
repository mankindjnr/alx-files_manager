const Bull = require('bull');
const dbClient = require('./utils/db'); // Import your database client
const imageThumbnail = require('image-thumbnail');

const fileQueue = new Bull('fileQueue');

fileQueue.process(async (job) => {
  const { userId, fileId } = job.data;

  if (!fileId) {
    throw new Error('Missing fileId');
  }

  if (!userId) {
    throw new Error('Missing userId');
  }

  // Check if the file exists in the database
  const file = await dbClient.client.db().collection('files').findOne({ _id: fileId, userId });

  if (!file) {
    throw new Error('File not found');
  }

  // Generate thumbnails
  const originalFilePath = file.localPath;
  const thumbnailSizes = [500, 250, 100];
  const promises = thumbnailSizes.map(async (size) => {
    const thumbnail = await imageThumbnail(originalFilePath, { width: size });
    const thumbnailPath = originalFilePath.replace(/\.[^.]+$/, `_${size}$&`);
    await fs.promises.writeFile(thumbnailPath, thumbnail);
  });

  await Promise.all(promises);
});
