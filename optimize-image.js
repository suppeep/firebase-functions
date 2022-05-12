const { functions, gcs, mkdirp, spawn, path, os, fs } = require('../../admin'); // import packages

exports.optimizeImage = functions.storage.object().onFinalize(object => {
	if (!object.contentType || !object.contentType.startsWith('image/')) {
		console.info(`'${object.name}' is not an image`);
		return null;
	}
  
	const bucket = gcs.bucket(object.bucket);
	const originalFile = bucket.file(object.name);
	const tempFilePath = path.join(os.tmpdir(), object.name);
	const tempFolderPath = path.dirname(tempFilePath);
	let metadata = null;
	const newFileName = 'hi';
	let size;
	let crop;

	originalFile.name = newFileName;

	if (object.contentType === 'image') {
		size = '1500x650^';
		crop = '1500x650+0+0';
	} else {
		size = '200x200^';
		crop = '200x200+0+0';
	}

	return originalFile
		.getMetadata()
		.then(data => {
			if (Array.isArray(data) && data.length > 0 && data[0].metadata) {
				metadata = data[0].metadata;
				if (!metadata.optimized) {
					return Promise.resolve();
				} else {
					return Promise.reject('Image has been already optimized');
				}
			} else {
				return Promise.reject('Invalid metadata response');
			}
		})
		.then(() => mkdirp(tempFolderPath))
		.then(() =>
			originalFile.download({
				destination: tempFilePath,
			})
		)
		.then(() => {
			console.log(`Original file downloaded to ${tempFilePath}`);
			return spawn('convert', [
				tempFilePath,
				'-strip',
				'-sampling-factor',
				'4:2:0',
				'-interlace',
				'Plane',
				'-quality',
				'85',
				tempFilePath,
			]);
		})
		.then(() => {
			console.log(originalFile);
			console.log(`Optimized image converted at ${tempFilePath}`);
			return bucket.upload(tempFilePath, {
				destination: originalFile,
				metadata: {
					// ...metadata,
					cacheControl: 'public,max-age=300',
					optimized: true,
				},
			});
		})
		.then(() => {
			console.log(`Optimized image uploaded at ${newFileName}`);
			fs.unlinkSync(tempFilePath);
		})
		.catch(error => {
			console.error(error);
		});
});
