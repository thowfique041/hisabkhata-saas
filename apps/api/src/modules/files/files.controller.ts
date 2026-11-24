import { BadRequestException, Controller, ForbiddenException, Get, Param, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PERMISSIONS } from '@hisabkhata/shared';
import { CurrentUser, Tenant, TenantScoped } from '../../common/decorators';
import type { AuthUser, TenantContext } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { MAX_UPLOAD_BYTES, StorageService } from './storage.service';

type UploadedImage = { buffer: Buffer; size: number; mimetype: string; originalname: string };

const KIND_PERMISSION: Record<string, string> = {
  PRODUCT_IMAGE: PERMISSIONS.PRODUCT_MANAGE,
  BUSINESS_LOGO: PERMISSIONS.SETTINGS_MANAGE,
};

@ApiTags('Files')
@Controller()
export class FilesController {
  constructor(
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('files')
  @TenantScoped()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  async upload(@Tenant() t: TenantContext, @Query('kind') kind: string, @UploadedFile() file?: UploadedImage) {
    if (!file) throw new BadRequestException('Choose an image to upload');
    const required = KIND_PERMISSION[kind];
    if (!required) throw new BadRequestException('Unknown upload type');
    if (!t.permissions.has(required)) throw new ForbiddenException('You cannot upload this type of file');
    const asset = await this.storage.upload({ buffer: file.buffer, kind: kind as any, tenantId: t.tenantId, userId: t.userId });
    if (kind === 'BUSINESS_LOGO') {
      await this.prisma.tenant.update({ where: { id: t.tenantId }, data: { logoUrl: asset.url } });
    }
    return { id: asset.id, url: asset.url, size: asset.size, mimeType: asset.mimeType };
  }

  @Post('files/avatar')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  async avatar(@CurrentUser() user: AuthUser, @UploadedFile() file?: UploadedImage) {
    if (!file) throw new BadRequestException('Choose an image to upload');
    const asset = await this.storage.upload({ buffer: file.buffer, kind: 'AVATAR', tenantId: null, userId: user.id });
    await this.prisma.user.update({ where: { id: user.id }, data: { avatarUrl: asset.url } });
    return { id: asset.id, url: asset.url };
  }

  @Get('files/:id/content')
  async content(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const { asset, buffer } = await this.storage.readAuthorized(id, { tenantId: user.tid, userId: user.id, isSuperAdmin: user.isSuperAdmin });
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.send(buffer);
  }
}
