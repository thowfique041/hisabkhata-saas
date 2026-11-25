import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { FileAsset, FileKind } from '../../generated/prisma/client';

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
// Serverless hosts (Vercel) only allow writes under /tmp, and those files do not last between
// instances. Use Cloudinary there for anything that must persist.
const LOCAL_ROOT = process.env.VERCEL
  ? '/tmp/hisabkhata-storage'
  : path.resolve(__dirname, '../../../storage');

/** Detects the real image type from magic bytes; the client-declared mimetype is not trusted. */
export function sniffImage(buf: Buffer): { mime: string; ext: string } | null {
  if (
    buf.length > 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return { mime: 'image/png', ext: 'png' };
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return { mime: 'image/jpeg', ext: 'jpg' };
  if (
    buf.length > 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  )
    return { mime: 'image/webp', ext: 'webp' };
  return null;
}

@Injectable()
export class StorageService {
  private readonly driver: 'local' | 'cloudinary';

  constructor(
    private readonly config: AppConfig,
    private readonly prisma: PrismaService,
  ) {
    this.driver = config.get('STORAGE_DRIVER');
    if (this.driver === 'cloudinary') {
      cloudinary.config({
        cloud_name: config.get('CLOUDINARY_CLOUD_NAME'),
        api_key: config.get('CLOUDINARY_API_KEY'),
        api_secret: config.get('CLOUDINARY_API_SECRET'),
        secure: true,
      });
    }
  }

  async upload(input: {
    buffer: Buffer;
    kind: FileKind;
    tenantId: string | null;
    userId: string;
  }): Promise<FileAsset> {
    if (input.buffer.length > MAX_UPLOAD_BYTES)
      throw new BadRequestException('Images must be 2 MB or smaller');
    const type = sniffImage(input.buffer);
    if (!type) throw new BadRequestException('Only PNG, JPEG or WebP images are allowed');

    const id = randomUUID();
    const owner = input.tenantId ?? `user-${input.userId}`;
    let key: string;
    if (this.driver === 'cloudinary') {
      const result = await new Promise<{ public_id: string }>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              folder: `hisabkhata/${owner}`,
              public_id: id,
              type: 'authenticated',
              resource_type: 'image',
              overwrite: false,
            },
            (err, res) => (err || !res ? reject(err ?? new Error('Upload failed')) : resolve(res)),
          )
          .end(input.buffer);
      });
      key = result.public_id;
    } else {
      key = `${owner}/${id}.${type.ext}`;
      await fs.mkdir(path.join(LOCAL_ROOT, owner), { recursive: true });
      await fs.writeFile(path.join(LOCAL_ROOT, key), input.buffer);
    }

    const asset = await this.prisma.fileAsset.create({
      data: {
        tenantId: input.tenantId,
        uploadedBy: input.userId,
        kind: input.kind,
        provider: this.driver,
        key,
        url: '',
        mimeType: type.mime,
        size: input.buffer.length,
      },
    });
    return this.prisma.fileAsset.update({
      where: { id: asset.id },
      data: { url: `/api/files/${asset.id}/content` },
    });
  }

  /** Loads a file only if it belongs to the caller's tenant (or is the caller's own avatar). */
  async readAuthorized(
    id: string,
    access: { tenantId: string | null; userId: string; isSuperAdmin: boolean },
  ) {
    const asset = await this.prisma.fileAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('File not found');
    const allowed =
      access.isSuperAdmin ||
      (asset.tenantId !== null && asset.tenantId === access.tenantId) ||
      (asset.tenantId === null && asset.kind === 'AVATAR');
    if (!allowed) throw new ForbiddenException('You do not have access to this file');
    return { asset, buffer: await this.read(asset) };
  }

  async readForTenant(tenantId: string, url: string): Promise<Buffer | null> {
    const id = url.match(/\/api\/files\/([^/]+)\/content/)?.[1];
    if (!id) return null;
    const asset = await this.prisma.fileAsset.findFirst({ where: { id, tenantId } });
    return asset ? this.read(asset) : null;
  }

  private async read(asset: FileAsset): Promise<Buffer> {
    if (asset.provider === 'cloudinary') {
      const signed = cloudinary.url(asset.key, {
        type: 'authenticated',
        sign_url: true,
        secure: true,
        resource_type: 'image',
      });
      const res = await fetch(signed);
      if (!res.ok) throw new NotFoundException('File not available');
      return Buffer.from(await res.arrayBuffer());
    }
    const full = path.resolve(LOCAL_ROOT, asset.key);
    if (!full.startsWith(LOCAL_ROOT + path.sep)) throw new ForbiddenException();
    return fs.readFile(full);
  }
}
