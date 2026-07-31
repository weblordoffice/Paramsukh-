
import { BaseProvider } from '@adminjs/upload';
import { v2 as cloudinary } from 'cloudinary';
import { promises as fs } from 'fs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

export class CloudinaryProvider extends BaseProvider {
    constructor(options) {
        if (!options.bucket) {
            options.bucket = process.env.CLOUDINARY_CLOUD_NAME || 'default';
        }
        super(options);
        this.folder = options.folder || 'adminjs_uploads';
    }

    async upload(file, key) {
        try {
            const filename = path.parse(file.name).name;
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const publicId = `${this.folder}/${filename}-${uniqueSuffix}`;

            const result = await cloudinary.uploader.upload(file.path, {
                public_id: publicId,
                resource_type: 'auto',
                overwrite: true
            });

            try {
                await fs.unlink(file.path);
            } catch (err) {
                console.warn('Failed to delete temp file:', file.path);
            }

            return {
                key: result.secure_url,
                bucket: this.options.bucket,
                size: result.bytes,
                mime_type: result.format ? `image/${result.format}` : file.type,
            };
        } catch (error) {
            console.error('Cloudinary Upload Error:', error);
            throw error;
        }
    }

    async delete(key, bucket) {
        try {
            let publicId = key;

            if (key && key.match(/^http/)) {
                const regex = /\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/;
                const match = key.match(regex);
                if (match && match[1]) {
                    publicId = match[1];
                } else {
                    return;
                }
            }

            await cloudinary.uploader.destroy(publicId);
        } catch (error) {
            console.error('Cloudinary Delete Error:', error);
        }
    }

    async path(key, bucket) {
        return key;
    }
}
